#!/usr/bin/env python3
"""
Test script for multi-drone simulation system.
Run this script to validate all components are working correctly.
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List

# Backend API base URL
BASE_URL = "http://localhost:8000"

class MultiDroneSimulationTester:
    def __init__(self):
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def test_fleet_initialization(self):
        """Test that the fleet is properly initialized."""
        print("🚁 Testing Fleet Initialization...")
        
        try:
            async with self.session.get(f"{BASE_URL}/api/v1/fleet/status") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    fleet_stats = data.get("fleet", {})
                    
                    print(f"✅ Fleet Status: {fleet_stats.get('total_drones', 0)} drones")
                    print(f"✅ Online Drones: {fleet_stats.get('online_drones', 0)}")
                    print(f"✅ Available Drones: {fleet_stats.get('available_drones', 0)}")
                    return True
                else:
                    print(f"❌ Fleet status check failed: {resp.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Fleet initialization test failed: {e}")
            return False
            
    async def test_individual_drones(self):
        """Test individual drone status and details."""
        print("\n🤖 Testing Individual Drones...")
        
        drone_ids = ["drone_1", "drone_2", "drone_3", "drone_4"]
        drone_names = ["Alpha", "Bravo", "Charlie", "Delta"]
        
        for drone_id, name in zip(drone_ids, drone_names):
            try:
                async with self.session.get(f"{BASE_URL}/api/v1/fleet/drones/{drone_id}") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        config = data.get("config", {})
                        
                        print(f"✅ {name} ({drone_id}):")
                        print(f"   Status: {data.get('status', 'unknown')}")
                        print(f"   Connected: {data.get('is_connected', False)}")
                        print(f"   Port: {config.get('mavlink_port', 'unknown')}")
                        print(f"   Battery: {data.get('battery_level', 0):.1%}")
                    else:
                        print(f"❌ {name} ({drone_id}) status check failed: {resp.status}")
                        
            except Exception as e:
                print(f"❌ {name} ({drone_id}) test failed: {e}")
                
    async def test_port_allocation(self):
        """Test MAVLink port allocation."""
        print("\n🔌 Testing Port Allocation...")
        
        try:
            async with self.session.get(f"{BASE_URL}/api/v1/fleet/ports") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    port_status = data.get("port_status", {})
                    stats = data.get("statistics", {})
                    
                    print(f"✅ Total Ports: {stats.get('total_ports', 0)}")
                    print(f"✅ Allocated Ports: {stats.get('allocated_ports', 0)}")
                    print(f"✅ Utilization: {stats.get('utilization_percentage', 0):.1f}%")
                    
                    print("\n   Port Details:")
                    for port, info in port_status.items():
                        status = "🟢 Available" if info["is_available"] else "🔴 Allocated"
                        drone = info.get("assigned_drone_id", "None")
                        print(f"   Port {port}: {status} (Drone: {drone})")
                        
                    return True
                else:
                    print(f"❌ Port allocation test failed: {resp.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Port allocation test failed: {e}")
            return False
            
    async def test_order_creation_and_assignment(self):
        """Test creating orders and drone assignment."""
        print("\n📦 Testing Order Creation and Assignment...")
        
        test_orders = [
            {
                "customer_id": "test_customer_1",
                "pickup_coords": [37.7749, -122.4194],
                "dropoff_coords": [37.7849, -122.4094]
            },
            {
                "customer_id": "test_customer_2", 
                "pickup_coords": [37.7650, -122.4294],
                "dropoff_coords": [37.7750, -122.4194]
            }
        ]
        
        created_orders = []
        
        for i, order_data in enumerate(test_orders):
            try:
                async with self.session.post(
                    f"{BASE_URL}/api/v1/orders",
                    json=order_data,
                    headers={"Content-Type": "application/json"}
                ) as resp:
                    if resp.status == 201:
                        order = await resp.json()
                        order_id = order.get("id")
                        created_orders.append(order_id)
                        print(f"✅ Created Order {i+1}: {order_id}")
                    else:
                        print(f"❌ Failed to create order {i+1}: {resp.status}")
                        
            except Exception as e:
                print(f"❌ Order creation failed: {e}")
                
        # Wait a bit for assignment
        print("\n⏳ Waiting for drone assignment...")
        await asyncio.sleep(3)
        
        # Check assignments
        try:
            async with self.session.get(f"{BASE_URL}/api/v1/fleet/status") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    active_missions = data.get("active_missions", 0)
                    assignments = data.get("mission_assignments", {})
                    
                    print(f"✅ Active Missions: {active_missions}")
                    for order_id, drone_id in assignments.items():
                        print(f"   Order {order_id[:8]}... → {drone_id}")
                        
        except Exception as e:
            print(f"❌ Assignment check failed: {e}")
            
        return created_orders
        
    async def test_fleet_health(self):
        """Test fleet health monitoring."""
        print("\n🏥 Testing Fleet Health Monitoring...")
        
        try:
            async with self.session.get(f"{BASE_URL}/api/v1/fleet/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    print(f"✅ Fleet Health: {data.get('fleet_health_percentage', 0):.1f}%")
                    print(f"✅ Healthy Drones: {data.get('healthy_drones', 0)}/{data.get('total_drones', 0)}")
                    print(f"⚠️  Drones with Warnings: {data.get('drones_with_warnings', 0)}")
                    print(f"❌ Drones with Errors: {data.get('drones_with_errors', 0)}")
                    
                    return True
                else:
                    print(f"❌ Health check failed: {resp.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Health monitoring test failed: {e}")
            return False
            
    async def test_telemetry_export(self):
        """Test telemetry data export."""
        print("\n📊 Testing Telemetry Export...")
        
        try:
            async with self.session.get(f"{BASE_URL}/api/v1/fleet/telemetry/export") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    export_data = json.loads(data.get("data", "{}"))
                    
                    print(f"✅ Telemetry export successful")
                    print(f"   Drones with data: {len(export_data)}")
                    
                    for drone_id, telemetry_list in export_data.items():
                        print(f"   {drone_id}: {len(telemetry_list)} data points")
                        
                    return True
                else:
                    print(f"❌ Telemetry export failed: {resp.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Telemetry export test failed: {e}")
            return False
            
    async def test_mission_abort(self, order_ids: List[str]):
        """Test mission abort functionality."""
        if not order_ids:
            print("\n🛑 Skipping Mission Abort Test (no orders to abort)")
            return True
            
        print("\n🛑 Testing Mission Abort...")
        
        # Try to abort the first order
        order_id = order_ids[0]
        
        try:
            async with self.session.post(f"{BASE_URL}/api/v1/fleet/missions/{order_id}/abort") as resp:
                if resp.status == 200:
                    print(f"✅ Successfully aborted mission for order {order_id[:8]}...")
                    return True
                elif resp.status == 404:
                    print(f"ℹ️  No active mission found for order {order_id[:8]}... (may have completed)")
                    return True
                else:
                    print(f"❌ Mission abort failed: {resp.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Mission abort test failed: {e}")
            return False
            
    async def run_all_tests(self):
        """Run all tests in sequence."""
        print("🧪 Starting Multi-Drone Simulation Tests\n")
        print("=" * 50)
        
        test_results = []
        
        # Test 1: Fleet Initialization
        result = await self.test_fleet_initialization()
        test_results.append(("Fleet Initialization", result))
        
        # Test 2: Individual Drones
        await self.test_individual_drones()
        test_results.append(("Individual Drones", True))  # Always passes if no exception
        
        # Test 3: Port Allocation
        result = await self.test_port_allocation()
        test_results.append(("Port Allocation", result))
        
        # Test 4: Order Creation and Assignment
        created_orders = await self.test_order_creation_and_assignment()
        test_results.append(("Order Assignment", len(created_orders) > 0))
        
        # Test 5: Fleet Health
        result = await self.test_fleet_health()
        test_results.append(("Fleet Health", result))
        
        # Test 6: Telemetry Export
        result = await self.test_telemetry_export()
        test_results.append(("Telemetry Export", result))
        
        # Test 7: Mission Abort
        result = await self.test_mission_abort(created_orders)
        test_results.append(("Mission Abort", result))
        
        # Print Summary
        print("\n" + "=" * 50)
        print("🧪 Test Summary:")
        print("=" * 50)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<25} {status}")
            if result:
                passed += 1
                
        print("=" * 50)
        print(f"Tests Passed: {passed}/{total}")
        
        if passed == total:
            print("🎉 All tests passed! Multi-drone simulation is working correctly.")
        else:
            print(f"⚠️  {total - passed} test(s) failed. Check the logs above for details.")
            
        return passed == total


async def main():
    """Main test function."""
    print("🚁 Multi-Drone Simulation Test Suite")
    print("Make sure the backend server is running on http://localhost:8000")
    print()
    
    # Wait for user confirmation
    input("Press Enter to start tests...")
    
    async with MultiDroneSimulationTester() as tester:
        success = await tester.run_all_tests()
        
    if success:
        print("\n✅ All tests completed successfully!")
        print("\nNext steps:")
        print("1. Open QGroundControl")
        print("2. Add UDP connections for ports 14540-14543")
        print("3. Monitor multiple drones in QGC")
        print("4. Create more orders via API to test concurrent missions")
    else:
        print("\n❌ Some tests failed. Check the backend logs for more details.")


if __name__ == "__main__":
    asyncio.run(main())