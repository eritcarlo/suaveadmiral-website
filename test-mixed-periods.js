const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./barbershop.db');

console.log('=== TESTING MIXED PERIOD FILTERING ===');
console.log('Line Chart (Daily) = Last 30 days | Other components (Daily) = Today only\n');

// Test what line chart will show (daily = last 30 days)
console.log('📈 LINE CHART (Daily) - Last 30 days:');
db.all("SELECT COUNT(*) as count, date(booking_date) as date FROM bookings WHERE date(booking_date) >= date('now', '-30 days') GROUP BY date(booking_date) ORDER BY date DESC LIMIT 5", (err, lineChart) => {
  if (err) console.error(err);
  else console.log('   Recent daily totals:', lineChart);
  
  // Test what service distribution will show (daily = today only)
  console.log('\n🍩 SERVICE DISTRIBUTION (Daily) - Today only:');
  db.all("SELECT LOWER(service) as service_key, COUNT(*) as count FROM bookings WHERE date(booking_date) = date('now') AND LOWER(service) NOT LIKE '%test%' GROUP BY LOWER(service) ORDER BY count DESC", (err2, serviceToday) => {
    if (err2) console.error(err2);
    else console.log('   Today\'s services:', serviceToday);
    
    // Test what customer distribution will show (daily = today only)
    console.log('\n📊 CUSTOMER DISTRIBUTION (Daily) - Today only:');
    db.all("SELECT b.name as barber_name, COUNT(bk.id) as customer_count FROM barbers b LEFT JOIN bookings bk ON b.id = bk.barber_id AND bk.status = 'Done' AND date(bk.booking_date) = date('now') GROUP BY b.id, b.name ORDER BY customer_count DESC", (err3, customerToday) => {
      if (err3) console.error(err3);
      else console.log('   Today\'s barber activity:', customerToday);
      
      // Test what stats will show (daily = today only)
      console.log('\n📋 STATS CARDS (Daily) - Today only:');
      const queries = [
        "SELECT COUNT(*) as count FROM bookings WHERE date(booking_date) = date('now')",
        "SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'haircut' AND date(booking_date) = date('now')",
        "SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'cut and shave' AND date(booking_date) = date('now')"
      ];
      
      let completed = 0;
      const results = {};
      
      db.get(queries[0], (err4, totalToday) => {
        results.total = totalToday?.count || 0;
        if (++completed === 3) showStats();
      });
      
      db.get(queries[1], (err5, haircutToday) => {
        results.haircut = haircutToday?.count || 0;
        if (++completed === 3) showStats();
      });
      
      db.get(queries[2], (err6, cutShaveToday) => {
        results.cutShave = cutShaveToday?.count || 0;
        if (++completed === 3) showStats();
      });
      
      function showStats() {
        console.log(`   Total Bookings Today: ${results.total}`);
        console.log(`   Haircuts Today: ${results.haircut}`);
        console.log(`   Cut & Shave Today: ${results.cutShave}`);
        
        console.log('\n✅ SUMMARY:');
        console.log('   📈 Line Chart shows trends (30-day daily data)');
        console.log('   🍩📊📋 Other components show today\'s activity only');
        
        db.close();
      }
    });
  });
});