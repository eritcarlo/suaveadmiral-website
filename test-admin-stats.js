const sqlite3 = require('sqlite3');

// Test the admin stats queries with the fixed periods
function testAdminStatsQueries() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('=== TESTING ADMIN STATS QUERIES ===');
  
  const periods = ['day', 'week', 'month'];
  
  periods.forEach(period => {
    console.log(`\n--- Testing ${period.toUpperCase()} period ---`);
    
    // Build the same date filter as the server
    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "AND date(booking_date) >= date('now', '-30 days')";
    } else if (period === 'week') {
      dateFilter = "AND date(booking_date) >= date('now', '-84 days')"; // 12 weeks = 84 days
    } else if (period === 'month') {
      dateFilter = "AND date(booking_date) >= date('now', '-12 months')";
    }
    
    // Test total bookings
    db.get(`SELECT COUNT(*) as count FROM bookings WHERE 1=1 ${dateFilter}`, (err, totalResult) => {
      if (err) {
        console.error(`${period} total bookings error:`, err);
      } else {
        console.log(`${period} - Total bookings: ${totalResult.count}`);
      }
    });
    
    // Test haircut services
    db.get(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'haircut' ${dateFilter}`, (err, haircutResult) => {
      if (err) {
        console.error(`${period} haircut services error:`, err);
      } else {
        console.log(`${period} - Haircut services: ${haircutResult.count}`);
      }
    });
    
    // Test cut and shave services
    db.get(`SELECT COUNT(*) as count FROM bookings WHERE LOWER(service) = 'cut and shave' ${dateFilter}`, (err, cutShaveResult) => {
      if (err) {
        console.error(`${period} cut and shave services error:`, err);
      } else {
        console.log(`${period} - Cut and Shave services: ${cutShaveResult.count}`);
      }
    });
  });
  
  // Close database after a delay to allow all queries to complete
  setTimeout(() => {
    db.close();
    console.log('\nTest completed!');
  }, 1000);
}

testAdminStatsQueries();