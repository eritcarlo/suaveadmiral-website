const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./barbershop.db');

console.log('=== CREATING TEST DATA WITH VARIED DATES ===');

// Insert some older bookings to test the filtering
const testBookings = [
  // Old bookings (beyond 30 days) - should only appear in weekly/monthly
  { service: 'HAIRCUT', date: '2025-08-15', user_id: 1, barber_id: 1 },
  { service: 'CUT AND SHAVE', date: '2025-08-20', user_id: 2, barber_id: 2 },
  { service: 'HAIRCUT', date: '2025-07-10', user_id: 3, barber_id: 3 },
  
  // Medium old bookings (within 84 days but beyond 30 days) - should only appear in weekly/monthly
  { service: 'HAIRCUT', date: '2025-09-01', user_id: 1, barber_id: 1 },
  { service: 'CUT AND SHAVE', date: '2025-09-05', user_id: 2, barber_id: 2 },
  
  // Very old bookings (beyond 84 days) - should only appear in monthly
  { service: 'HAIRCUT', date: '2024-12-15', user_id: 1, barber_id: 1 },
  { service: 'CUT AND SHAVE', date: '2024-11-20', user_id: 2, barber_id: 2 }
];

let insertCount = 0;
const total = testBookings.length;

testBookings.forEach(booking => {
  db.run(
    "INSERT INTO bookings (user_id, service, barber_id, booking_date, status) VALUES (?, ?, ?, ?, 'Done')",
    [booking.user_id, booking.service, booking.barber_id, booking.date],
    function(err) {
      if (err) {
        console.error('Error inserting booking:', err);
      } else {
        console.log(`Inserted booking: ${booking.service} on ${booking.date}`);
      }
      
      insertCount++;
      if (insertCount === total) {
        console.log('\n=== TESTING PERIOD FILTERING WITH NEW DATA ===');
        
        // Test daily (last 30 days)
        db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-30 days') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err, daily) => {
          console.log('\\nDaily (30 days):', daily);
          
          // Test weekly (last 84 days) 
          db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-84 days') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err2, weekly) => {
            console.log('Weekly (84 days):', weekly);
            
            // Test monthly (last 12 months)
            db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-12 months') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err3, monthly) => {
              console.log('Monthly (12 months):', monthly);
              db.close();
            });
          });
        });
      }
    }
  );
});