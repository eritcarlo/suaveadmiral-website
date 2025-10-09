const sqlite3 = require('sqlite3');

// Test the actual week format used by SQLite vs our JavaScript calculation
function testWeekFormats() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('=== TESTING WEEK FORMAT MISMATCH ===\n');
  
  // Test what SQLite thinks the weeks are for recent dates
  const testSql = `
    SELECT 
      booked_at,
      strftime('%Y-%W', booked_at) as sqlite_week,
      date(booked_at) as booking_date
    FROM bookings 
    WHERE status = 'Done'
    ORDER BY booked_at DESC
    LIMIT 10
  `;
  
  db.all(testSql, [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
      db.close();
      return;
    }
    
    console.log('SQLite week formats for recent bookings:');
    rows.forEach(row => {
      console.log(`${row.booking_date} (${row.booked_at}) -> Week: ${row.sqlite_week}`);
    });
    
    console.log('\n=== TESTING JAVASCRIPT WEEK CALCULATION ===');
    
    // Test our JavaScript week calculation for the same dates
    rows.forEach(row => {
      const date = new Date(row.booked_at);
      const year = date.getFullYear();
      const start = new Date(year, 0, 1);
      const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
      const jsWeek = Math.ceil((days + start.getDay() + 1) / 7);
      const jsWeekStr = `${year}-${jsWeek.toString().padStart(2, '0')}`;
      
      console.log(`${row.booking_date} -> JS Week: ${jsWeekStr}, SQLite Week: ${row.sqlite_week}, Match: ${jsWeekStr === row.sqlite_week ? '✅' : '❌'}`);
    });
    
    db.close();
  });
}

testWeekFormats();