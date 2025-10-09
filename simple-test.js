const http = require('http');

// Simple test for the analytics endpoint
function testAnalyticsSimple() {
  console.log('Testing server availability...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('Server status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('✅ Server is running');
      
      // Now test the analytics endpoint (without auth)
      const analyticsOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/superadmin/analytics?period=week',
        method: 'GET'
      };

      const analyticsReq = http.request(analyticsOptions, (analyticsRes) => {
        let data = '';
        analyticsRes.on('data', (chunk) => {
          data += chunk;
        });
        analyticsRes.on('end', () => {
          console.log('Analytics endpoint status:', analyticsRes.statusCode);
          console.log('Response:', data);
        });
      });

      analyticsReq.on('error', (err) => {
        console.error('Analytics request error:', err);
      });

      analyticsReq.end();
    }
  });

  req.on('error', (err) => {
    console.error('Connection error:', err);
  });

  req.end();
}

testAnalyticsSimple();