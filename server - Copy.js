// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;

// ---------------- DATABASE ----------------
const dbPath = path.join(__dirname, "barbershop.db");
const db = new sqlite3.Database(dbPath, err => {
  if (err) console.error("❌ Could not connect to database:", err);
  else console.log("✅ Connected to SQLite database at", dbPath);
});

// Create users table with role
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('USER','ADMIN','SUPERADMIN')) NOT NULL DEFAULT 'USER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert default ADMIN and SUPERADMIN if not exists
async function insertDefaultUsers() {
  const defaults = [
    { email: "admin@example.com", password: "admin123", role: "ADMIN" },
    { email: "superadmin@example.com", password: "super123", role: "SUPERADMIN" }
  ];

  for (const user of defaults) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    db.get("SELECT * FROM users WHERE email = ?", [user.email], (err, row) => {
      if (err) return console.error("DB check error:", err);

      if (!row) {
        db.run(
          "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
          [user.email, hashedPassword, user.role],
          err2 => {
            if (err2) console.error("Insert error:", err2);
            else console.log(`✅ Default ${user.role} added: ${user.email} (pw: ${user.password})`);
          }
        );
      } else {
        console.log(`ℹ️ ${user.role} already exists: ${user.email}`);
      }
    });
  }
}
insertDefaultUsers();



// ---------------- MIDDLEWARE ----------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: "your_secret_key_here", // change in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
  })
);

// Serve static files
app.use(express.static(__dirname));

// ---------------- HELPERS ----------------
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "You must be logged in" });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "You must be logged in" });
    if (req.session.user.role !== role) return res.status(403).json({ error: "Access denied" });
    next();
  };
}

// ---------------- API ROUTES ----------------
// Register (always USER)
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO users (email, password, role) VALUES (?, ?, ?)";
    db.run(query, [email, hashedPassword, "USER"], function (err) {
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
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const query = "SELECT * FROM users WHERE email = ?";
  db.get(query, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.json({ message: "Login successful", user: req.session.user });
  });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

// Role-protected routes
app.get("/api/user-dashboard", requireRole("USER"), (req, res) => {
  res.json({ message: `Welcome USER ${req.session.user.email}` });
});

app.get("/api/admin-dashboard", requireRole("ADMIN"), (req, res) => {
  res.json({ message: `Welcome ADMIN ${req.session.user.email}` });
});

app.get("/api/superadmin-dashboard", requireRole("SUPERADMIN"), (req, res) => {
  res.json({ message: `Welcome SUPERADMIN ${req.session.user.email}` });
});

// ---------------- FRONTEND ROUTES ----------------
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "homepage.html"));
});
app.get("/main", (req, res) => {
  res.sendFile(path.join(__dirname, "main.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});
app.get("/superadmin", (req, res) => {
  res.sendFile(path.join(__dirname, "superadmin.html"));
});

// 404s
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found" }));
app.use((req, res) => res.status(404).send("Page not found"));

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
