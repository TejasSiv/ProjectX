// Simple test to verify Supabase connection
const SUPABASE_URL = "https://liswqdeiydvouikhuuwf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw";

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...');
  
  try {
    // Test REST API endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Supabase connection successful');
      console.log('📊 Sample data:', data);
      
      // Test orders table specifically
      const ordersResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&limit=5`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const orders = await ordersResponse.json();
      console.log(`📦 Found ${orders.length} orders in database`);
      
      if (orders.length > 0) {
        console.log('🎯 Sample order:', {
          id: orders[0].id,
          status: orders[0].status,
          customer_id: orders[0].customer_id
        });
      }
      
    } else {
      console.log('❌ Supabase connection failed:', response.status, response.statusText);
      const errorData = await response.text();
      console.log('Error details:', errorData);
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

// Run the test
testSupabaseConnection();