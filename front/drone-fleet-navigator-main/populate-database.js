// Script to populate drone delivery database with realistic sample data
const SUPABASE_URL = "https://liswqdeiydvouikhuuwf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw";

// NYC area coordinates for realistic locations
const NYC_LOCATIONS = [
  { name: "Times Square", coords: [40.7580, -73.9855] },
  { name: "Central Park", coords: [40.7829, -73.9654] },
  { name: "Brooklyn Bridge", coords: [40.7061, -73.9969] },
  { name: "Empire State Building", coords: [40.7484, -73.9857] },
  { name: "One World Trade Center", coords: [40.7127, -74.0134] },
  { name: "Staten Island Ferry", coords: [40.6892, -74.0445] },
  { name: "Yankee Stadium", coords: [40.8296, -73.9262] },
  { name: "Coney Island", coords: [40.5579, -73.9442] },
  { name: "LaGuardia Airport", coords: [40.7769, -73.8740] },
  { name: "JFK Airport", coords: [40.6413, -73.7781] },
  { name: "Wall Street", coords: [40.7074, -74.0113] },
  { name: "High Line", coords: [40.7480, -74.0048] },
  { name: "Williamsburg", coords: [40.7081, -73.9571] },
  { name: "Astoria", coords: [40.7698, -73.9442] },
  { name: "Queens Plaza", coords: [40.7505, -73.9370] },
  { name: "Bronx Zoo", coords: [40.8506, -73.8769] },
  { name: "Long Island City", coords: [40.7505, -73.9370] },
  { name: "Red Hook", coords: [40.6743, -74.0092] },
  { name: "DUMBO", coords: [40.7033, -73.9904] },
  { name: "Midtown East", coords: [40.7549, -73.9707] }
];

const CUSTOMER_PREFIXES = ['CUST', 'USR', 'CLI', 'BUY'];
const STATUSES = ['pending', 'scheduled', 'in_flight', 'completed', 'failed'];
const PRIORITIES = ['low', 'medium', 'high'];

// Generate random customer ID
function generateCustomerID() {
  const prefix = CUSTOMER_PREFIXES[Math.floor(Math.random() * CUSTOMER_PREFIXES.length)];
  const number = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `${prefix}-${number}`;
}

// Generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get random location
function getRandomLocation() {
  return NYC_LOCATIONS[Math.floor(Math.random() * NYC_LOCATIONS.length)];
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Generate realistic order data
function generateOrders(count = 25) {
  const orders = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const pickup = getRandomLocation();
    const dropoff = getRandomLocation();
    const distance = calculateDistance(...pickup.coords, ...dropoff.coords);
    const estimatedTime = Math.ceil(distance * 4 + Math.random() * 10); // 4 min/km + random
    const packageWeight = Math.round((Math.random() * 4.5 + 0.5) * 100) / 100; // 0.5-5kg
    
    // Time variations
    const createdHoursAgo = Math.floor(Math.random() * 48); // 0-48 hours ago
    const createdAt = new Date(now.getTime() - createdHoursAgo * 60 * 60 * 1000);
    
    // Status probabilities: 30% pending, 25% scheduled, 20% in_flight, 20% completed, 5% failed
    let status;
    const statusRand = Math.random();
    if (statusRand < 0.30) status = 'pending';
    else if (statusRand < 0.55) status = 'scheduled';
    else if (statusRand < 0.75) status = 'in_flight';
    else if (statusRand < 0.95) status = 'completed';
    else status = 'failed';
    
    // Priority probabilities: 60% medium, 25% high, 15% low
    let priority;
    const priorityRand = Math.random();
    if (priorityRand < 0.15) priority = 'low';
    else if (priorityRand < 0.75) priority = 'medium';
    else priority = 'high';
    
    // Generate timestamps based on status
    let scheduledAt = null;
    let startedAt = null;
    let completedAt = null;
    let actualCompletionTime = null;
    let failureReason = null;
    
    if (status !== 'pending') {
      scheduledAt = new Date(createdAt.getTime() + Math.random() * 30 * 60 * 1000); // 0-30 min after creation
    }
    
    if (['in_flight', 'completed', 'failed'].includes(status)) {
      startedAt = new Date(scheduledAt.getTime() + Math.random() * 60 * 60 * 1000); // 0-60 min after scheduled
    }
    
    if (['completed', 'failed'].includes(status)) {
      const duration = estimatedTime * (0.8 + Math.random() * 0.4); // 80-120% of estimated
      completedAt = new Date(startedAt.getTime() + duration * 60 * 1000);
      actualCompletionTime = Math.ceil(duration);
    }
    
    if (status === 'failed') {
      const failures = [
        'Weather conditions too severe',
        'Obstacle detection - landing zone blocked',
        'Low battery - emergency landing',
        'GPS signal lost',
        'Mechanical failure - rotor malfunction',
        'Unauthorized airspace entry detected',
        'Package weight exceeded safety limits',
        'Customer unavailable for delivery'
      ];
      failureReason = failures[Math.floor(Math.random() * failures.length)];
    }
    
    // Special instructions (40% chance)
    let specialInstructions = null;
    if (Math.random() < 0.4) {
      const instructions = [
        'Leave at front door',
        'Ring doorbell and wait',
        'Fragile - handle with care',
        'Deliver to building concierge',
        'Customer will meet drone outside',
        'Priority delivery - urgent medical supplies',
        'Temperature sensitive - keep cool',
        'Signature required upon delivery'
      ];
      specialInstructions = instructions[Math.floor(Math.random() * instructions.length)];
    }
    
    const order = {
      id: generateUUID(),
      customer_id: generateCustomerID(),
      pickup_coordinates: pickup.coords,
      dropoff_coordinates: dropoff.coords,
      status: status,
      priority: priority,
      estimated_time: estimatedTime,
      actual_completion_time: actualCompletionTime,
      package_weight: packageWeight,
      special_instructions: specialInstructions,
      failure_reason: failureReason,
      created_at: createdAt.toISOString(),
      updated_at: completedAt ? completedAt.toISOString() : createdAt.toISOString(),
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      started_at: startedAt ? startedAt.toISOString() : null,
      completed_at: completedAt ? completedAt.toISOString() : null
    };
    
    orders.push(order);
  }
  
  return orders;
}

// Generate mission data for orders
function generateMissions(orders) {
  const missions = [];
  
  orders.forEach(order => {
    // Only create missions for orders that have been scheduled
    if (['scheduled', 'in_flight', 'completed', 'failed'].includes(order.status)) {
      const pickup = order.pickup_coordinates;
      const dropoff = order.dropoff_coordinates;
      const distance = calculateDistance(...pickup, ...dropoff);
      
      // Generate waypoints (pickup -> waypoint -> dropoff)
      const waypoints = [
        {
          lat: pickup[0],
          lng: pickup[1],
          altitude: 0,
          action: 'takeoff',
          description: 'Takeoff from pickup location'
        },
        {
          lat: pickup[0],
          lng: pickup[1],
          altitude: 50,
          action: 'climb',
          description: 'Climb to cruise altitude'
        },
        {
          lat: dropoff[0],
          lng: dropoff[1],
          altitude: 50,
          action: 'navigate',
          description: 'Navigate to dropoff location'
        },
        {
          lat: dropoff[0],
          lng: dropoff[1],
          altitude: 0,
          action: 'land',
          description: 'Land at dropoff location'
        }
      ];
      
      // Mission parameters
      const parameters = {
        max_altitude: 120,
        cruise_speed: 15,
        safety_margin: 10,
        return_to_home: true,
        emergency_protocol: 'auto_land'
      };
      
      let missionStatus = 'created';
      let progress = 0;
      let currentWaypointIndex = 0;
      
      // Set mission status based on order status
      if (order.status === 'scheduled') {
        missionStatus = 'planned';
      } else if (order.status === 'in_flight') {
        missionStatus = 'executing';
        progress = Math.random() * 0.8; // 0-80% progress
        currentWaypointIndex = Math.floor(progress * waypoints.length);
      } else if (order.status === 'completed') {
        missionStatus = 'completed';
        progress = 1.0;
        currentWaypointIndex = waypoints.length - 1;
      } else if (order.status === 'failed') {
        missionStatus = 'failed';
        progress = Math.random() * 0.7; // Failed partway through
        currentWaypointIndex = Math.floor(progress * waypoints.length);
      }
      
      const mission = {
        id: generateUUID(),
        order_id: order.id,
        waypoints: waypoints,
        parameters: parameters,
        status: missionStatus,
        progress: progress,
        current_waypoint_index: currentWaypointIndex,
        description: `Delivery mission from ${pickup[0].toFixed(4)},${pickup[1].toFixed(4)} to ${dropoff[0].toFixed(4)},${dropoff[1].toFixed(4)}`,
        failure_reason: order.failure_reason,
        total_distance: Math.round(distance * 1000), // in meters
        estimated_time: order.estimated_time,
        actual_duration: order.actual_completion_time,
        created_at: order.created_at,
        updated_at: order.updated_at,
        started_at: order.started_at,
        completed_at: order.completed_at
      };
      
      missions.push(mission);
    }
  });
  
  return missions;
}

// Insert data into Supabase
async function insertData(tableName, data) {
  console.log(`📥 Inserting ${data.length} records into ${tableName}...`);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    console.log(`✅ Successfully inserted ${data.length} ${tableName}`);
    return true;
  } else {
    const error = await response.text();
    console.error(`❌ Failed to insert ${tableName}:`, error);
    return false;
  }
}

// Clear existing data
async function clearTable(tableName) {
  console.log(`🗑️ Clearing existing data from ${tableName}...`);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.ok) {
    console.log(`✅ Cleared ${tableName} table`);
  } else {
    console.log(`⚠️ Could not clear ${tableName} table (may be empty)`);
  }
}

// Main function
async function populateDatabase() {
  console.log('🚁 Populating Drone Delivery Database with Sample Data...\n');
  
  try {
    // Clear existing data
    await clearTable('missions');
    await clearTable('orders');
    
    // Generate sample data
    console.log('📊 Generating sample data...');
    const orders = generateOrders(25);
    const missions = generateMissions(orders);
    
    console.log(`Generated ${orders.length} orders and ${missions.length} missions\n`);
    
    // Insert orders first (missions reference orders)
    const ordersSuccess = await insertData('orders', orders);
    
    if (ordersSuccess && missions.length > 0) {
      await insertData('missions', missions);
    }
    
    console.log('\n🎉 Database population completed!');
    console.log('\n📈 Summary:');
    console.log(`• Orders: ${orders.length} records`);
    console.log(`• Missions: ${missions.length} records`);
    
    // Status breakdown
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📋 Order Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`• ${status}: ${count} orders`);
    });
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
  }
}

// Run the script
populateDatabase();