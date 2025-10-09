// view-users.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Connect to your database
const db = new sqlite3.Database(path.join(__dirname, "barbershop.db"), (err) => {
  if (err) {
    console.error("❌ Could not connect to database:", err.message);
    process.exit(1);
  }
});

// Query all users
db.all("SELECT id, email, password, created_at FROM users", (err, rows) => {
  if (err) {
    console.error("Error fetching users:", err.message);
  } else {
    console.log("=== Registered Users ===");
    rows.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Registered At: ${user.created_at}`);
      console.log("----------------------------");
    });
  }
  db.close();
});
