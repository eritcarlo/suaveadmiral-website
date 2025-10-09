// Database migration script to add missing columns
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "barbershop.db");
const db = new sqlite3.Database(dbPath);

console.log("🔄 Running database migration...");

// Function to add column if it doesn't exist
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  return new Promise((resolve, reject) => {
    db.get(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
          reject(err);
          return;
        }

        const columnExists = columns.some((col) => col.name === columnName);

        if (!columnExists) {
          console.log(`➕ Adding column ${columnName} to ${tableName}`);
          db.run(
            `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
            (err) => {
              if (err) {
                console.error(
                  `❌ Error adding ${columnName} to ${tableName}:`,
                  err.message
                );
                reject(err);
              } else {
                console.log(`✅ Added ${columnName} to ${tableName}`);
                resolve();
              }
            }
          );
        } else {
          console.log(`ℹ️ Column ${columnName} already exists in ${tableName}`);
          resolve();
        }
      });
    });
  });
}

// Function to create table if it doesn't exist
function createTableIfNotExists(tableName, createStatement) {
  return new Promise((resolve, reject) => {
    db.run(createStatement, (err) => {
      if (err) {
        console.error(`❌ Error creating ${tableName}:`, err.message);
        reject(err);
      } else {
        console.log(`✅ Table ${tableName} is ready`);
        resolve();
      }
    });
  });
}

async function migrate() {
  try {
    // Add columns to users table
    await addColumnIfNotExists("users", "full_name", "TEXT");
    await addColumnIfNotExists("users", "phone", "TEXT");
    await addColumnIfNotExists("users", "profile_pic", "TEXT");

    // Add columns to timeslots table
    await addColumnIfNotExists("timeslots", "available_date", "DATE");
    await addColumnIfNotExists(
      "timeslots",
      "is_available",
      "BOOLEAN DEFAULT 1"
    );

    // Add new columns to barbers for profile info
    await addColumnIfNotExists("barbers", "age", "INTEGER");
    await addColumnIfNotExists("barbers", "gender", "TEXT");
    await addColumnIfNotExists("barbers", "birthday", "DATE");

    // Add columns to bookings table
    await addColumnIfNotExists("bookings", "booking_date", "DATE");
    await addColumnIfNotExists("bookings", "is_walk_in", "BOOLEAN DEFAULT 0");
    await addColumnIfNotExists(
      "bookings",
      "confirmed_by_admin",
      "BOOLEAN DEFAULT 0"
    );
    await addColumnIfNotExists("bookings", "reference_number", "TEXT");

    // Create notifications table
    await createTableIfNotExists(
      "notifications",
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
    `
    );

    console.log("🎉 Database migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    db.close();
  }
}

migrate();
