const express = require('express');
const fetch = require('node-fetch');

// Test the admin stats API endpoint
async function testAdminStatsAPI() {
  try {
    console.log('Testing /api/admin/stats endpoint...');
    
    // Test if we can reach the endpoint (this will likely fail due to authentication)
    const response = await fetch('http://localhost:3000/api/admin/stats');
    
    console.log('Response status:', response.status);
    
    if (response.status === 401) {
      console.log('❌ Authentication required - this is expected when not logged in');
      console.log('The endpoint exists but requires admin login');
    } else if (response.status === 404) {
      console.log('❌ Endpoint not found - server might not be running');
    } else {
      const data = await response.json();
      console.log('✅ Response data:', data);
    }
    
  } catch (error) {
    console.error('❌ Error connecting to server:', error.message);
    console.log('Make sure the server is running on port 3000');
  }
}

testAdminStatsAPI();