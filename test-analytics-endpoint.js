const http = require('http');
const querystring = require('querystring');

// Test the analytics endpoint by first logging in as admin
function testAnalyticsEndpoint() {
  console.log('Testing analytics endpoint...');

  // First, login as admin
  const loginData = querystring.stringify({
    email: 'admin@example.com',
    password: 'admin123'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const loginReq = http.request(loginOptions, (loginRes) => {
    let loginResponseData = '';
    
    loginRes.on('data', (chunk) => {
      loginResponseData += chunk;
    });
    
    loginRes.on('end', () => {
      console.log('Login response status:', loginRes.statusCode);
      console.log('Login response:', loginResponseData);
      
      if (loginRes.statusCode === 200) {
        // Extract cookies from login response
        const cookies = loginRes.headers['set-cookie'];
        const cookieHeader = cookies ? cookies.join('; ') : '';
        
        // Test weekly analytics
        testPeriod('week', cookieHeader, () => {
          // Test daily analytics
          testPeriod('day', cookieHeader, () => {
            // Test monthly analytics
            testPeriod('month', cookieHeader, () => {
              console.log('All tests completed!');
              process.exit(0);
            });
          });
        });
      } else {
        console.error('Login failed');
        process.exit(1);
      }
    });
  });

  loginReq.on('error', (err) => {
    console.error('Login request error:', err);
    process.exit(1);
  });

  loginReq.write(loginData);
  loginReq.end();
}

function testPeriod(period, cookies, callback) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/superadmin/analytics?period=${period}`,
    method: 'GET',
    headers: {
      'Cookie': cookies
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log(`\n=== ${period.toUpperCase()} ANALYTICS ===`);
      console.log('Status:', res.statusCode);
      
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(responseData);
          console.log('Labels:', data.labels);
          console.log('Data points:', data.datasets[0].data.length);
          console.log('Sample data:', data.datasets[0].data.slice(0, 5));
          
          // Check if there's any non-zero data
          const hasData = data.datasets[0].data.some(value => value > 0);
          console.log('Has data:', hasData ? '✅ YES' : '❌ NO');
          
        } catch (e) {
          console.error('JSON parse error:', e);
          console.log('Raw response:', responseData);
        }
      } else {
        console.log('Error response:', responseData);
      }
      
      if (callback) callback();
    });
  });

  req.on('error', (err) => {
    console.error(`${period} request error:`, err);
    if (callback) callback();
  });

  req.end();
}

testAnalyticsEndpoint();