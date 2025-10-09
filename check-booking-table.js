const sqlite3 = require('sqlite3');

// Check the actual booking table structure and data
function checkBookingTable() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('=== CHECKING BOOKING TABLE STRUCTURE ===');
  
  // Get table schema
  db.all("PRAGMA table_info(bookings)", (err, columns) => {
    if (err) {
      console.error('Schema error:', err);
    } else {
      console.log('Booking table columns:');
      columns.forEach(col => {
        console.log(`- ${col.name} (${col.type})`);
      });
    }
    
    // Get sample data to see date fields
    db.all("SELECT booking_date, booked_at, service, status FROM bookings LIMIT 3", (err2, rows) => {
      if (err2) {
        console.error('Data query error:', err2);
      } else {
        console.log('\nSample data:');
        console.log(JSON.stringify(rows, null, 2));
        
        // Test the current admin stats query for weekly period
        console.log('\n=== TESTING ADMIN STATS QUERY (WEEKLY) ===');
        const weeklyFilter = "AND date(booking_date) >= date('now', '-12 weeks')";
        
        console.log('Testing query:', `SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${weeklyFilter}`);
        
        db.get(`SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${weeklyFilter}`, (err3, result) => {
          if (err3) {
            console.error('Weekly filter error:', err3);
          } else {
            console.log('Weekly bookings count:', result.count);
          }
          
          // Also test with booked_at instead
          const altWeeklyFilter = "AND date(booked_at) >= date('now', '-12 weeks')";
          console.log('Testing alternative query:', `SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${altWeeklyFilter}`);
          
          db.get(`SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${altWeeklyFilter}`, (err4, result2) => {
            if (err4) {
              console.error('Alternative weekly filter error:', err4);
            } else {
              console.log('Weekly bookings count (using booked_at):', result2.count);
            }
            
            db.close();
          });
        });
      }
    });
  });
}

checkBookingTable();