const nodemailer = require('nodemailer');

// Gmail Connection Test
async function testGmailConnection() {
  console.log('🔧 Testing Gmail Configuration...\n');
  
  // Replace with your actual credentials
  const EMAIL_USER = 'your-email@gmail.com'; // Replace with your Gmail
  const EMAIL_PASS = 'your-app-password';     // Replace with your 16-character app password
  
  console.log(`📧 Testing with email: ${EMAIL_USER}`);
  console.log(`🔑 App password length: ${EMAIL_PASS.length} characters`);
  
  try {
    // Create transporter with Railway-style settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    });

    console.log('\n⏳ Step 1: Creating transporter...');
    console.log('✅ Transporter created successfully');

    console.log('\n⏳ Step 2: Verifying connection...');
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('✅ Gmail connection verified successfully!');
      console.log('🎉 Your Gmail configuration is working perfectly!');
      
      // Test sending an email to yourself
      console.log('\n⏳ Step 3: Testing email send...');
      const testEmail = {
        from: `Suave Barbershop <${EMAIL_USER}>`,
        to: EMAIL_USER, // Send to yourself
        subject: 'Gmail Test - Suave Barbershop',
        html: `
          <h2>🎉 Gmail Configuration Test Successful!</h2>
          <p>Your Gmail is properly configured for Suave Barbershop notifications.</p>
          <p>✅ IMAP: Enabled</p>
          <p>✅ App Password: Working</p>
          <p>✅ SMTP Connection: Success</p>
          <p><em>Time: ${new Date().toLocaleString()}</em></p>
        `
      };
      
      const info = await transporter.sendMail(testEmail);
      console.log('✅ Test email sent successfully!');
      console.log(`📧 Message ID: ${info.messageId}`);
      console.log(`📬 Check your Gmail inbox for the test email`);
      
    } else {
      console.log('❌ Gmail verification failed');
    }
    
  } catch (error) {
    console.log('\n❌ Gmail Configuration Error:');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔧 Authentication Issue - Check:');
      console.log('   1. ✅ 2-Step Verification is enabled in your Google Account');
      console.log('   2. ✅ App Password is correct (16 characters, no spaces)');
      console.log('   3. ✅ Using App Password, not regular Gmail password');
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.log('\n🌐 Connection Issue - This might be:');
      console.log('   1. Network/firewall blocking SMTP');
      console.log('   2. Railway platform restrictions');
      console.log('   3. Gmail temporary security block');
    }
    
    console.log(`\n🔍 Full error details:`, error);
  }
}

// Run the test
console.log('🚀 Starting Gmail Connection Test for Suave Barbershop\n');
testGmailConnection().then(() => {
  console.log('\n✅ Test completed!');
}).catch(error => {
  console.log('\n❌ Test failed:', error.message);
});