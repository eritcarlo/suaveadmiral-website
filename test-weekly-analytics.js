const sqlite3 = require('sqlite3');

// Test the analytics calculation logic for weekly period
function testWeeklyAnalytics() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('Testing weekly analytics calculation...');
  
  // Test the actual SQL query that the analytics endpoint would use
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (12 * 7)); // 12 weeks ago
  
  const dateFormat = '%Y-%W';
  const groupBy = 'strftime("%Y-%W", booked_at)';
  
  const sql = `
    SELECT 
      strftime('${dateFormat}', booked_at) as date_group,
      SUM(
        CASE 
          WHEN service = 'HAIRCUT' THEN 250
          WHEN service = 'CUT AND SHAVE' THEN 300
          ELSE 0
        END
      ) as total_sales,
      COUNT(*) as booking_count
    FROM bookings 
    WHERE booked_at >= ? AND status = 'Done'
    GROUP BY ${groupBy}
    ORDER BY date_group ASC
  `;
  
  db.all(sql, [startDate.toISOString()], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.log('Weekly analytics results:');
      console.log(JSON.stringify(rows, null, 2));
      
      if (rows.length === 0) {
        console.log('❌ No weekly data found. This might indicate the issue.');
        
        // Let's test with a broader date range
        console.log('\nTesting with all data...');
        const broadSql = `
          SELECT 
            strftime('${dateFormat}', booked_at) as date_group,
            SUM(
              CASE 
                WHEN service = 'HAIRCUT' THEN 250
                WHEN service = 'CUT AND SHAVE' THEN 300
                ELSE 0
              END
            ) as total_sales,
            COUNT(*) as booking_count,
            MIN(booked_at) as earliest_booking,
            MAX(booked_at) as latest_booking
          FROM bookings 
          WHERE status = 'Done'
          GROUP BY ${groupBy}
          ORDER BY date_group ASC
        `;
        
        db.all(broadSql, [], (err2, allRows) => {
          if (err2) {
            console.error('Broad query error:', err2);
          } else {
            console.log('All weekly data:');
            console.log(JSON.stringify(allRows, null, 2));
          }
          db.close();
        });
      } else {
        console.log('✅ Weekly data found successfully!');
        db.close();
      }
    }
  });
}

testWeeklyAnalytics();