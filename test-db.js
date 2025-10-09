const sqlite3 = require('sqlite3');

// Test database connection and get sample data
const db = new sqlite3.Database('./barbershop.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err);
  } else {
    console.log('Tables:', tables.map(t => t.name));
    
    // Check if bookings table exists
    if (tables.find(t => t.name === 'bookings')) {
      // Get sample booking data
      db.all("SELECT booking_date, booked_at, service, status FROM bookings LIMIT 5", (err, rows) => {
        if (err) {
          console.error('Error getting bookings:', err);
        } else {
          console.log('Sample bookings:');
          console.log(JSON.stringify(rows, null, 2));
        }
        db.close();
      });
    } else {
      console.log('No bookings table found');
      db.close();
    }
  }
});