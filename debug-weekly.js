const sqlite3 = require('sqlite3');

// Debug the specific issue with weekly analytics
function debugWeeklyIssue() {
  const db = new sqlite3.Database('./barbershop.db');
  
  console.log('=== DEBUGGING WEEKLY ANALYTICS ISSUE ===\n');
  
  // Get current date info
  const now = new Date();
  console.log('Current date:', now.toISOString());
  console.log('Current date local:', now.toLocaleDateString());
  
  // Calculate start date like the server does
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (12 * 7));
  console.log('Start date (12 weeks ago):', startDate.toISOString());
  
  // Test the exact query from the server
  const dateFormat = '%Y-%W';
  const groupBy = 'strftime("%Y-%W", booked_at)';
  
  const sql = `
    SELECT 
      strftime('${dateFormat}', booked_at) as date_group,
      booked_at,
      service,
      status,
      SUM(
        CASE 
          WHEN service = 'HAIRCUT' THEN 250
          WHEN service = 'CUT AND SHAVE' THEN 300
          ELSE 0
        END
      ) as total_sales
    FROM bookings 
    WHERE booked_at >= ? AND status = 'Done'
    GROUP BY ${groupBy}
    ORDER BY date_group ASC
  `;
  
  db.all(sql, [startDate.toISOString()], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
      db.close();
      return;
    }
    
    console.log('\n=== QUERY RESULTS ===');
    console.log('Found', rows.length, 'week groups');
    rows.forEach(row => {
      console.log(`Week ${row.date_group}: ${row.total_sales} sales`);
    });
    
    // Test with broader date range
    console.log('\n=== TESTING WITH ALL DATA ===');
    const broadSql = `
      SELECT 
        strftime('${dateFormat}', booked_at) as date_group,
        MIN(booked_at) as earliest,
        MAX(booked_at) as latest,
        COUNT(*) as count,
        SUM(
          CASE 
            WHEN service = 'HAIRCUT' THEN 250
            WHEN service = 'CUT AND SHAVE' THEN 300
            ELSE 0
          END
        ) as total_sales
      FROM bookings 
      WHERE status = 'Done'
      GROUP BY ${groupBy}
      ORDER BY date_group DESC
      LIMIT 15
    `;
    
    db.all(broadSql, [], (err2, allRows) => {
      if (err2) {
        console.error('Broad query error:', err2);
      } else {
        console.log('All available weeks (recent first):');
        allRows.forEach(row => {
          console.log(`Week ${row.date_group}: ${row.count} bookings, ${row.total_sales} sales (${row.earliest} to ${row.latest})`);
        });
        
        // Check if the date filtering is the issue
        if (rows.length === 0 && allRows.length > 0) {
          console.log('\n❌ ISSUE FOUND: Date filtering is too restrictive!');
          console.log('The 12-week filter is excluding all data.');
          console.log('Most recent booking week:', allRows[0].date_group);
          console.log('Filter looking for weeks since:', startDate.toISOString());
        } else if (rows.length > 0) {
          console.log('\n✅ Weekly data exists in the specified range');
        }
      }
      
      db.close();
    });
  });
}

debugWeeklyIssue();