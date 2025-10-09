const sqlite3 = require('sqlite3');

// Debug the date filtering issue
function debugDateFiltering() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('=== DEBUGGING DATE FILTERING ===');
  console.log('Current date:', new Date().toISOString());
  
  // Check what SQLite thinks is 12 weeks ago
  db.get("SELECT date('now', '-12 weeks') as twelve_weeks_ago, date('now') as today", (err, result) => {
    if (err) {
      console.error('Date calculation error:', err);
    } else {
      console.log('SQLite date calculation:');
      console.log('Today:', result.today);
      console.log('12 weeks ago:', result.twelve_weeks_ago);
    }
    
    // Get the actual date range of bookings in the database
    db.get("SELECT MIN(booking_date) as earliest, MAX(booking_date) as latest, COUNT(*) as total FROM bookings", (err2, range) => {
      if (err2) {
        console.error('Range query error:', err2);
      } else {
        console.log('\nActual booking date range:');
        console.log('Earliest:', range.earliest);
        console.log('Latest:', range.latest);
        console.log('Total bookings:', range.total);
      }
      
      // Test different time periods
      const periods = ['30 days', '12 weeks', '84 days', '3 months'];
      
      let completed = 0;
      periods.forEach(period => {
        db.get(`SELECT COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-${period}')`, (err3, result3) => {
          if (err3) {
            console.error(`Error with ${period}:`, err3);
          } else {
            console.log(`Bookings in last ${period}: ${result3.count}`);
          }
          
          completed++;
          if (completed === periods.length) {
            // Also test booked_at
            console.log('\n=== TESTING WITH BOOKED_AT FIELD ===');
            let completed2 = 0;
            periods.forEach(period2 => {
              db.get(`SELECT COUNT(*) as count FROM bookings WHERE date(booked_at) >= date('now', '-${period2}')`, (err4, result4) => {
                if (err4) {
                  console.error(`Error with ${period2} (booked_at):`, err4);
                } else {
                  console.log(`Bookings in last ${period2} (booked_at): ${result4.count}`);
                }
                
                completed2++;
                if (completed2 === periods.length) {
                  db.close();
                }
              });
            });
          }
        });
      });
    });
  });
}

debugDateFiltering();