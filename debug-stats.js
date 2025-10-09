const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./barbershop.db');

console.log('Checking database counts...');

db.get('SELECT COUNT(*) as count FROM bookings', (err, result) => {
  if (err) {
    console.error('Error getting total bookings:', err);
  } else {
    console.log('Total bookings in database:', result.count);
  }
  
  db.get('SELECT COUNT(*) as count FROM barbers', (err, result) => {
    if (err) {
      console.error('Error getting barbers:', err);
    } else {
      console.log('Total barbers in database:', result.count);
    }
    
  db.get(`SELECT COUNT(*) as count FROM bookings WHERE status NOT IN ('Done','Cancelled')`, (err, result) => {
      if (err) {
        console.error('Error getting active bookings:', err);
      } else {
        console.log('Active bookings in database:', result.count);
      }
      
      const today = new Date().toISOString().split('T')[0];
      db.get('SELECT COUNT(*) as count FROM bookings WHERE booking_date = ?', [today], (err, result) => {
        if (err) {
          console.error('Error getting today appointments:', err);
        } else {
          console.log(`Today's appointments (${today}):`, result.count);
        }
        db.close();
      });
    });
  });
});