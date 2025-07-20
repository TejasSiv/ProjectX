// Test script to verify frontend-backend integration
const API_BASE = 'http://localhost:8000';

async function testIntegration() {
  console.log('🔧 Testing Frontend-Backend Integration...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Backend Health...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Backend Health:', healthData);

    // Test 2: Create Order
    console.log('\n2. Testing Order Creation...');
    const orderData = {
      customer_id: 'USR-1001',
      pickup_coordinates: { lat: 40.7128, lng: -74.0060 },
      dropoff_coordinates: { lat: 40.7589, lng: -73.9851 },
      priority: 'medium'
    };

    const createResponse = await fetch(`${API_BASE}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (createResponse.ok) {
      const newOrder = await createResponse.json();
      console.log('✅ Order Created:', newOrder.id);

      // Test 3: Get Orders
      console.log('\n3. Testing Order Retrieval...');
      const ordersResponse = await fetch(`${API_BASE}/api/v1/orders`);
      const orders = await ordersResponse.json();
      console.log('✅ Retrieved Orders:', orders.length);

      // Test 4: Start Order
      console.log('\n4. Testing Order Start...');
      const startResponse = await fetch(`${API_BASE}/api/v1/orders/${newOrder.id}/start`, {
        method: 'POST'
      });

      if (startResponse.ok) {
        const updatedOrder = await startResponse.json();
        console.log('✅ Order Started:', updatedOrder.status);
      }

    } else {
      console.log('❌ Failed to create order:', await createResponse.text());
    }

    // Test 5: WebSocket Connection
    console.log('\n5. Testing WebSocket Connection...');
    const ws = new WebSocket(`ws://localhost:8000/api/v1/telemetry/ws`);
    
    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      ws.send(JSON.stringify({
        type: 'subscribe',
        topics: ['telemetry', 'orders']
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📡 WebSocket Message:', data.type);
    };

    ws.onerror = (error) => {
      console.log('❌ WebSocket Error:', error);
    };

    // Close after 5 seconds
    setTimeout(() => {
      ws.close();
      console.log('🔌 WebSocket Disconnected');
    }, 5000);

  } catch (error) {
    console.error('❌ Integration Test Failed:', error.message);
  }
}

// Run if this is Node.js, otherwise export for browser
if (typeof window === 'undefined') {
  testIntegration();
} else {
  window.testIntegration = testIntegration;
}