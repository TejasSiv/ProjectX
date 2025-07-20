#!/bin/bash

# Quick test script for multi-drone simulation
echo "🚁 Multi-Drone Simulation Quick Test"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}Checking if server is running...${NC}"
    if curl -s http://localhost:8000/ > /dev/null; then
        echo -e "${GREEN}✅ Server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not running. Start it with:${NC}"
        echo "cd backend/src/ && python -m delivery_planner.main"
        return 1
    fi
}

# Function to test fleet status
test_fleet() {
    echo -e "\n${YELLOW}Testing fleet status...${NC}"
    response=$(curl -s http://localhost:8000/api/v1/fleet/status)
    if echo "$response" | jq -e '.fleet.total_drones' > /dev/null 2>&1; then
        total_drones=$(echo "$response" | jq -r '.fleet.total_drones')
        online_drones=$(echo "$response" | jq -r '.fleet.online_drones')
        echo -e "${GREEN}✅ Fleet status: $online_drones/$total_drones drones online${NC}"
    else
        echo -e "${RED}❌ Fleet status check failed${NC}"
    fi
}

# Function to create test order
create_test_order() {
    echo -e "\n${YELLOW}Creating test order...${NC}"
    response=$(curl -s -X POST http://localhost:8000/api/v1/orders \
        -H "Content-Type: application/json" \
        -d '{
            "customer_id": "quick_test_customer",
            "pickup_coords": [37.7749, -122.4194],
            "dropoff_coords": [37.7849, -122.4094]
        }')
    
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        order_id=$(echo "$response" | jq -r '.id')
        echo -e "${GREEN}✅ Test order created: $order_id${NC}"
        echo "$order_id"
    else
        echo -e "${RED}❌ Failed to create test order${NC}"
        echo ""
    fi
}

# Function to check mission assignment
check_assignment() {
    local order_id=$1
    if [ -z "$order_id" ]; then
        return 1
    fi
    
    echo -e "\n${YELLOW}Checking mission assignment...${NC}"
    sleep 2  # Wait for assignment
    
    response=$(curl -s http://localhost:8000/api/v1/fleet/status)
    active_missions=$(echo "$response" | jq -r '.active_missions')
    
    if [ "$active_missions" -gt 0 ]; then
        echo -e "${GREEN}✅ Mission assigned successfully ($active_missions active)${NC}"
        
        # Show assignments
        echo "$response" | jq -r '.mission_assignments | to_entries[] | "   Order: \(.key) → Drone: \(.value)"'
    else
        echo -e "${YELLOW}⏳ No active missions yet (may have completed quickly)${NC}"
    fi
}

# Function to show drone status
show_drone_status() {
    echo -e "\n${YELLOW}Current drone status:${NC}"
    curl -s http://localhost:8000/api/v1/fleet/drones | jq -r '.drones | to_entries[] | "\(.key): \(.value.status) (Battery: \(.value.battery_level * 100 | floor)%)"'
}

# Main execution
main() {
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq is required but not installed. Install with: sudo apt install jq${NC}"
        exit 1
    fi
    
    # Run tests
    if check_server; then
        test_fleet
        order_id=$(create_test_order)
        check_assignment "$order_id"
        show_drone_status
        
        echo -e "\n${GREEN}🎉 Quick test completed!${NC}"
        echo -e "\n${YELLOW}Next steps:${NC}"
        echo "1. Run full test suite: python test_multi_drone.py"
        echo "2. Monitor real-time: python websocket_monitor.py"
        echo "3. Setup QGroundControl with ports 14540-14543"
        echo "4. Create more orders to test concurrent missions"
    fi
}

# Run main function
main