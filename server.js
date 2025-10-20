const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
// Use bcryptjs (pure JS) to avoid native compilation on deploy
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { Resend } = require("resend");
const QRCode = require("qrcode");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads", "barbers");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "barber-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit - increased for high-quality images
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Email configuration - Resend (Railway-friendly)
let resend = null;

// Initialize Resend email service
function initializeResend() {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured - email functionality disabled');
      console.warn('   Set RESEND_API_KEY in Railway environment variables');
      return null;
    }

    console.log('⏳ Initializing Resend email service...');
    const resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email service initialized successfully');
    return resendClient;
  } catch (error) {
    console.error('❌ Error initializing Resend:', error.message);
    return null;
  }
}

// Initialize Resend
resend = initializeResend();

// Simple email service check for Resend
function checkEmailService() {
  if (!resend) {
    console.warn('⚠️ Resend not configured - email features disabled');
    console.warn('   Set RESEND_API_KEY environment variable');
    return false;
  }

  console.log('✅ Resend email service ready');
  console.log('📧 Email notifications will be sent via Resend');
  return true;
}

// ---------------- DATABASE ----------------
const dbPath = process.env.DATABASE_URL || path.join(__dirname, "barbershop.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Could not connect to database:", err);
  else console.log("✅ Connected to SQLite database at", dbPath);
});

// Database migration - add missing columns if they don't exist
function migrateDatabase() {
  const migrations = [
    "ALTER TABLE users ADD COLUMN full_name TEXT",
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE users ADD COLUMN profile_pic TEXT",
    "ALTER TABLE users ADD COLUMN gender TEXT",
    "ALTER TABLE users ADD COLUMN age INTEGER",
    "ALTER TABLE users ADD COLUMN birthday DATE",
    "ALTER TABLE timeslots ADD COLUMN available_date DATE",
    "ALTER TABLE timeslots ADD COLUMN is_available BOOLEAN DEFAULT 1",
    "ALTER TABLE bookings ADD COLUMN booking_date DATE",
    "ALTER TABLE bookings ADD COLUMN is_walk_in BOOLEAN DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN confirmed_by_admin BOOLEAN DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN reference_number TEXT",
    "ALTER TABLE barbers ADD COLUMN profile_pic TEXT",
    "ALTER TABLE barbers ADD COLUMN is_present BOOLEAN DEFAULT 1",
    "ALTER TABLE barbers ADD COLUMN contact_number TEXT",
  ];

  // Create QR settings table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS qr_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error("QR settings table error:", err.message);
    }
  );

  // Insert default QR settings if they don't exist
  db.run(
    `INSERT OR IGNORE INTO qr_settings (payment_method, qr_code_data) VALUES 
     ('gcash', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdDYXNIIFFSIFVucmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4='),
     ('paymaya', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlBheU1heWEgUVIgVW5yYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==')`,
    (err) => {
      if (err) console.error("Default QR settings error:", err.message);
    }
  );

  migrations.forEach((sql) => {
    db.run(sql, (err) => {
      if (err && !err.message.includes("duplicate column name")) {
        console.error("Migration error:", err.message);
      }
    });
  });

  // Create notifications table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
    (err) => {
      if (err) console.error("Notifications table error:", err.message);
    }
  );

  // Create QR code settings table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS qr_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error("QR settings table error:", err.message);
    }
  );

  // Insert default QR settings if they don't exist
  db.run(
    `INSERT OR IGNORE INTO qr_settings (payment_method, qr_code_data) VALUES 
     ('gcash', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdDYXNIIFFSIFVucmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4='),
     ('paymaya', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlBheU1heWEgUVIgVW5yYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==')`,
    (err) => {
      if (err) console.error("Default QR settings error:", err.message);
    }
  );
  // Create barber availability table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS barber_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barber_id INTEGER NOT NULL,
      date DATE NOT NULL,
      is_present BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
      UNIQUE(barber_id, date)
    )
  `,
    (err) => {
      if (err) console.error("Error creating barber_availability table:", err);
      else console.log("Barber availability table ready");
    }
  );
}

migrateDatabase();

// Create timeslot availability table for date-specific availability
db.run(
  `
  CREATE TABLE IF NOT EXISTS timeslot_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timeslot_id INTEGER NOT NULL,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (timeslot_id) REFERENCES timeslots(id) ON DELETE CASCADE,
    UNIQUE(timeslot_id, date)
  )
`,
  (err) => {
    if (err) console.error("Error creating timeslot_availability table:", err);
    else console.log("Timeslot availability table ready");
  }
);

// Create users table with role
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('USER','ADMIN','SUPERADMIN')) NOT NULL DEFAULT 'USER',
    full_name TEXT,
    phone TEXT,
    profile_pic TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create barbers table
db.run(`
  CREATE TABLE IF NOT EXISTS barbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    profile_pic TEXT,
    is_present BOOLEAN DEFAULT 1
  )
`);

// Create timeslots table (barber-specific)
db.run(`
  CREATE TABLE IF NOT EXISTS timeslots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barber_id INTEGER NOT NULL,
    time TEXT NOT NULL,
    available_date DATE,
    is_available BOOLEAN DEFAULT 1,
    FOREIGN KEY (barber_id) REFERENCES barbers(id)
  )
`);

// Create notifications table
db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create bookings table
db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    barber_id INTEGER,
    time_id INTEGER,
    booking_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending',
    payment_method TEXT,
    is_walk_in BOOLEAN DEFAULT 0,
    confirmed_by_admin BOOLEAN DEFAULT 0,
    reference_number TEXT,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (barber_id) REFERENCES barbers(id),
    FOREIGN KEY (time_id) REFERENCES timeslots(id)
  )
`);

// Create reviews table
db.run(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure bookings table has cancelled_by column (safe migration)
db.all("PRAGMA table_info(bookings)", [], (err, cols) => {
  if (err) return console.error('PRAGMA error:', err);
  const hasCancelledBy = cols && cols.some(c => c.name === 'cancelled_by');
  if (!hasCancelledBy) {
    db.run("ALTER TABLE bookings ADD COLUMN cancelled_by TEXT", [], (alterErr) => {
      if (alterErr) console.error('Failed to add cancelled_by column:', alterErr);
      else console.log('Added cancelled_by column to bookings table');
    });
  }
});

// Insert default ADMIN and SUPERADMIN if not exists
async function insertDefaultUsers() {
  const defaults = [
    { email: "admin@example.com", password: "admin123", role: "ADMIN" },
    {
      email: "superadmin@example.com",
      password: "super123",
      role: "SUPERADMIN",
    },
    {
      email: "user@example.com",
      password: "super123",
      role: "USER",
    },
  ];

  for (const user of defaults) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    db.get("SELECT * FROM users WHERE email = ?", [user.email], (err, row) => {
      if (err) return console.error("DB check error:", err);
      if (!row) {
        db.run(
          "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
          [user.email, hashedPassword, user.role],
          (err2) => {
            if (err2) console.error("Insert error:", err2);
            else
              console.log(
                `✅ Default ${user.role} added: ${user.email} (pw: ${user.password})`
              );
          }
        );
      } else {
        console.log(`ℹ️ ${user.role} already exists: ${user.email}`);
      }
    });
  }
}
insertDefaultUsers();

// Insert sample barbers if not exists
db.serialize(() => {
  db.all("SELECT COUNT(*) AS count FROM barbers", (err, rows) => {
    if (err) return console.error("Barbers count error:", err);
    if (rows[0].count === 0) {
      const barbers = [
        "Carlo the Barber",
        "Sheed the Barber",
        "Gelo the Barber",
        "Marco the Barber",
        "Ferdinand the Barber",
        "Erit the Carlo",
      ];

      const stmt = db.prepare("INSERT INTO barbers (name) VALUES (?)");
      barbers.forEach((name, index) => {
        stmt.run(name, function (err) {
          if (err) console.error("Barber insert error:", err);
          else console.log(`✅ Barber added: ${name} (ID: ${this.lastID})`);
        });
      });
      stmt.finalize();
    }
  });
});

// Insert sample timeslots for each barber (only if not already present)
// Note: Barber IDs are 13-18 based on existing database
const timeslotsData = {
  13: ["09:00 AM", "10:00 AM", "11:00 AM"], // Carlo the Barber
  14: ["01:00 PM", "02:00 PM", "03:00 PM"], // Sheed the Barber
  15: ["09:30 AM", "10:30 AM", "11:30 AM"], // Gelo the Barber
  16: ["01:30 PM", "02:30 PM"], // Marco the Barber
  17: ["03:00 PM", "04:00 PM"], // Ferdinand the Barber
  18: ["11:00 AM", "01:00 PM", "05:00 PM"], // Erit the Carlo
};

db.serialize(() => {
  db.all("SELECT COUNT(*) AS count FROM timeslots", (err, rows) => {
    if (err) return console.error("Timeslots count error:", err);
    if (rows[0].count === 0) {
      const stmt = db.prepare(
        "INSERT INTO timeslots (barber_id, time) VALUES (?, ?)"
      );
      for (const barberId in timeslotsData) {
        timeslotsData[barberId].forEach((time) => {
          stmt.run(barberId, time, (err) => {
            if (err) console.error("Timeslot insert error:", err);
          });
        });
      }
      stmt.finalize(() => {
        console.log("✅ Timeslots successfully added!");
      });
    }
  });
});

// Insert sample reviews (only if not already present)
db.serialize(() => {
  db.all("SELECT COUNT(*) AS count FROM reviews", (err, rows) => {
    if (err) return console.error("Reviews count error:", err);
    if (rows[0].count === 0) {
      const sampleReviews = [
        {
          name: "Miguel Santos",
          rating: 5,
          comment: "Excellent service! The barbers are very skilled and the place is always clean. Highly recommend Suave Barbershop!"
        },
        {
          name: "Juan dela Cruz",
          rating: 5,
          comment: "Best haircut in town! Carlo did an amazing job. Will definitely be back."
        },
        {
          name: "Mark Rodriguez",
          rating: 4,
          comment: "Great experience overall. Professional staff and good atmosphere."
        },
        {
          name: "Alex Reyes",
          rating: 5,
          comment: "Love this place! Always leave looking fresh and feeling confident. Thank you Suave team!"
        },
        {
          name: "Chris Garcia",
          rating: 4,
          comment: "Good service and reasonable prices. The booking system online is very convenient."
        }
      ];

      const stmt = db.prepare(
        "INSERT INTO reviews (name, rating, comment) VALUES (?, ?, ?)"
      );
      
      sampleReviews.forEach((review) => {
        stmt.run(review.name, review.rating, review.comment, (err) => {
          if (err) console.error("Sample review insert error:", err);
        });
      });
      
      stmt.finalize(() => {
        console.log("✅ Sample reviews successfully added!");
      });
    }
  });
});

// ---------------- MIDDLEWARE ----------------
app.use(express.json({ limit: '50mb' })); // Significantly increased limit for large base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key_here", // change in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hour
  })
);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------- HELPERS ----------------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/main");
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user)
      return res.status(401).json({ error: "You must be logged in" });
    if (req.session.user.role !== role)
      return res.status(403).json({ error: "Access denied" });
    next();
  };
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.session.user)
      return res.status(401).json({ error: "You must be logged in" });
    if (!roles.includes(req.session.user.role))
      return res.status(403).json({ error: "Access denied" });
    next();
  };
}

// Helper function to check if Resend is available
function isEmailServiceAvailable() {
  return resend !== null && process.env.RESEND_API_KEY;
}

// Enhanced email sending function using Resend
// Use RESEND_FROM env var when available; fallback to onboarding sandbox address
async function sendEmail(to, subject, html, from = process.env.RESEND_FROM || "Suave Barbershop <onboarding@resend.dev>") {
  try {
    if (!isEmailServiceAvailable()) {
      console.warn('⚠️ Resend email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    if (!to || !subject || !html) {
      console.error('❌ Missing required email parameters');
      return { success: false, error: 'Missing email parameters' };
    }

    console.log(`📧 Sending email via Resend to: ${to}`);
    console.log(`📧 Subject: ${subject}`);

    const { data, error } = await resend.emails.send({
      from: from,
      to: [to],
      subject: subject,
      html: html,
    });

    // Log entire response for debugging (warnings, rejection reasons may appear here)
    console.log('✅ Resend response:', JSON.stringify(data));
    if (error) {
      console.error('❌ Resend API returned error object:', error);
      throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`✅ Email sent successfully via Resend`);
    if (data && data.id) console.log(`📧 Message ID: ${data.id}`);

    return { success: true, messageId: data && data.id ? data.id : null, raw: data };
  } catch (error) {
    console.error(`❌ Email send failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Updated booking confirmation function
async function sendBookingConfirmation(email, bookingDetails) {
  try {
    const subject = "Booking Confirmation - Suave Barbershop";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #cf0c02;">Booking Confirmation</h2>
        <p>Dear Valued Customer,</p>
        <p>Your appointment has been successfully confirmed! Here are your booking details:</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>Time:</strong> ${bookingDetails.time}</li>
            <li style="margin: 10px 0;"><strong>Service:</strong> ${bookingDetails.service}</li>
            <li style="margin: 10px 0;"><strong>Payment Method:</strong> ${bookingDetails.payment_method}</li>
            <li style="margin: 10px 0;"><strong>Barber:</strong> ${bookingDetails.barber}</li>
          </ul>
        </div>
        <p>Please arrive 10 minutes before your scheduled time.</p>
        <p>Thank you for choosing Suave Barbershop!</p>
        <p>Best regards,<br><strong>Suave Barbershop Team</strong></p>
      </div>
    `;

    const result = await sendEmail(email, subject, html);
    if (result.success) {
      console.log("✅ Booking confirmation email sent successfully");
    } else {
      console.error("❌ Failed to send booking confirmation email:", result.error);
    }
    return result;
  } catch (error) {
    console.error("❌ Booking confirmation email error:", error);
    return { success: false, error: error.message };
  }
}

// Updated cancellation email function
async function sendCancellationEmail(email, bookingDetails) {
  try {
    const subject = "Appointment Cancellation - Suave Barbershop";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #cf0c02;">Appointment Cancellation Notice</h2>
        <p>Dear Valued Customer,</p>
        <p>We regret to inform you that your appointment has been cancelled due to valid reasons beyond our control.</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Cancelled Appointment Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>Service:</strong> ${bookingDetails.service}</li>
            <li style="margin: 10px 0;"><strong>Date:</strong> ${bookingDetails.booking_date}</li>
            <li style="margin: 10px 0;"><strong>Time:</strong> ${bookingDetails.time}</li>
            <li style="margin: 10px 0;"><strong>Barber:</strong> ${bookingDetails.barber}</li>
          </ul>
        </div>
        <p>We sincerely apologize for any inconvenience this may cause. We would be happy to assist you in rescheduling your appointment at your earliest convenience.</p>
        <p>Please feel free to contact us or visit our website to book a new appointment that suits your schedule.</p>
        <p>Thank you for your understanding and continued patronage.</p>
        <p>Best regards,<br><strong>Suave Barbershop Team</strong></p>
      </div>
    `;

    const result = await sendEmail(email, subject, html);
    if (result.success) {
      console.log("✅ Cancellation email sent successfully");
    } else {
      console.error("❌ Failed to send cancellation email:", result.error);
    }
    return result;
  } catch (error) {
    console.error("❌ Cancellation email error:", error);
    return { success: false, error: error.message };
  }
}

// Generate QR Code for payment
async function generatePaymentQR(paymentMethod, amount = 100) {
  try {
    let qrData = "";
    if (paymentMethod === "GCASH") {
      qrData = `gcash://pay?amount=${amount}&merchant=SuaveBarbershop`;
    } else if (paymentMethod === "PAYMAYA") {
      qrData = `paymaya://pay?amount=${amount}&merchant=SuaveBarbershop`;
    }

    if (qrData) {
      const qrCode = await QRCode.toDataURL(qrData);
      return qrCode;
    }
    return null;
  } catch (error) {
    console.error("QR Code generation error:", error);
    return null;
  }
}

// ---------------- API ROUTES ----------------
// Register (always USER)
// ========== ADMIN NOTIFICATIONS ENDPOINTS ==========
// Get booking notifications for admin (only USER bookings)
app.get("/api/admin/notifications", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  // Only show notifications of type 'admin-booking' for the logged-in admin
  db.all(
    `SELECT id, message, is_read, created_at as date
     FROM notifications
     WHERE user_id = ? AND type = 'admin-booking'
     ORDER BY created_at DESC LIMIT 50`,
    [req.session.user.id],
    (err, rows) => {
      if (err) return res.json({ notifications: [] });
      res.json({ notifications: rows.map(n => ({
        id: n.id,
        message: n.message,
        is_read: !!n.is_read,
        date: n.date
      })) });
    }
  );
});

// Mark a single admin notification as read
app.post("/api/admin/notifications/mark-read", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { notificationId } = req.body;
  db.run(
    `UPDATE notifications SET is_read = 1 WHERE id = ?`,
    [notificationId],
    err => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

// Mark all admin notifications as read
app.post("/api/admin/notifications/mark-all-read", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  db.run(
    `UPDATE notifications SET is_read = 1 WHERE id IN (
      SELECT n.id FROM notifications n JOIN users u ON n.user_id = u.id WHERE u.role = 'USER' AND n.type = 'booking'
    )`,
    [],
    err => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});
app.post("/api/register", async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name)
    return res.status(400).json({ error: "Email, password, and full name are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = "INSERT INTO users (email, password, role, full_name) VALUES (?, ?, ?, ?)";
    db.run(query, [email, hashedPassword, "USER", full_name], function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ message: "User registered successfully", id: this.lastID });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const query = "SELECT * FROM users WHERE email = ?";
  db.get(query, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid email or password" });

    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.json({ 
      message: "Login successful", 
      user: req.session.user,
      role: user.role // Add role at top level for client-side redirect logic
    });
  });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

// ✅ Get available times for a specific barber and date (exclude booked slots)
app.get("/api/available-times/:barberId/:date", (req, res) => {
  const barberId = parseInt(req.params.barberId, 10);
  const date = req.params.date;
  if (isNaN(barberId) || !date) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid barber ID or date" });
  }
  const query = `
    SELECT t.id, t.time
    FROM timeslots t
    LEFT JOIN barbers b ON t.barber_id = b.id
    LEFT JOIN timeslot_availability ta ON t.id = ta.timeslot_id AND ta.date = ?
    WHERE t.barber_id = ? AND b.is_present = 1
      AND (t.available_date IS NULL OR t.available_date = ? OR t.available_date < ?)
      AND CASE 
            WHEN ta.is_available IS NOT NULL THEN ta.is_available = 1
            ELSE t.is_available = 1 
          END
      AND t.id NOT IN (
        SELECT time_id FROM bookings 
  WHERE barber_id = ? AND booking_date = ? AND booking_date IS NOT NULL AND booking_date != '' AND status NOT IN ('Done','Cancelled')
      )
    ORDER BY t.time
  `;
  db.all(query, [date, barberId, date, date, barberId, date], (err, rows) => {
    if (err) {
      console.error("Available times DB error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    res.json({ success: true, times: rows });
  });
});

// Legacy endpoint for backward compatibility
app.get("/api/available-times/:barberId", (req, res) => {
  const barberId = parseInt(req.params.barberId, 10);
  if (isNaN(barberId)) {
    return res.status(400).json({ success: false, error: "Invalid barber ID" });
  }
  const query = `
    SELECT t.id, t.time
    FROM timeslots t
    LEFT JOIN barbers b ON t.barber_id = b.id
    WHERE t.barber_id = ? AND t.is_available = 1 AND b.is_present = 1
      AND (t.available_date IS NULL OR t.available_date = DATE('now') OR t.available_date < DATE('now'))
      AND t.id NOT IN (
        SELECT time_id FROM bookings 
  WHERE barber_id = ? AND booking_date = DATE('now') AND booking_date IS NOT NULL AND booking_date != '' AND status NOT IN ('Done','Cancelled')
      )
    ORDER BY t.time
  `;
  db.all(query, [barberId, barberId], (err, rows) => {
    if (err) {
      console.error("Available times DB error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    res.json({ success: true, times: rows });
  });
});

// ✅ Book a service (ensure no double booking for user or barber/time) - UPDATED with booking limit
app.post("/api/book-service", (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, error: "You must be logged in" });
  }
  
  const {
    service,
    barber_id,
    time_id,
    booking_date,
    reference_number,
    payment_method,
  } = req.body;
  
  if (!service || !barber_id || !time_id || !booking_date || !payment_method) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields including payment method",
    });
  }

  // For non-cash payments, reference number is required
  if (payment_method !== "cash" && !reference_number) {
    return res.status(400).json({
      success: false,
      error: "Reference number is required for non-cash payments",
    });
  }

  // Check user's booking limit (3 active bookings maximum)
  db.get(
    "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status NOT IN ('Done', 'Cancelled')",
    [req.session.user.id],
    (err, countResult) => {
      if (err) {
        return res.status(500).json({ success: false, error: "Database error" });
      }

      if (countResult.count >= 3) {
        return res.status(400).json({
          success: false,
          error: "You have reached the maximum limit of 3 active bookings. Please complete or cancel existing bookings before making a new one.",
        });
      }

      // Check if barber is already booked for that time AND date (FIXED)
      db.get(
        "SELECT * FROM bookings WHERE barber_id = ? AND time_id = ? AND booking_date = ? AND status NOT IN ('Done', 'Cancelled')",
        [barber_id, time_id, booking_date],
        (err, existingBooking) => {
          if (err)
            return res
              .status(500)
              .json({ success: false, error: "Database error" });
          if (existingBooking) {
            return res.status(400).json({
              success: false,
              error: "This barber is already booked at that time on this date.",
            });
          }

          // Insert booking
          db.run(
            "INSERT INTO bookings (user_id, service, barber_id, time_id, booking_date, reference_number, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              req.session.user.id,
              service,
              barber_id,
              time_id,
              booking_date,
              reference_number || null,
              payment_method,
            ],
            function (err3) {
              if (err3)
                return res
                  .status(500)
                  .json({ success: false, error: "Database error" });

              // Create notification (but don't send email yet)

                // User notification (for user interface)
                db.run(
                  "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
                  [
                    req.session.user.id,
                    `Your booking for ${service} on ${booking_date} has been submitted and is pending admin confirmation.`,
                    "booking",
                  ],
                  (notifErr) => {
                    if (notifErr) console.error("Notification error:", notifErr);
                  }
                );

                // Admin notification (for admin interface)
                db.get("SELECT full_name, email FROM users WHERE id = ?", [req.session.user.id], (userErr, userRow) => {
                  let userDisplay = userRow?.full_name || userRow?.email || `User ${req.session.user.id}`;
                  // Find all admins
                  db.all("SELECT id FROM users WHERE role = 'ADMIN' OR role = 'SUPERADMIN'", [], (adminErr, adminRows) => {
                    if (adminRows && adminRows.length > 0) {
                      adminRows.forEach(admin => {
                        db.run(
                          "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
                          [
                            admin.id,
                            `${userDisplay} has booked an appointment for ${service} on ${booking_date}.`,
                            "admin-booking",
                          ],
                          (notifErr) => {
                            if (notifErr) console.error("Admin notification error:", notifErr);
                          }
                        );
                      });
                    }
                  });
                });

              res.json({
                success: true,
                message: "Booking submitted! Awaiting admin confirmation.",
                bookingId: this.lastID,
                remainingBookings: 3 - (countResult.count + 1),
              });
            }
          );
        }
      );
    }
  );
});

// Get user's current booking count
app.get("/api/user-booking-count", requireLogin, (req, res) => {
  const query = `
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE user_id = ? AND status NOT IN ('Done', 'Cancelled')
  `;
  
  db.get(query, [req.session.user.id], (err, row) => {
    if (err) {
      console.error("Booking count error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    res.json({ 
      success: true, 
      count: row.count,
      limit: 3,
      canBook: row.count < 3
    });
  });
});

// Get all barbers (UPDATED to properly filter by presence and date)
app.get("/api/barbers", (req, res) => {
  const { date, present_only } = req.query;
  
  console.log("Barbers API called with:", { date, present_only }); // Debug log
  
  let query = `
    SELECT b.id, b.name, b.profile_pic, b.is_present as default_present,
           CASE 
             WHEN ba.is_present IS NOT NULL THEN ba.is_present
             ELSE b.is_present 
           END as is_present
    FROM barbers b
    LEFT JOIN barber_availability ba ON b.id = ba.barber_id AND ba.date = ?
  `;
  
  // If present_only is requested, filter out absent barbers
  if (present_only === 'true') {
    query += `
      WHERE (CASE 
               WHEN ba.is_present IS NOT NULL THEN ba.is_present = 1
               ELSE b.is_present = 1 
             END)
    `;
  }
  
  query += ` ORDER BY b.name`;
  
  const params = [date || null];

  console.log("Executing query:", query); // Debug log
  console.log("With params:", params); // Debug log

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("Barbers query error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    console.log("Barbers query result:", rows); // Debug log
    res.json({ success: true, barbers: rows });
  });
});

// View user bookings
app.get("/api/my-bookings", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ success: false, error: "Login required" });

  const query = `
    SELECT b.id, b.service, br.name AS barber, t.time AS time, b.status, b.payment_method, b.booking_date, b.booked_at
    FROM bookings b
    LEFT JOIN barbers br ON b.barber_id = br.id
    LEFT JOIN timeslots t ON b.time_id = t.id
  WHERE b.user_id = ? AND b.status NOT IN ('Done', 'Cancelled')
    ORDER BY b.booking_date DESC, t.time ASC
  `;
  db.all(query, [req.session.user.id], (err, rows) => {
    if (err)
      return res.status(500).json({ success: false, error: "Database error" });
    res.json({ success: true, bookings: rows });
  });
});

// Get user booking history (Done and Cancelled bookings)
app.get("/api/booking-history", requireLogin, (req, res) => {
  console.log("Fetching booking history for user:", req.session.user.id);
  
  const query = `
    SELECT b.id, b.service, br.name AS barber, t.time AS time, b.status, 
           b.payment_method, b.reference_number, b.booking_date, b.booked_at
    FROM bookings b
    LEFT JOIN barbers br ON b.barber_id = br.id
    LEFT JOIN timeslots t ON b.time_id = t.id
    WHERE b.user_id = ? AND b.status IN ('Done', 'Cancelled')
    ORDER BY b.booked_at DESC
  `;
  
  db.all(query, [req.session.user.id], (err, rows) => {
    if (err) {
      console.error("Booking history query error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    console.log("Found booking history records:", rows.length);
    console.log("History data:", rows);
    res.json({ success: true, bookings: rows });
  });
});

// Debug endpoint to check all user bookings
app.get("/api/debug-bookings", requireLogin, (req, res) => {
  const query = `
    SELECT b.id, b.service, br.name AS barber, t.time AS time, b.status, 
           b.payment_method, b.reference_number, b.booking_date, b.booked_at
    FROM bookings b
    LEFT JOIN barbers br ON b.barber_id = br.id
    LEFT JOIN timeslots t ON b.time_id = t.id
    WHERE b.user_id = ?
    ORDER BY b.booked_at DESC
  `;
  
  db.all(query, [req.session.user.id], (err, rows) => {
    if (err) {
      console.error("Debug bookings query error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    // Also get all unique statuses in the system
    db.all("SELECT DISTINCT status FROM bookings WHERE user_id = ?", [req.session.user.id], (err2, statuses) => {
      res.json({ 
        success: true, 
        bookings: rows, 
        total: rows.length,
        statuses: statuses || []
      });
    });
  });
});

// ========= REVIEWS API ENDPOINTS =========

// Get reviews with statistics (public endpoint)
app.get("/api/reviews", (req, res) => {
  // Get recent reviews (limit to 5 most recent)
  const reviewsQuery = `
    SELECT name, rating, comment, created_at
    FROM reviews 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  // Get statistics
  const statsQuery = `
    SELECT 
      COUNT(*) as count,
      AVG(rating) as average,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
    FROM reviews
  `;
  
  db.all(reviewsQuery, [], (err, reviews) => {
    if (err) {
      console.error("Reviews query error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    db.get(statsQuery, [], (err, stats) => {
      if (err) {
        console.error("Reviews stats query error:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }
      
      // Default stats if no reviews
      const reviewStats = {
        count: stats?.count || 0,
        average: stats?.average || 0,
        distribution: {
          5: stats?.five_star || 0,
          4: stats?.four_star || 0,
          3: stats?.three_star || 0,
          2: stats?.two_star || 0,
          1: stats?.one_star || 0
        }
      };
      
      res.json({
        success: true,
        reviews: reviews || [],
        stats: reviewStats
      });
    });
  });
});

// Post a new review (public endpoint)
app.post("/api/reviews", (req, res) => {
  const { name, rating, comment } = req.body;
  
  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Name is required" });
  }
  
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5" });
  }
  
  // Trim and validate lengths
  const trimmedName = name.trim();
  const trimmedComment = comment ? comment.trim() : null;
  
  if (trimmedName.length > 50) {
    return res.status(400).json({ success: false, message: "Name must be 50 characters or less" });
  }
  
  if (trimmedComment && trimmedComment.length > 300) {
    return res.status(400).json({ success: false, message: "Comment must be 300 characters or less" });
  }
  
  // Insert review into database
  const insertQuery = `
    INSERT INTO reviews (name, rating, comment)
    VALUES (?, ?, ?)
  `;
  
  db.run(insertQuery, [trimmedName, rating, trimmedComment], function(err) {
    if (err) {
      console.error("Insert review error:", err);
      return res.status(500).json({ success: false, message: "Failed to save review" });
    }
    
    console.log("New review added:", { id: this.lastID, name: trimmedName, rating });
    res.json({ 
      success: true, 
      message: "Review submitted successfully",
      reviewId: this.lastID
    });
  });
});

// Admin: Get all reviews with management capabilities
app.get("/api/admin/reviews", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Get reviews with pagination
  const reviewsQuery = `
    SELECT id, name, rating, comment, created_at
    FROM reviews 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `;
  
  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM reviews`;
  
  db.all(reviewsQuery, [limit, offset], (err, reviews) => {
    if (err) {
      console.error("Admin reviews query error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    db.get(countQuery, [], (err, countResult) => {
      if (err) {
        console.error("Reviews count query error:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }
      
      res.json({
        success: true,
        reviews: reviews || [],
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          totalPages: Math.ceil((countResult?.total || 0) / limit)
        }
      });
    });
  });
});

// Admin: Delete a review
app.delete("/api/admin/reviews/:reviewId", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { reviewId } = req.params;
  
  if (!reviewId || isNaN(reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid review ID" });
  }
  
  db.run("DELETE FROM reviews WHERE id = ?", [reviewId], function(err) {
    if (err) {
      console.error("Delete review error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete review" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    
    console.log("Review deleted:", reviewId);
    res.json({ success: true, message: "Review deleted successfully" });
  });
});

// Admin & Superadmin: Get all bookings with optional status filtering
app.get(
  "/api/admin/all-bookings",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { status } = req.query;
    
    let whereClause = "";
    let params = [];
    
    if (status && status.trim() !== "") {
      // Filter by specific status
      whereClause = "WHERE b.status = ?";
      params = [status];
    } else {
      // Default behavior: exclude Done and Cancelled (for backward compatibility)
      whereClause = "WHERE b.status NOT IN ('Done','Cancelled')";
    }
    
    const query = `
      SELECT b.id, u.full_name, b.service, br.name AS barber, t.time, b.booking_date, b.status, b.payment_method, b.is_walk_in, b.confirmed_by_admin, b.reference_number, b.booked_at
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      LEFT JOIN timeslots t ON b.time_id = t.id
      ${whereClause}
      ORDER BY b.booked_at DESC
    `;
    
    db.all(query, params, (err, rows) => {
      if (err) return res.json({ success: false, error: "Database error" });
      res.json({ success: true, bookings: rows, status: status || "default" });
    });
  }
);

// Admin: Manage barber schedules
app.get(
  "/api/admin/barber-schedules",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { date } = req.query;

    let query = `
      SELECT t.id, t.barber_id, b.name as barber_name, t.time, t.available_date, t.is_available,
             CASE 
               WHEN b2.id IS NOT NULL THEN 0
               WHEN ta.is_available IS NOT NULL THEN ta.is_available
               ELSE t.is_available 
             END as actual_availability,
             CASE 
               WHEN ba.is_present IS NOT NULL THEN ba.is_present
               ELSE b.is_present 
             END as barber_present
      FROM timeslots t
      LEFT JOIN barbers b ON t.barber_id = b.id
  LEFT JOIN bookings b2 ON t.id = b2.time_id AND b2.booking_date = ? AND b2.status NOT IN ('Done','Cancelled')
      LEFT JOIN timeslot_availability ta ON t.id = ta.timeslot_id AND ta.date = ?
      LEFT JOIN barber_availability ba ON t.barber_id = ba.barber_id AND ba.date = ?
      WHERE (CASE 
               WHEN ba.is_present IS NOT NULL THEN ba.is_present = 1
               ELSE b.is_present = 1 
             END)
      ORDER BY b.name, t.time
    `;

    const params = date ? [date, date, date] : [null, null, null];

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("Error fetching barber schedules:", err);
        return res.json({ success: false, error: "Database error" });
      }
      res.json({ success: true, schedules: rows });
    });
  }
);

// Admin: Update barber availability (date-specific)
app.post(
  "/api/admin/update-barber-schedule",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { timeslotId, isAvailable, availableDate } = req.body;
    
    if (!timeslotId) {
      return res.status(400).json({ 
        success: false, 
        error: "Timeslot ID required" 
      });
    }

    if (!availableDate) {
      return res.status(400).json({ 
        success: false, 
        error: "Date is required for availability update" 
      });
    }

    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({ 
        success: false, 
        error: "Availability status is required" 
      });
    }

    // First, get the default availability of this timeslot
    db.get("SELECT is_available FROM timeslots WHERE id = ?", [timeslotId], (err, timeslot) => {
      if (err) {
        console.error("Error fetching timeslot:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      if (!timeslot) {
        return res.status(404).json({ 
          success: false, 
          error: "Timeslot not found" 
        });
      }

      const defaultAvailable = timeslot.is_available === 1;

      // If setting to the same as default availability, delete the date-specific record
      if (isAvailable === defaultAvailable) {
        const deleteQuery = "DELETE FROM timeslot_availability WHERE timeslot_id = ? AND date = ?";
        db.run(deleteQuery, [timeslotId, availableDate], function (err) {
          if (err) {
            console.error("Error deleting timeslot availability:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          res.json({ 
            success: true, 
            message: "Schedule updated successfully (reverted to default)" 
          });
        });
      } else {
        // If setting to different from default, insert/update the date-specific record
        const insertQuery = `
          INSERT OR REPLACE INTO timeslot_availability (timeslot_id, date, is_available) 
          VALUES (?, ?, ?)
        `;
        
        db.run(insertQuery, [timeslotId, availableDate, isAvailable ? 1 : 0], function (err) {
          if (err) {
            console.error("Error updating timeslot availability:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          res.json({ 
            success: true, 
            message: "Schedule updated successfully" 
          });
        });
      }
    });
  }
);

// Admin: Update barber presence (date-specific)
app.post(
  "/api/admin/update-barber-presence",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { barberId, isPresent, date } = req.body;
    
    if (!barberId || typeof isPresent !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Barber ID and presence status required",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date is required for presence update",
      });
    }

    // First, get the default presence of this barber
    db.get("SELECT is_present FROM barbers WHERE id = ?", [barberId], (err, barber) => {
      if (err) {
        console.error("Error fetching barber:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      if (!barber) {
        return res.status(404).json({ 
          success: false, 
          error: "Barber not found" 
        });
      }

      const defaultPresent = barber.is_present === 1;

      // If setting to the same as default presence, delete the date-specific record
      if (isPresent === defaultPresent) {
        const deleteQuery = "DELETE FROM barber_availability WHERE barber_id = ? AND date = ?";
        db.run(deleteQuery, [barberId, date], function (err) {
          if (err) {
            console.error("Error deleting barber availability:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          res.json({ 
            success: true, 
            message: `Barber presence updated successfully (reverted to default)` 
          });
        });
      } else {
        // If setting to different from default, insert/update the date-specific record
        const insertQuery = `
          INSERT OR REPLACE INTO barber_availability (barber_id, date, is_present) 
          VALUES (?, ?, ?)
        `;
        
        db.run(insertQuery, [barberId, date, isPresent ? 1 : 0], function (err) {
          if (err) {
            console.error("Error updating barber availability:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          res.json({ 
            success: true, 
            message: `Barber marked as ${isPresent ? "present" : "absent"} for ${date}` 
          });
        });
      }
    });
  }
);

// Admin: Get all barbers with presence status (date-specific)
app.get(
  "/api/admin/barbers",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { date } = req.query;
    
    let query = `
      SELECT b.id, b.name, b.contact_number, b.profile_pic, b.is_present as default_present,
             b.age, b.gender, b.birthday,
             CASE 
               WHEN ba.is_present IS NOT NULL THEN ba.is_present
               ELSE b.is_present 
             END as is_present
      FROM barbers b
      LEFT JOIN barber_availability ba ON b.id = ba.barber_id AND ba.date = ?
      ORDER BY b.name
    `;

    const params = [date || null];

    db.all(query, params, (err, rows) => {
      if (err) return res.json({ success: false, error: "Database error" });
      // Add photo field for each barber
      const barbers = rows.map(barber => {
        let photo;
        if (barber.profile_pic && barber.profile_pic.trim() !== "") {
          photo = `/uploads/barbers/${barber.profile_pic}`;
        } else {
          photo = '/default-profile.svg';
        }
        return {
          ...barber,
          photo
        };
      });
      res.json({ success: true, barbers });
    });
  }
);

// Admin: Upload barber profile picture
app.post(
  "/api/admin/upload-barber-picture",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  upload.single("barberPicture"),
  (req, res) => {
    const { barberId } = req.body;

    if (!barberId) {
      return res.status(400).json({
        success: false,
        error: "Barber ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const imagePath = `/uploads/barbers/${req.file.filename}`;

    // Update barber's profile picture in database
    db.run(
      "UPDATE barbers SET profile_pic = ? WHERE id = ?",
      [imagePath, barberId],
      function (err) {
        if (err) {
          // Delete the uploaded file if database update fails
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr)
              console.error("Failed to delete uploaded file:", unlinkErr);
          });
          return res.json({ success: false, error: "Database error" });
        }

        res.json({
          success: true,
          message: "Barber picture updated successfully",
          imagePath: imagePath,
        });
      }
    );
  }
);

// Admin: Update barber name
app.post(
  "/api/admin/update-barber-name",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { barberId, name } = req.body;
    
    if (!barberId || !name) {
      return res.status(400).json({ 
        success: false, 
        error: "Barber ID and name are required" 
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Name must be at least 2 characters long" 
      });
    }

    const query = "UPDATE barbers SET name = ? WHERE id = ?";
    db.run(query, [name.trim(), barberId], function(err) {
      if (err) {
        console.error("Error updating barber name:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false, 
          error: "Barber not found" 
        });
      }

      res.json({ 
        success: true, 
        message: "Barber name updated successfully" 
      });
    });
  }
);

// Admin: Add new timeslot for a barber
app.post(
  "/api/admin/add-timeslot",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { barberId, time, availableDate } = req.body;
    
    if (!barberId || !time) {
      return res.status(400).json({ 
        success: false, 
        error: "Barber ID and time are required" 
      });
    }

    // Validate time format (basic validation)
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
    if (!timeRegex.test(time.trim())) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid time format. Use format like '09:00 AM' or '02:30 PM'" 
      });
    }

    // Check if timeslot already exists for this barber
    db.get(
      "SELECT id FROM timeslots WHERE barber_id = ? AND time = ?",
      [barberId, time.trim()],
      (err, existing) => {
        if (err) {
          console.error("Error checking existing timeslot:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Database error" 
          });
        }

        if (existing) {
          return res.status(400).json({ 
            success: false, 
            error: "This timeslot already exists for this barber" 
          });
        }

        // Insert new timeslot
        const query = `
          INSERT INTO timeslots (barber_id, time, available_date, is_available) 
          VALUES (?, ?, ?, 1)
        `;
        db.run(query, [barberId, time.trim(), availableDate || null], function(err) {
          if (err) {
            console.error("Error adding timeslot:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          res.json({ 
            success: true, 
            message: "Timeslot added successfully",
            timeslotId: this.lastID
          });
        });
      }
    );
  }
);

// Admin: Delete timeslot
app.post(
  "/api/admin/delete-timeslot",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { timeslotId } = req.body;
    
    if (!timeslotId) {
      return res.status(400).json({ 
        success: false, 
        error: "Timeslot ID is required" 
      });
    }

    // Check if timeslot has any bookings
    db.get(
  "SELECT id FROM bookings WHERE time_id = ? AND status NOT IN ('Done','Cancelled')",
      [timeslotId],
      (err, booking) => {
        if (err) {
          console.error("Error checking timeslot bookings:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Database error" 
          });
        }

        if (booking) {
          return res.status(400).json({ 
            success: false, 
            error: "Cannot delete timeslot with active bookings" 
          });
        }

        // Delete timeslot
        db.run("DELETE FROM timeslots WHERE id = ?", [timeslotId], function(err) {
          if (err) {
            console.error("Error deleting timeslot:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          if (this.changes === 0) {
            return res.status(404).json({ 
              success: false, 
              error: "Timeslot not found" 
            });
          }

          res.json({ 
            success: true, 
            message: "Timeslot deleted successfully" 
          });
        });
      }
    );
  }
);

// Admin: Update timeslot time
app.post(
  "/api/admin/update-timeslot",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { timeslotId, time } = req.body;
    
    if (!timeslotId || !time) {
      return res.status(400).json({ 
        success: false, 
        error: "Timeslot ID and time are required" 
      });
    }

    // Validate time format
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
    if (!timeRegex.test(time.trim())) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid time format. Use format like '09:00 AM' or '02:30 PM'" 
      });
    }

    // Get barber_id for the timeslot
    db.get("SELECT barber_id FROM timeslots WHERE id = ?", [timeslotId], (err, slot) => {
      if (err) {
        console.error("Error getting timeslot:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      if (!slot) {
        return res.status(404).json({ 
          success: false, 
          error: "Timeslot not found" 
        });
      }

      // Check if new time conflicts with existing timeslots for same barber
      db.get(
        "SELECT id FROM timeslots WHERE barber_id = ? AND time = ? AND id != ?",
        [slot.barber_id, time.trim(), timeslotId],
        (err, existing) => {
          if (err) {
            console.error("Error checking time conflict:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Database error" 
            });
          }

          if (existing) {
            return res.status(400).json({ 
              success: false, 
              error: "This time already exists for this barber" 
            });
          }

          // Update timeslot
          db.run("UPDATE timeslots SET time = ? WHERE id = ?", [time.trim(), timeslotId], function(err) {
            if (err) {
              console.error("Error updating timeslot:", err);
              return res.status(500).json({ 
                success: false, 
                error: "Database error" 
              });
            }

            res.json({ 
              success: true, 
              message: "Timeslot updated successfully" 
            });
          });
        }
      );
    });
  }
);

// Admin: Add walk-in booking
app.post(
  "/api/admin/add-walk-in",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const {
      customerName,
      service,
      barberId,
      timeId,
      bookingDate,
    } = req.body;
    if (
      !customerName ||
      !service ||
      !barberId ||
      !timeId ||
      !bookingDate
    ) {
      return res.status(400).json({
        success: false,
        error: "All fields required",
      });
    }

    // For walk-in customers, create a temporary email and user
    const tempEmail = `walkin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@temp.local`;
    const tempPassword = Math.random().toString(36).substring(2, 15);
    
    bcrypt.hash(tempPassword, 10, (hashErr, hashedPassword) => {
      if (hashErr)
        return res
          .status(500)
          .json({ success: false, error: "Password hashing error" });

      db.run(
        "INSERT INTO users (email, password, role, full_name) VALUES (?, ?, 'USER', ?)",
        [tempEmail, hashedPassword, customerName],
        function (userErr) {
          if (userErr)
            return res
              .status(500)
              .json({ success: false, error: "User creation error" });
          
          const userId = this.lastID;
          db.run(
            "INSERT INTO bookings (user_id, service, barber_id, time_id, booking_date, is_walk_in, confirmed_by_admin) VALUES (?, ?, ?, ?, ?, 1, 1)",
            [userId, service, barberId, timeId, bookingDate],
            function (bookingErr) {
              if (bookingErr)
                return res
                  .status(500)
                  .json({ success: false, error: "Database error" });
              res.json({
                success: true,
                message: "Walk-in booking added successfully",
                bookingId: this.lastID,
              });
            }
          );
        }
      );
    });
  }
);

// Admin: Confirm booking (UPDATED to send email)
app.post(
  "/api/admin/confirm-booking",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId)
      return res
        .status(400)
        .json({ success: false, error: "Booking ID required" });

    // Get booking details for email BEFORE updating
    db.get(
      `
      SELECT b.*, u.email, br.name as barber_name, t.time
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      LEFT JOIN timeslots t ON b.time_id = t.id
      WHERE b.id = ?
      `,
      [bookingId],
      (getErr, booking) => {
        if (getErr) return res.status(500).json({ success: false, error: "Database error" });
        if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

        // Update booking status
        db.run(
          "UPDATE bookings SET confirmed_by_admin = 1, status = 'Confirmed' WHERE id = ?",
          [bookingId],
          function (err) {
            if (err)
              return res
                .status(500)
                .json({ success: false, error: "Database error" });
            if (this.changes === 0)
              return res
                .status(404)
                .json({ success: false, error: "Booking not found" });

            // Send confirmation email NOW (when admin confirms)
            if (booking.email) {
              sendBookingConfirmation(booking.email, {
                time: booking.time,
                service: booking.service,
                payment_method: booking.payment_method,
                barber: booking.barber_name,
              });
            }

            // Create notification
            if (booking.user_id) {
              db.run(
                "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
                [
                  booking.user_id,
                  `Your booking for ${booking.service} on ${booking.booking_date} has been confirmed!`,
                  "confirmation",
                ],
                (notifErr) => {
                  if (notifErr) console.error("Notification error:", notifErr);
                }
              );
            }

            res.json({ success: true, message: "Booking confirmed and email sent to customer" });
          }
        );
      }
    );
  }
);

// Superadmin & Admin: Get bookings marked as done with date filtering
app.get(
  "/api/superadmin/done-bookings",
  requireRoles(["SUPERADMIN", "ADMIN"]),
  (req, res) => {
    const { period } = req.query; // 'week', 'month', or 'all'

    let dateFilter = "";
    if (period === "week") {
      dateFilter = "AND b.booked_at >= datetime('now', '-7 days')";
    } else if (period === "month") {
      dateFilter = "AND b.booked_at >= datetime('now', '-30 days')";
    }

    const query = `
    SELECT b.id, u.full_name, b.service, br.name AS barber, t.time, b.booking_date, b.payment_method, b.booked_at, b.is_walk_in, b.status, b.cancelled_by
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN barbers br ON b.barber_id = br.id
    LEFT JOIN timeslots t ON b.time_id = t.id
    WHERE b.status IN ('Done','Cancelled') ${dateFilter}
    ORDER BY b.booked_at DESC
  `;

    db.all(query, [], (err, rows) => {
      if (err) return res.json({ success: false, error: "Database error" });
      res.json({ success: true, bookings: rows });
    });
  }
);

// Superadmin: Get booking statistics
app.get(
  "/api/superadmin/booking-stats",
  requireRole("SUPERADMIN"),
  (req, res) => {
    const { period } = req.query;

    let dateFilter = "";
    if (period === "week") {
      dateFilter = "AND booked_at >= datetime('now', '-7 days')";
    } else if (period === "month") {
      dateFilter = "AND booked_at >= datetime('now', '-30 days')";
    }

    const queries = {
      total: `SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${dateFilter}`,
  completed: `SELECT COUNT(*) as count FROM bookings WHERE status = 'Done' ${dateFilter}`,
      pending: `SELECT COUNT(*) as count FROM bookings WHERE status = 'Pending' ${dateFilter}`,
      walkIn: `SELECT COUNT(*) as count FROM bookings WHERE is_walk_in = 1 ${dateFilter}`,
      online: `SELECT COUNT(*) as count FROM bookings WHERE is_walk_in = 0 ${dateFilter}`,
    };

    const stats = {};
    let completed = 0;

    Object.keys(queries).forEach((key, index) => {
      db.get(queries[key], [], (err, result) => {
        if (err) {
          console.error(`Stats query error for ${key}:`, err);
          stats[key] = 0;
        } else {
          stats[key] = result.count;
        }

        completed++;
        if (completed === Object.keys(queries).length) {
          res.json({ success: true, stats });
        }
      });
    });
  }
);

// Superadmin/Admin: Get service distribution counts for donut chart
app.get(
  "/api/superadmin/service-distribution",
  requireRoles(["SUPERADMIN", "ADMIN"]),
  (req, res) => {
    const { period = 'day' } = req.query;
    
    // Calculate date range based on period
    let dateFilter = '';
    let params = [];
    
    if (period === 'day') {
      dateFilter = "AND date(booking_date) = date('now')"; // Today only for service distribution
    } else if (period === 'week') {
      dateFilter = "AND date(booking_date) >= date('now', '-84 days')"; // 12 weeks = 84 days
    } else if (period === 'month') {
      dateFilter = "AND date(booking_date) >= date('now', '-12 months')";
    }
    
    // Group by lowercased service to merge case variants (e.g., 'HAIRCUT' and 'haircut')
    // Exclude test services from the distribution
    const sql = `SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE 1=1 ${dateFilter} AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC`;
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Failed to fetch service distribution:', err);
        return res.json({ success: false, error: err.message });
      }
      const total = rows.reduce((sum, r) => sum + (r.count || 0), 0);
      // normalize display label to Title Case
      const toTitleCase = (str) => {
        if (!str) return str;
        return str.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      };
      const distribution = rows.map(r => ({ service: toTitleCase(r.service_key), count: r.count }));
      return res.json({ success: true, total, distribution, period });
    });
  }
);

// Superadmin/Admin: Get customer distribution by barber for bar chart
app.get(
  "/api/superadmin/customer-distribution",
  requireRoles(["SUPERADMIN", "ADMIN"]),
  (req, res) => {
    const { period = 'day' } = req.query;
    
    // Calculate date range based on period
    let dateFilter = '';
    
    if (period === 'day') {
      dateFilter = "AND date(bk.booking_date) = date('now')"; // Today only for customer distribution
    } else if (period === 'week') {
      dateFilter = "AND date(bk.booking_date) >= date('now', '-84 days')"; // 12 weeks = 84 days
    } else if (period === 'month') {
      dateFilter = "AND date(bk.booking_date) >= date('now', '-12 months')";
    }
    
    const sql = `
      SELECT 
        b.name as barber_name,
        COUNT(bk.id) as customer_count
      FROM barbers b
      LEFT JOIN bookings bk ON b.id = bk.barber_id AND bk.status = 'Done' ${dateFilter}
      GROUP BY b.id, b.name
      ORDER BY customer_count DESC, b.name ASC
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Failed to fetch customer distribution:', err);
        return res.json({ success: false, error: err.message });
      }
      
      const distribution = rows.map(row => ({
        barber: row.barber_name,
        count: row.customer_count || 0
      }));
      
      const total = distribution.reduce((sum, item) => sum + item.count, 0);
      
      res.json({ 
        success: true, 
        total, 
        distribution,
        period 
      });
    });
  }
);

// Superadmin & Admin: Get analytics data for chart (UPDATED to allow both roles)
app.get(
  "/api/superadmin/analytics",
  requireRoles(["SUPERADMIN", "ADMIN"]), // Allow both SUPERADMIN and ADMIN
  (req, res) => {
    const { period = 'day' } = req.query;
    
    let dateFormat, groupBy, labels;
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        // Last 30 days
        startDate.setDate(startDate.getDate() - 29);
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(booked_at)';
        labels = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        break;
        
      case 'week':
        // Last 12 weeks
        startDate.setDate(startDate.getDate() - (12 * 7));
        dateFormat = '%Y-%W';
        groupBy = 'strftime("%Y-%W", booked_at)';
        labels = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - (i * 7));
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Get start of week (Sunday)
          labels.push(weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        break;
        
      case 'month':
        // Last 12 months
        startDate.setMonth(startDate.getMonth() - 11);
        dateFormat = '%Y-%m';
        groupBy = 'strftime("%Y-%m", booked_at)';
        labels = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }
    
    const sql = `
      SELECT 
        strftime('${dateFormat}', booked_at) as date_group,
        SUM(
          CASE 
            WHEN service = 'HAIRCUT' THEN 250
            WHEN service = 'CUT AND SHAVE' THEN 300
            ELSE 0
          END
        ) as total_sales
      FROM bookings 
      WHERE booked_at >= ? AND status = 'Done'
      GROUP BY ${groupBy}
      ORDER BY date_group ASC
    `;
    
    db.all(sql, [startDate.toISOString()], (err, rows) => {
      if (err) {
        console.error('Analytics query error:', err);
        return res.status(500).json({ error: 'Failed to fetch analytics data' });
      }
      
      if (period === 'week') {
        // For weekly data, generate the expected week keys and map data correctly
        const data = [];
        let currentDate = new Date(startDate);
        
        // Create a map from the database results
        const dataMap = {};
        rows.forEach(row => {
          dataMap[row.date_group] = row.total_sales || 0;
        });
        
        // Generate week keys for each of the 12 weeks using SQLite format
        const weekPromises = [];
        for (let i = 0; i < labels.length; i++) {
          const weekDate = new Date(startDate);
          weekDate.setDate(startDate.getDate() + (i * 7));
          
          weekPromises.push(new Promise((resolve) => {
            db.get(
              "SELECT strftime('%Y-%W', ?) as week_key", 
              [weekDate.toISOString()], 
              (err, result) => {
                if (err) {
                  resolve({ index: i, weekKey: null, value: 0 });
                } else {
                  resolve({ 
                    index: i, 
                    weekKey: result.week_key, 
                    value: dataMap[result.week_key] || 0 
                  });
                }
              }
            );
          }));
        }
        
        Promise.all(weekPromises).then(weekResults => {
          // Sort by index to maintain correct order
          weekResults.sort((a, b) => a.index - b.index);
          const data = weekResults.map(result => result.value);
          
          res.json({
            labels,
            datasets: [{
              data,
              label: 'Sales (₱)'
            }]
          });
        });
        
      } else {
        // Fill in missing dates with 0 for day and month periods
        const dataMap = {};
        rows.forEach(row => {
          dataMap[row.date_group] = row.total_sales || 0;
        });
        
        const data = [];
        let currentDate = new Date(startDate);
        
        for (let i = 0; i < labels.length; i++) {
          let dateKey;
          
          switch (period) {
            case 'day':
              dateKey = currentDate.toISOString().split('T')[0];
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'month':
              dateKey = currentDate.toISOString().substring(0, 7);
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
          }
          
          data.push(dataMap[dateKey] || 0);
        }
        
        res.json({
          labels,
          datasets: [{
            data,
            label: 'Sales (₱)'
          }]
        });
      }
    });
  }
);

// Admin & Superadmin: Cancel booking
app.post(
  "/api/admin/cancel-booking",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId)
      return res.json({ success: false, error: "Missing booking ID" });

    // Get booking details for email BEFORE deleting
    db.get(
      `

      SELECT b.*, u.email, br.name as barber_name, t.time
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN barbers br ON b.barber_id = br.id
      LEFT JOIN timeslots t ON b.time_id = t.id
      WHERE b.id = ?
      `,
      [bookingId],
      (getErr, booking) => {
        if (getErr) return res.status(500).json({ success: false, error: "Database error" });
        if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

          // Mark the booking as cancelled instead of deleting
        db.run(
          "UPDATE bookings SET status = 'Cancelled', cancelled_by = 'ADMIN' WHERE id = ?",
          [bookingId],
          function (err) {
            if (err) return res.json({ success: false, error: "Database error" });
            if (this.changes === 0)
              return res.json({ success: false, error: "Booking not found" });

            // Send cancellation email
            if (booking.email) {
              sendCancellationEmail(booking.email, {
                service: booking.service,
                booking_date: booking.booking_date,
                time: booking.time,
                barber: booking.barber_name,
                cancelled_by: 'ADMIN'
              });
            }

            // Create notification for the user
            if (booking.user_id) {
              db.run(
                "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
                [
                  booking.user_id,
                  `Your booking for ${booking.service} on ${booking.booking_date} has been cancelled by admin. Please reschedule if needed.`,
                  "cancellation",
                ],
                (notifErr) => {
                  if (notifErr) console.error("Notification error:", notifErr);
                }
              );
            }

            res.json({ success: true, message: "Booking cancelled by admin and email sent to customer" });
          }
        );
      }
    );
  }
);

// Admin & Superadmin: Mark booking as done
app.post(
  "/api/admin/mark-done",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId)
      return res.json({ success: false, error: "Missing booking ID" });

    // Update booking status to 'Done'
    db.run(
      "UPDATE bookings SET status = 'Done' WHERE id = ?",
      [bookingId],
      function (err) {
        if (err) return res.json({ success: false, error: "Database error" });
        if (this.changes === 0)
          return res.json({ success: false, error: "Booking not found" });

        // Get booking details for notification
        db.get(
          `SELECT b.*, u.email, br.name as barber_name, t.time
           FROM bookings b
           LEFT JOIN users u ON b.user_id = u.id
           LEFT JOIN barbers br ON b.barber_id = br.id
           LEFT JOIN timeslots t ON b.time_id = t.id
           WHERE b.id = ?`,
          [bookingId],
          (getErr, booking) => {
            if (!getErr && booking && booking.user_id) {
              // Create notification for the user
              db.run(
                "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
                [
                  booking.user_id,
                  `Your booking for ${booking.service} on ${booking.booking_date} has been completed. Thank you for choosing Suave Barbershop!`,
                  "completion",
                ],
                (notifErr) => {
                  if (notifErr) console.error("Notification error:", notifErr);
                }
              );
            }
          }
        );

        res.json({ success: true, message: "Booking marked as done" });
      }
    );
  }
);

// Superadmin: Get all user and admin accounts (except superadmin itself)
app.get("/api/superadmin/accounts", requireRole("SUPERADMIN"), (req, res) => {
  db.all(
    `
    SELECT id, email, role, created_at
    FROM users
    WHERE role != 'SUPERADMIN'
    ORDER BY created_at DESC
  `,
    [],
    (err, rows) => {
      if (err) return res.json({ success: false, error: "Database error" });
      res.json({ success: true, accounts: rows });
    }
  );
});

// Superadmin: Delete account
app.post(
  "/api/superadmin/delete-account",
  requireRole("SUPERADMIN"),
  (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.json({ success: false, error: "Missing user ID" });
    db.run(
      "DELETE FROM users WHERE id = ? AND role != 'SUPERADMIN'",
      [userId],
      function (err) {
        if (err) return res.json({ success: false, error: "Database error" });
        if (this.changes === 0)
          return res.json({
            success: false,
            error: "Account not found or cannot delete SUPERADMIN",
          });
        res.json({ success: true });
      }
    );
  }
);

// Superadmin: Create an admin account
app.post(
  "/api/superadmin/create-admin",
  requireRole("SUPERADMIN"),
  async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, error: "Email and password required" });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        "INSERT INTO users (email, password, role) VALUES (?, ?, 'ADMIN')",
        [email, hashedPassword],
        function (err) {
          if (err)
            return res.status(400).json({ success: false, error: err.message });
          res.json({
            success: true,
            message: "Admin account created",
            id: this.lastID,
          });
        }
      );
    } catch (err) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// Get user info
app.get("/api/user-info", requireLogin, (req, res) => {
  db.get(
    "SELECT id, email, full_name, phone, profile_pic, gender, age, birthday FROM users WHERE id = ?",
    [req.session.user.id],
    (err, user) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      if (!user)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      // Handle new users without profile pictures
      const userData = {
        ...user,
        profile_pic: user.profile_pic || null // Send null for no profile pic
      };
      res.json({ success: true, user: userData });
    }
  );
});

// Role-protected routes
app.get("/api/user-dashboard", requireRole("USER"), (req, res) => {
  res.json({ message: `Welcome USER ${req.session.user.email}` });
});

app.get("/api/admin-dashboard", requireRole("ADMIN"), (req, res) => {
  res.json({ message: `Welcome ADMIN` });
});

// Get admin dashboard stats
app.get(
  "/api/admin/stats",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { period = 'day' } = req.query;
    
    // Calculate date range based on period
    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "AND date(booking_date) = date('now')"; // Today only for stats
    } else if (period === 'week') {
      dateFilter = "AND date(booking_date) >= date('now', '-84 days')"; // 12 weeks = 84 days
    } else if (period === 'month') {
      dateFilter = "AND date(booking_date) >= date('now', '-12 months')";
    }
    
    // Get barber count (not filtered by period)
    db.get("SELECT COUNT(*) as count FROM barbers", (err, barberResult) => {
      if (err) return res.json({ success: false, error: "Database error" });

      // Get total bookings count (filtered by period)
      db.get(
        `SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${dateFilter}`,
        (err2, totalResult) => {
          if (err2)
            return res.json({ success: false, error: "Database error" });

          // Get Haircut service count (filtered by period)
          db.get(
            `SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'haircut' ${dateFilter}`,
            (err3, haircutResult) => {
              if (err3)
                return res.json({ success: false, error: "Database error" });

              // Get Cut and Shave service count (filtered by period)
              db.get(
                `SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'cut and shave' ${dateFilter}`,
                (err4, cutAndShaveResult) => {
                  if (err4)
                    return res.json({ success: false, error: "Database error" });

                  res.json({
                    success: true,
                    stats: {
                      barberCount: barberResult.count,
                      totalBookings: totalResult.count,
                      haircutCount: haircutResult.count,
                      cutAndShaveCount: cutAndShaveResult.count,
                    },
                    period
                  });
                }
              );
            }
          );
        }
      );
    });
  }
);

app.get("/api/superadmin-dashboard", requireRole("SUPERADMIN"), (req, res) => {
  res.json({ message: `Welcome SUPERADMIN` });
});

// Complete payment for a booking
app.post("/api/complete-payment", requireLogin, (req, res) => {
  const { bookingId, payment_method } = req.body;
  if (!bookingId || !payment_method) {
    return res
      .status(400)
      .json({ success: false, error: "Missing booking ID or payment method" });
  }
  db.run(
    "UPDATE bookings SET payment_method = ?, status = 'Paid' WHERE id = ?",
    [payment_method, bookingId],
    function (err) {
      if (err) {
        console.error("Complete payment DB error:", err.message); // <-- Add this line
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      res.json({ success: true, message: "Payment completed!" });
    }
  );
});

// Cancel booking API
app.post("/api/cancel-booking", requireLogin, (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId)
    return res
      .status(400)
      .json({ success: false, error: "Missing booking ID" });
  // Mark booking as cancelled by user
  db.run(
    "UPDATE bookings SET status = 'Cancelled', cancelled_by = 'USER' WHERE id = ? AND user_id = ?",
    [bookingId, req.session.user.id],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      if (this.changes === 0)
        return res
          .status(404)
          .json({ success: false, error: "Booking not found or not yours" });

      // Optionally notify admins about user cancellation
      db.all("SELECT id FROM users WHERE role IN ('ADMIN','SUPERADMIN')", [], (aErr, admins) => {
        if (!aErr && admins && admins.length) {
          admins.forEach(adm => {
            db.run(
              "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)",
              [adm.id, `A user cancelled a booking (ID: ${bookingId}).`, 'cancellation'],
              (nErr) => { if (nErr) console.error('Admin notify error:', nErr); }
            );
          });
        }
      });

      res.json({ success: true, message: "Booking cancelled" });
    }
  );
});

// Update profile picture
app.post("/api/update-profile-pic", (req, res) => {
  console.log("Profile pic upload request received");
  console.log("Session user:", req.session.user);
  console.log("Request body keys:", Object.keys(req.body));
  console.log("Content-Type:", req.headers['content-type']);
  
  if (!req.session.user) {
    console.log("No session user found");
    return res.status(401).json({ success: false, error: "Login required" });
  }
  
  const { imageData } = req.body;
  if (!imageData) {
    console.log("No image data provided");
    return res.status(400).json({ success: false, error: "No image data provided" });
  }
  
  console.log("Image data length:", imageData.length);
  console.log("Image data starts with:", imageData.substring(0, 50));
  
  const userId = req.session.user.id;
  
  db.run(
    "UPDATE users SET profile_pic = ? WHERE id = ?",
    [imageData, userId],
    function (err) {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ success: false, error: "Database error: " + err.message });
      }
      
      console.log("Profile picture updated successfully for user:", userId);
      // Update session data
      req.session.user.profile_pic = imageData;
      
      res.json({ 
        success: true, 
        message: "Profile picture updated successfully",
        profilePic: imageData 
      });
    }
  );
});

// Update user profile
app.post("/api/update-profile", requireLogin, (req, res) => {
  const { full_name, phone, gender, age, birthday } = req.body;
  let query = "UPDATE users SET ";
  let params = [];
  let updates = [];

  if (full_name !== undefined) {
    updates.push("full_name = ?");
    params.push(full_name);
  }
  if (phone !== undefined) {
    updates.push("phone = ?");
    params.push(phone);
  }
  if (gender !== undefined) {
    updates.push("gender = ?");
    params.push(gender);
  }
  if (age !== undefined) {
    updates.push("age = ?");
    params.push(age);
  }
  if (birthday !== undefined) {
    updates.push("birthday = ?");
    params.push(birthday);
  }
  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: "At least one field is required" });
  }
  query += updates.join(", ") + " WHERE id = ?";
  params.push(req.session.user.id);

  db.run(query, params, function (err) {
    if (err)
      return res.status(500).json({ success: false, error: "Database error" });
    res.json({ success: true, message: "Profile updated successfully" });
  });
});

// Change password
app.post("/api/change-password", requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, error: "Current and new password required" });
  }

  // Get current user password
  db.get(
    "SELECT password FROM users WHERE id = ?",
    [req.session.user.id],
    async (err, user) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      if (!user)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });

      // Verify current password
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res
          .status(401)
          .json({ success: false, error: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedNewPassword, req.session.user.id],
        function (updateErr) {
          if (updateErr)
            return res
              .status(500)
              .json({ success: false, error: "Database error" });
          res.json({ success: true, message: "Password changed successfully" });
        }
      );
    }
  );
});

// Get payment QR code
app.post("/api/get-payment-qr", requireLogin, async (req, res) => {
  const { method } = req.body;
  if (!method) {
    return res
      .status(400)
      .json({ success: false, error: "Payment method required" });
  }

  // Get QR code from database
  db.get(
    "SELECT qr_code_data FROM qr_settings WHERE payment_method = ?",
    [method],
    (err, row) => {
      if (err) {
        return res.json({ success: false, error: "Database error" });
      }

      if (!row) {
        return res.json({ success: false, error: "QR code not configured" });
      }

      res.json({
        success: true,
        qrCode: row.qr_code_data,
      });
    }
  );
});

// Admin: Get all QR settings
app.get(
  "/api/admin/qr-settings",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    db.all("SELECT * FROM qr_settings ORDER BY payment_method", (err, rows) => {
      if (err) {
        return res.json({ success: false, error: "Database error" });
      }
      res.json({ success: true, qrSettings: rows });
    });
  }
);

// Admin: Update QR code setting
app.post(
  "/api/admin/update-qr-setting",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { payment_method, qr_code_data } = req.body;

    if (!payment_method || !qr_code_data) {
      return res.json({
        success: false,
        error: "Payment method and QR code data required",
      });
    }

    // Validate payment method
    if (!["gcash", "paymaya"].includes(payment_method)) {
      return res.json({ success: false, error: "Invalid payment method" });
    }

    db.run(
      `INSERT OR REPLACE INTO qr_settings (payment_method, qr_code_data, updated_at) 
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [payment_method, qr_code_data],
      function (err) {
        if (err) {
          return res.json({ success: false, error: "Database error" });
        }
        res.json({ success: true, message: "QR code updated successfully" });
      }
    );
  }
);

// Get user notifications
app.get("/api/notifications", requireLogin, (req, res) => {
  db.all(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [req.session.user.id],
    (err, notifications) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      res.json({ success: true, notifications });
    }
  );
});

// Mark notification as read
app.post("/api/notifications/mark-read", requireLogin, (req, res) => {
  const { notificationId } = req.body;
  if (!notificationId) {
    return res
      .status(400)
      .json({ success: false, error: "Notification ID required" });
  }

  db.run(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
    [notificationId, req.session.user.id],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      res.json({ success: true });
    }
  );
});

// Mark all notifications as read for current user
app.post("/api/notifications/mark-all-read", requireLogin, (req, res) => {
  db.run(
    "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
    [req.session.user.id],
    function (err) {
      if (err)
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      res.json({ success: true });
    }
  );
});

// ---------------- FRONTEND ROUTES ----------------

// Add root route handler
app.get("/", (req, res) => {
  // Redirect to main page for landing
  res.redirect("/main");
});

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);
app.get("/home", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "homepage.html"))
);
app.get("/homepage", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "homepage.html"))
);
app.get("/main", (req, res) => res.sendFile(path.join(__dirname, "public", "main.html")));
app.get("/admin", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("/qr-settings", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "qr-settings.html"));
});

app.get(
  "/barber-management",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "public", "barber-management.html"));
  }
);
app.get("/superadmin", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "superadmin.html"))
);
app.get("/profile", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profile.html"))
);
app.get("/about", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "about.html"))
);
app.get("/barber", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "barber.html"))
);
app.get("/services", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "services.html"))
);
app.get("/view-bookings", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "view-bookings.html"))
);
app.get("/test", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "test.html"))
);
app.get("/forgot", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "forgot.html"))
);
app.get("/changepass", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "changepass.html"))
);
app.get("/mybookings", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mybookings.html"));
});
app.get("/payment", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "payment.html"));
});
app.get("/contact", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contact.html"));
});
app.get("/appointments", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "appointments.html"));
});
app.get("/superadappointments", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "superadappointments.html"));
});
app.get("/weeklyreports", requireRole("SUPERADMIN"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "weeklyreports.html"));
});
app.get("/manageaccounts", requireRole("SUPERADMIN"), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manageaccounts.html"));
});
app.get("/schedule", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  res.sendFile(path.join(__dirname, "public", "schedule.html"));
});
app.get(
  "/superadminbarber",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "public", "superadminbarber.html"));
  }
);

// Select service endpoint (add this before the frontend routes section)
app.post("/api/select-service", requireLogin, (req, res) => {
  const { service } = req.body;
  
  if (!service) {
    return res.status(400).json({ success: false, error: "Service is required" });
  }
  
  // Store service in session
  req.session.selectedService = service;
  
  res.json({ success: true, message: "Service selected successfully" });
});

// Add the missing forgot password API endpoints here (before 404 handlers)
// Store for temporary reset codes (in production, use Redis or database)
const resetCodes = new Map(); // { email: { code, timestamp, verified } }
const resetTokens = new Map(); // { token: { email, timestamp } }
// Store for temporary signup verifications (in production, use Redis or DB table)
const pendingSignups = new Map(); // { email: { full_name, passwordHash, role, code, timestamp } }

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate reset token
function generateResetToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Forgot password - Send verification code
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  // Check if user exists
  db.get("SELECT id, email FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: "If email exists, verification code will be sent" });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const timestamp = Date.now();
    
    // Store code temporarily (expires in 10 minutes)
    resetCodes.set(email, {
      code: verificationCode,
      timestamp: timestamp,
      verified: false
    });

    // Clean up expired codes (optional cleanup)
    setTimeout(() => {
      const stored = resetCodes.get(email);
      if (stored && stored.timestamp === timestamp) {
        resetCodes.delete(email);
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Send verification code via email using Resend
    try {
      const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #cf0c02;">Password Reset Request</h2>
            <p>Dear Customer,</p>
            <p>You have requested to reset your password for your Suave Barbershop account.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin-top: 0; color: #333;">Your Verification Code:</h3>
              <div style="font-size: 32px; font-weight: bold; color: #cf0c02; letter-spacing: 5px; margin: 20px 0;">
                ${verificationCode}
              </div>
              <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes</p>
            </div>
            <p>If you did not request this password reset, please ignore this email.</p>
            <p>Best regards,<br><strong>Suave Barbershop Team</strong></p>
          </div>
        `;

      const emailResult = await sendEmail(
        email, 
        "Password Reset Verification Code - Suave Barbershop", 
        emailHtml
      );

      if (!emailResult.success) {
        throw new Error(emailResult.error);
      }
      
      console.log(`Verification code sent to ${email}: ${verificationCode}`); // Debug log
      res.json({ success: true, message: "Verification code sent to your email" });
    } catch (emailError) {
      console.error("Email error:", emailError);
      resetCodes.delete(email); // Clean up on email failure
      res.status(500).json({ success: false, error: "Failed to send verification email" });
    }
  });
});

// Signup start - send verification code and store pending signup
app.post('/api/signup-start', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    // Basic email format check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('DB error checking user exists:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }

      if (row) {
        // For privacy, reply with a generic success message (avoid revealing existence)
        return res.json({ success: true, message: 'If the email is not registered, a verification code has been sent' });
      }

      // Rate limit: prevent re-sending code too often
      const existing = pendingSignups.get(email);
      const now = Date.now();
      if (existing && now - existing.timestamp < 60 * 1000) {
        return res.status(429).json({ success: false, error: 'Please wait before requesting another code' });
      }

      // Hash password now and store temporarily
      const passwordHash = await bcrypt.hash(password, 10);
      const code = generateVerificationCode();
      const timestamp = Date.now();

      pendingSignups.set(email, {
        full_name,
        passwordHash,
        role: 'USER',
        code,
        timestamp
      });

      // Send verification email (reuse style from forgot-password earlier)
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #cf0c02;">Verify your Email Address</h2>
          <p>Hello ${full_name || 'Customer'},</p>
          <p>Thank you for registering at Suave Barbershop. Use the verification code below to complete your registration. This code will expire in 10 minutes.</p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #333;">Your Verification Code:</h3>
            <div style="font-size: 32px; font-weight: bold; color: #cf0c02; letter-spacing: 5px; margin: 20px 0;">${code}</div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes</p>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br><strong>Suave Barbershop Team</strong></p>
        </div>
      `;

      const result = await sendEmail(email, 'Verify your email - Suave Barbershop', emailHtml);
      if (!result.success) {
        pendingSignups.delete(email);
        console.error('Signup verification email error:', result.error);
        return res.status(500).json({ success: false, error: 'Failed to send verification email' });
      }

      // Clean up pending after 10 minutes
      setTimeout(() => {
        const stored = pendingSignups.get(email);
        if (stored && stored.timestamp === timestamp) pendingSignups.delete(email);
      }, 10 * 60 * 1000);

      return res.json({ success: true, message: 'Verification code sent to email' });
    });
  } catch (error) {
    console.error('Signup start error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Signup verify - verify code and create user
app.post('/api/signup-verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: 'Email and code are required' });

    const stored = pendingSignups.get(email);
    if (!stored) return res.status(400).json({ success: false, error: 'No pending signup found or code expired' });

    const now = Date.now();
    if (now - stored.timestamp > 10 * 60 * 1000) {
      pendingSignups.delete(email);
      return res.status(400).json({ success: false, error: 'Verification code expired' });
    }

    if (stored.code !== code) return res.status(400).json({ success: false, error: 'Invalid verification code' });

    // Create user in DB
    db.run(
      'INSERT INTO users (email, password, role, full_name, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [email, stored.passwordHash, stored.role || 'USER', stored.full_name || ''],
      function(err) {
        if (err) {
          console.error('Error creating user after verification:', err);
          return res.status(500).json({ success: false, error: 'Database error creating user' });
        }

        // Clean up
        pendingSignups.delete(email);

        return res.json({ success: true, message: 'Account created successfully' });
      }
    );
  } catch (error) {
    console.error('Signup verify error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Verify reset code
app.post("/api/verify-reset-code", (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and code are required" });
  }

  const stored = resetCodes.get(email);
  
  if (!stored) {
    return res.status(400).json({ success: false, error: "No verification code found. Please request a new one." });
  }

  // Check if code expired (10 minutes)
  const now = Date.now();
  const codeAge = now - stored.timestamp;
  if (codeAge > 10 * 60 * 1000) {
    resetCodes.delete(email);
    return res.status(400).json({ success: false, error: "Verification code has expired. Please request a new one." });
  }

  // Verify code
  if (stored.code !== code) {
    return res.status(400).json({ success: false, error: "Invalid verification code" });
  }

  // Mark as verified and generate reset token
  const resetToken = generateResetToken();
  const tokenTimestamp = Date.now();
  
  // Store reset token (expires in 15 minutes)
  resetTokens.set(resetToken, {
    email: email,
    timestamp: tokenTimestamp
  });

  // Mark code as verified
  stored.verified = true;
  resetCodes.set(email, stored);

  // Clean up token after 15 minutes
  setTimeout(() => {
    const storedToken = resetTokens.get(resetToken);
    if (storedToken && storedToken.timestamp === tokenTimestamp) {
      resetTokens.delete(resetToken);
    }
  }, 15 * 60 * 1000); // 15 minutes

  res.json({ 
    success: true, 
    message: "Code verified successfully",
    token: resetToken 
  });
});

// Debug endpoint: send a test email and return Resend response (protected by DEBUG_EMAIL_TOKEN)
app.post('/debug/send-test-email', async (req, res) => {
  const token = req.query.token || req.headers['x-debug-token'];
  const expected = process.env.DEBUG_EMAIL_TOKEN || 'dev-debug-token-please-change';
  if (!token || token !== expected) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const { to, subject, html } = req.body || {};
  if (!to) return res.status(400).json({ success: false, error: 'Recipient (to) is required in JSON body' });

  try {
    const sendResult = await sendEmail(
      to,
      subject || 'Test email from Suave Barbershop',
      html || `<div style="font-family: Arial;">This is a test email from Suave Barbershop at ${new Date().toISOString()}</div>`
    );

    // Return full send result (including raw Resend response)
    return res.json({ success: true, sendResult });
  } catch (err) {
    console.error('Debug send failed:', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Reset password with token
app.post("/api/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  if (!email || !token || !newPassword) {
    return res.status(400).json({ success: false, error: "Email, token, and new password are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters long" });
  }

  const storedToken = resetTokens.get(token);
  
  if (!storedToken) {
    return res.status(400).json({ success: false, error: "Invalid or expired reset token" });
  }

  if (storedToken.email !== email) {
    return res.status(400).json({ success: false, error: "Token does not match email" });
  }

  // Check if token expired (15 minutes)
  const now = Date.now();
  const tokenAge = now - storedToken.timestamp;
  if (tokenAge > 15 * 60 * 1000) {
    resetTokens.delete(token);
    return res.status(400).json({ success: false, error: "Reset token has expired. Please start the process again." });
  }

  // Check if verification code was actually verified
  const stored = resetCodes.get(email);
  if (!stored || !stored.verified) {
    return res.status(400).json({ success: false, error: "Verification code was not properly verified" });
  }

  try {
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    db.run(
      "UPDATE users SET password = ? WHERE email = ?",
      [hashedPassword, email],
      function (err) {
        if (err) {
          console.error("Password update error:", err);
          return res.status(500).json({ success: false, error: "Database error" });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        // Clean up stored codes and tokens
        resetCodes.delete(email);
        resetTokens.delete(token);

        // Send confirmation email using Resend
        if (isEmailServiceAvailable()) {
          sendEmail(
            email,
            "Password Reset Successful - Suave Barbershop",
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #cf0c02;">Password Reset Successful</h2>
              <p>Dear Customer,</p>
              <p>Your password has been successfully reset for your Suave Barbershop account.</p>
              <p>You can now log in with your new password.</p>
              <p>If you did not make this change, please contact us immediately.</p>
              <p>Best regards,<br><strong>Suave Barbershop Team</strong></p>
            </div>
            `
          ).catch(err => console.error("Confirmation email error:", err));
        }

        res.json({ 
          success: true, 
          message: "Password reset successfully. You can now log in with your new password." 
        });
      }
    );
  } catch (error) {
    console.error("Password hashing error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Admin: Get barber timeslots with availability info
app.get(
  "/api/admin/barber-timeslots/:barberId",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const barberId = parseInt(req.params.barberId, 10);
    
    if (isNaN(barberId)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid barber ID" 
      });
    }

    const query = `
      SELECT 
        t.id,
        t.time,
        t.is_available as default_available,
        t.available_date,
        CASE 
          WHEN ta.is_available IS NOT NULL THEN ta.is_available
          ELSE t.is_available 
        END as is_available,
        COUNT(b.id) as booking_count,
        GROUP_CONCAT(
          CASE 
            WHEN b.booking_date IS NOT NULL 
            THEN b.booking_date || ' (' || COALESCE(u.email, 'Walk-in') || ')' 
          END
        ) as bookings
      FROM timeslots t
      LEFT JOIN timeslot_availability ta ON t.id = ta.timeslot_id 
      LEFT JOIN bookings b ON t.id = b.time_id AND b.status NOT IN ('Done', 'Cancelled')
      LEFT JOIN users u ON b.user_id = u.id
      WHERE t.barber_id = ?
      GROUP BY t.id, t.time, t.is_available, t.available_date, ta.is_available
      ORDER BY t.time
    `;

    db.all(query, [barberId], (err, rows) => {
      if (err) {
        console.error("Error fetching barber timeslots:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      res.json({ 
        success: true, 
        timeslots: rows 
      });
    });
  }
);

// Admin: Get available barbers by date (with available timeslots)
app.get(
  "/api/admin/available-barbers/:date",
  requireRoles(["ADMIN", "SUPERADMIN"]),
  (req, res) => {
    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date is required"
      });
    }

    // Get barbers who are present on the given date AND have available timeslots
    const query = `
      SELECT DISTINCT b.id, b.name, b.profile_pic
      FROM barbers b
      INNER JOIN timeslots t ON b.id = t.barber_id
      LEFT JOIN timeslot_availability ta ON t.id = ta.timeslot_id AND ta.date = ?
      LEFT JOIN bookings bk ON t.id = bk.time_id AND bk.booking_date = ? AND bk.status != 'Cancelled'
      WHERE 
        -- Barber is present (either globally present or specifically available on this date)
        (b.is_present = 1 OR ta.is_available = 1)
        -- Timeslot is not booked
        AND bk.id IS NULL
        -- If there's a specific availability record for this date, it must be available
        AND (ta.id IS NULL OR ta.is_available = 1)
      ORDER BY b.name
    `;
    
    db.all(query, [date, date], (err, barbers) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          error: "Database error"
        });
      }
      
      res.json({
        success: true,
        barbers: barbers
      });
    });
  }
);

// Admin: Add new barber (missing endpoint)
app.post("/api/admin/add-barber", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { name, contact } = req.body;
  
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: "Barber name must be at least 2 characters long" 
    });
  }

  // Validate contact number if provided
  if (contact && contact.trim() && !/^[+]?[0-9\s\-\(\)]{7,15}$/.test(contact.trim())) {
    return res.status(400).json({ 
      success: false, 
      error: "Please enter a valid contact number (7-15 digits)" 
    });
  }

  // Check if barber name already exists
  db.get("SELECT id FROM barbers WHERE name = ?", [name.trim()], (err, existing) => {
    if (err) {
      console.error("Error checking barber name:", err);
      return res.status(500).json({ 
        success: false, 
        error: "Database error" 
      });
    }

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: "A barber with this name already exists" 
      });
    }

    // Insert new barber (store optional contact, age, gender, birthday if present)
    const contactVal = contact && contact.trim() ? contact.trim() : null;
    const ageVal = req.body.age || null;
    const genderVal = req.body.gender || null;
    const birthdayVal = req.body.birthday || null;

    db.run(
      "INSERT INTO barbers (name, contact_number, is_present, age, gender, birthday) VALUES (?, ?, 1, ?, ?, ?)",
      [name.trim(), contactVal, ageVal, genderVal, birthdayVal],
      function (err) {
        if (err) {
          console.error("Error adding barber:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Database error" 
          });
        }

        res.json({ 
          success: true, 
          message: "Barber added successfully",
          barberId: this.lastID
        });
      }
    );
  });
});

// Admin: Delete barber (missing endpoint)
app.post("/api/admin/delete-barber", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { barberId } = req.body;
  
  if (!barberId) {
    return res.status(400).json({ 
      success: false, 
      error: "Barber ID is required" 
    });
  }

  // Check if barber has active bookings
  db.get(
    "SELECT COUNT(*) as count FROM bookings WHERE barber_id = ? AND status NOT IN ('Done', 'Cancelled')",
    [barberId],
    (err, result) => {
      if (err) {
        console.error("Error checking barber bookings:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Database error" 
        });
      }

      if (result.count > 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Cannot delete barber with active bookings. Please cancel or complete all bookings first." 
        });
      }

      // Delete barber (this will cascade delete timeslots due to foreign key)
      db.run("DELETE FROM barbers WHERE id = ?", [barberId], function (err) {
        if (err) {
          console.error("Error deleting barber:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Database error" 
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({ 
            success: false, 
            error: "Barber not found" 
          });
        }

        res.json({ 
          success: true, 
          message: "Barber deleted successfully" 
        });
      });
    }
  );
});

// Admin: Get available barbers for changing booking (exclude current booking's barber at that time)
app.get("/api/admin/available-barbers-for-change", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { time, date } = req.query;
  
  if (!time || !date) {
    return res.status(400).json({ 
      success: false, 
      error: "Time and date are required" 
    });
  }

  // Get all barbers who are available for the given time and date (excluding already booked ones)
  const query = `
    SELECT DISTINCT b.id, b.name 
    FROM barbers b
    JOIN timeslots t ON b.id = t.barber_id 
    WHERE t.time = ? 
    AND b.id NOT IN (
      SELECT DISTINCT bk.barber_id 
      FROM bookings bk 
      JOIN timeslots ts ON bk.time_id = ts.id 
      WHERE ts.time = ? 
      AND bk.booking_date = ? 
      AND bk.status != 'Cancelled'
    )
    ORDER BY b.name
  `;
  
  db.all(query, [time, time, date], (err, barbers) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to fetch available barbers" 
      });
    }
    
    res.json({ 
      success: true, 
      barbers: barbers || [] 
    });
  });
});

// Admin: Change booking barber
app.post("/api/admin/change-booking-barber", requireRoles(["ADMIN", "SUPERADMIN"]), (req, res) => {
  const { bookingId, newBarberId } = req.body;
  
  if (!bookingId || !newBarberId) {
    return res.status(400).json({ 
      success: false, 
      error: "Booking ID and new barber ID are required" 
    });
  }

  // First, get the booking details to verify it exists and get the time
  db.get(
    `SELECT bk.*, ts.time, ts.barber_id as current_barber_id 
     FROM bookings bk 
     JOIN timeslots ts ON bk.time_id = ts.id 
     WHERE bk.id = ?`,
    [bookingId],
    (err, booking) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ 
          success: false, 
          error: "Failed to fetch booking details" 
        });
      }
      
      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: "Booking not found" 
        });
      }

      // Check if the new barber is available for this time and date
      const availabilityQuery = `
        SELECT ts.id as timeslot_id 
        FROM timeslots ts 
        WHERE ts.barber_id = ? 
        AND ts.time = ?
        AND ts.id NOT IN (
          SELECT bk.time_id 
          FROM bookings bk 
          WHERE bk.booking_date = ? 
          AND bk.status != 'Cancelled'
          AND bk.id != ?
        )
        LIMIT 1
      `;

      db.get(availabilityQuery, [newBarberId, booking.time, booking.booking_date, bookingId], (err, availableSlot) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ 
            success: false, 
            error: "Failed to check barber availability" 
          });
        }
        
        if (!availableSlot) {
          return res.status(400).json({ 
            success: false, 
            error: "Selected barber is not available for this time and date" 
          });
        }

        // Update the booking with the new barber's timeslot
        const updateQuery = `
          UPDATE bookings 
          SET barber_id = ?, time_id = ? 
          WHERE id = ?
        `;

        db.run(updateQuery, [newBarberId, availableSlot.timeslot_id, bookingId], function(err) {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ 
              success: false, 
              error: "Failed to update booking barber" 
            });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ 
              success: false, 
              error: "Booking not found or no changes made" 
            });
          }

          res.json({ 
            success: true, 
            message: "Booking barber changed successfully" 
          });
        });
      });
    }
  );
});

// ---------------- 404 HANDLERS (LAST) ----------------
app.use("/api", (req, res) =>
   res.status(404).json({ error: "API endpoint not found" })
);
app.use((req, res) => res.status(404).send("Page not found"));

// ---------------- START SERVER ----------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Suave Barbershop Server Started`);
  console.log(`📊 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email: ${isEmailServiceAvailable() ? 'Resend Ready ✅' : 'Not configured ⚠️'}`);
  console.log(`💾 Database: Connected`);
  console.log(`🌐 Server ready to accept connections!`);
  
  // Check email service on startup
  checkEmailService();
});

