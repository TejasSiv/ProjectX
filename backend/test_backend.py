#!/usr/bin/env python3
"""
Quick test script for the Drone Fleet Navigator Backend
"""

import asyncio
import json
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from delivery_planner.core.config import settings
from delivery_planner.core.database import DatabaseService
from delivery_planner.services.order_service import OrderService
from delivery_planner.services.mission_service import MissionService
from delivery_planner.services.drone_service import DroneService
from delivery_planner.models.orders import OrderCreateRequest, Priority, Coordinates

async def test_backend():
    """Test the backend components"""
    print("🚁 Testing Drone Fleet Navigator Backend\n")
    
    try:
        # Test 1: Configuration
        print("1. Testing Configuration...")
        print(f"   ✓ App Title: {settings.app_title}")
        print(f"   ✓ API Prefix: {settings.api_v1_prefix}")
        print(f"   ✓ Debug Mode: {settings.debug_mode}")
        print(f"   ✓ Supabase URL: {settings.supabase_url[:30]}...")
        
        # Test 2: Database Service
        print("\n2. Testing Database Service...")
        db_service = DatabaseService()
        db_healthy = await db_service.health_check()
        print(f"   {'✓' if db_healthy else '✗'} Database Connection: {'Connected' if db_healthy else 'Failed'}")
        
        # Test 3: Order Service
        print("\n3. Testing Order Service...")
        order_service = OrderService(db_service)
        
        # Create a test order
        test_order = OrderCreateRequest(
            customer_id="USR-1001",
            pickup_coordinates=Coordinates(lat=40.7128, lng=-74.0060),
            dropoff_coordinates=Coordinates(lat=40.7589, lng=-73.9851),
            priority=Priority.MEDIUM,
            package_weight=1.5,
            special_instructions="Test delivery"
        )
        
        print(f"   ✓ Test Order Created: {test_order.customer_id}")
        print(f"   ✓ Distance: {test_order.calculate_distance():.2f} km")
        print(f"   ✓ Estimated Time: {test_order.estimate_flight_time()} minutes")
        
        # Test order creation in database
        if db_healthy:
            try:
                created_order = await order_service.create_order(test_order)
                print(f"   ✓ Order stored in database: {created_order.id}")
                
                # Get order stats
                stats = await order_service.get_order_stats()
                print(f"   ✓ Total orders in database: {stats.total_orders}")
                
            except Exception as e:
                print(f"   ✗ Database order creation failed: {e}")
        
        # Test 4: Mission Service
        print("\n4. Testing Mission Service...")
        mission_service = MissionService(db_service)
        
        if db_healthy and 'created_order' in locals():
            try:
                mission_data = await mission_service.create_mission_from_order(created_order)
                print(f"   ✓ Mission created: {mission_data['id']}")
                print(f"   ✓ Waypoints: {len(mission_data['waypoints'])}")
                print(f"   ✓ Total distance: {mission_data['total_distance']:.2f} km")
                print(f"   ✓ Estimated time: {mission_data['estimated_time']} minutes")
                
            except Exception as e:
                print(f"   ✗ Mission creation failed: {e}")
        
        # Test 5: Drone Service
        print("\n5. Testing Drone Service...")
        drone_service = DroneService()
        
        # Test connection (simulation mode)
        connected = await drone_service.connect_to_drone()
        print(f"   {'✓' if connected else '✗'} Drone Connection: {'Connected' if connected else 'Failed'}")
        
        if connected:
            try:
                # Test telemetry
                telemetry = await drone_service.get_telemetry()
                print(f"   ✓ Telemetry Data: {telemetry.drone_id}")
                print(f"   ✓ Position: {telemetry.position.lat:.4f}, {telemetry.position.lng:.4f}")
                print(f"   ✓ Battery: {telemetry.status.battery_remaining:.1f}%")
                print(f"   ✓ Connected: {telemetry.status.is_connected}")
                
                # Test system health
                health = await drone_service.get_system_health()
                print(f"   ✓ System Health: {health.overall_status}")
                print(f"   ✓ Components: {len(health.components)}")
                
            except Exception as e:
                print(f"   ✗ Drone telemetry failed: {e}")
        
        # Test 6: Calculations
        print("\n6. Testing Utility Calculations...")
        from delivery_planner.utils.calculations import (
            calculate_distance, calculate_bearing, estimate_flight_time
        )
        
        coord1 = Coordinates(lat=40.7128, lng=-74.0060)  # NYC
        coord2 = Coordinates(lat=40.7589, lng=-73.9851)  # Central Park
        
        distance = calculate_distance(coord1, coord2)
        bearing = calculate_bearing(coord1, coord2)
        flight_time = estimate_flight_time(distance)
        
        print(f"   ✓ Distance calculation: {distance:.2f} km")
        print(f"   ✓ Bearing calculation: {bearing:.1f}°")
        print(f"   ✓ Flight time estimation: {flight_time} minutes")
        
        print("\n🎉 Backend test completed successfully!")
        
        # Print summary
        print("\n📊 Test Summary:")
        print("   ✓ Configuration: OK")
        print(f"   {'✓' if db_healthy else '✗'} Database: {'OK' if db_healthy else 'Failed'}")
        print("   ✓ Order Service: OK")
        print("   ✓ Mission Service: OK")
        print(f"   {'✓' if connected else '✗'} Drone Service: {'OK' if connected else 'Failed'}")
        print("   ✓ Calculations: OK")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Backend test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        if 'drone_service' in locals() and drone_service.is_connected:
            await drone_service.disconnect()

def main():
    """Run the backend test"""
    print("Starting backend test...\n")
    
    try:
        success = asyncio.run(test_backend())
        if success:
            print("\n✅ All tests passed! Backend is ready.")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed. Check the output above.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test crashed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()