const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./barbershop.db');

console.log('=== TESTING PERIOD FILTERING ===');

// Test service distribution with different periods
console.log('\n--- Service Distribution (Daily - last 30 days) ---');
db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-30 days') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err, rows) => {
  if (err) console.error(err);
  else console.log('Daily results:', rows);
  
  console.log('\n--- Service Distribution (Weekly - last 84 days) ---');
  db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) >= date('now', '-84 days') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err2, rows2) => {
    if (err2) console.error(err2);
    else console.log('Weekly results:', rows2);
    
    console.log('\n--- Booking dates (sample) ---');
    db.all("SELECT service, booking_date, date(booking_date) FROM bookings WHERE LOWER(service) NOT LIKE '%test%' ORDER BY booking_date DESC LIMIT 10", (err3, rows3) => {
      if (err3) console.error(err3);
      else console.log('Recent bookings:', rows3);
      db.close();
    });
  });
});