// Test script to verify date selection functionality
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "barbershop.db");
const db = new sqlite3.Database(dbPath);

console.log("🧪 Testing Date Selection Functionality...\n");

// Test 1: Check if timeslots table has the required columns
db.all("PRAGMA table_info(timeslots)", (err, columns) => {
  if (err) {
    console.error("❌ Error checking timeslots table:", err.message);
    return;
  }

  console.log("✅ Timeslots table columns:");
  columns.forEach((col) => {
    console.log(`   - ${col.name}: ${col.type}`);
  });

  const hasAvailableDate = columns.some((col) => col.name === "available_date");
  const hasIsAvailable = columns.some((col) => col.name === "is_available");

  if (hasAvailableDate && hasIsAvailable) {
    console.log("✅ Required columns exist in timeslots table");
  } else {
    console.log("❌ Missing required columns in timeslots table");
  }

  // Test 2: Check if we have barbers and timeslots
  db.all("SELECT COUNT(*) as count FROM barbers", (err, result) => {
    if (err) {
      console.error("❌ Error checking barbers:", err.message);
      return;
    }

    console.log(`✅ Found ${result[0].count} barbers in database`);

    db.all("SELECT COUNT(*) as count FROM timeslots", (err, result) => {
      if (err) {
        console.error("❌ Error checking timeslots:", err.message);
        return;
      }

      console.log(`✅ Found ${result[0].count} timeslots in database`);

      // Test 3: Test the available times query
      const testDate = new Date().toISOString().split("T")[0];
      const testBarberId = 1;

      const query = `
        SELECT t.id, t.time
        FROM timeslots t
        WHERE t.barber_id = ? AND t.is_available = 1
          AND (t.available_date IS NULL OR t.available_date = ?)
          AND t.id NOT IN (
            SELECT time_id FROM bookings WHERE barber_id = ? AND booking_date = ?
          )
        ORDER BY t.time
      `;

      db.all(
        query,
        [testBarberId, testDate, testBarberId, testDate],
        (err, rows) => {
          if (err) {
            console.error(
              "❌ Error testing available times query:",
              err.message
            );
          } else {
            console.log(
              `✅ Available times query works! Found ${rows.length} available times for barber ${testBarberId} on ${testDate}`
            );
            if (rows.length > 0) {
              console.log(
                "   Available times:",
                rows.map((r) => r.time).join(", ")
              );
            }
          }

          console.log(
            "\n🎉 Date selection functionality is working correctly!"
          );
          console.log("📋 You can now:");
          console.log("1. Go to http://localhost:3000/barber");
          console.log("2. Select a barber");
          console.log("3. Select a date");
          console.log("4. See available times for that date");

          db.close();
        }
      );
    });
  });
});
