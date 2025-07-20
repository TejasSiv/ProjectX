from typing import Optional, List, Dict, Any
import uuid
import logging
from datetime import datetime, timedelta
import math

from ..core.database import DatabaseService
from ..core.config import settings
from ..core.exceptions import (
    OrderNotFoundError, 
    InvalidStatusTransitionError, 
    ValidationError
)
from ..models.orders import (
    OrderCreateRequest, 
    OrderUpdateRequest, 
    OrderResponse, 
    OrderStatus, 
    OrderStatsResponse,
    Coordinates
)

logger = logging.getLogger(__name__)

class OrderService:
    """Business logic service for order management"""
    
    def __init__(self, db_service: DatabaseService):
        self.db = db_service
        
    async def create_order(self, order_data: OrderCreateRequest) -> OrderResponse:
        """Create a new delivery order with validation and calculations"""
        try:
            # Validate coordinates are within service area
            self._validate_service_area(order_data.pickup_coordinates)
            self._validate_service_area(order_data.dropoff_coordinates)
            
            # Calculate distance and estimated time
            distance_km = order_data.calculate_distance()
            estimated_time = order_data.estimate_flight_time(settings.cruise_speed)
            
            # Validate minimum distance (prevent very short deliveries)
            if distance_km < 0.1:  # 100 meters minimum
                raise ValidationError("Minimum delivery distance is 100 meters")
            
            # Validate maximum distance
            if distance_km > settings.service_area_radius_km:
                raise ValidationError(f"Delivery distance exceeds maximum range of {settings.service_area_radius_km}km")
            
            # Set estimated time if not provided
            if not order_data.estimated_time:
                order_data.estimated_time = estimated_time
            
            # Create order in database
            order = await self.db.create_order(order_data)
            if not order:
                raise ValidationError("Failed to create order in database")
            
            logger.info(f"Created order {order.id} for customer {order.customer_id}")
            return order
            
        except Exception as e:
            logger.error(f"Failed to create order: {e}")
            raise
    
    async def get_order(self, order_id: uuid.UUID) -> OrderResponse:
        """Retrieve a single order by ID"""
        order = await self.db.get_order(order_id)
        if not order:
            raise OrderNotFoundError(str(order_id))
        return order
    
    async def get_orders(
        self, 
        status: Optional[OrderStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[OrderResponse]:
        """Retrieve orders with optional filtering"""
        return await self.db.get_orders(status, limit, offset)
    
    async def update_order_status(
        self, 
        order_id: uuid.UUID, 
        new_status: OrderStatus,
        failure_reason: Optional[str] = None
    ) -> OrderResponse:
        """Update order status with validation"""
        # Get current order
        current_order = await self.get_order(order_id)
        
        # Validate status transition
        self._validate_status_transition(current_order.status, new_status)
        
        # Prepare update data
        update_data = {"status": new_status.value}
        
        if failure_reason and new_status == OrderStatus.FAILED:
            update_data["failure_reason"] = failure_reason
        
        # Calculate actual completion time for completed orders
        if new_status in [OrderStatus.COMPLETED, OrderStatus.FAILED] and current_order.started_at:
            duration = datetime.utcnow() - current_order.started_at
            update_data["actual_completion_time"] = int(duration.total_seconds() / 60)
        
        # Update in database
        updated_order = await self.db.update_order(order_id, update_data)
        if not updated_order:
            raise ValidationError("Failed to update order status")
        
        logger.info(f"Updated order {order_id} status: {current_order.status} -> {new_status}")
        return updated_order
    
    async def update_order(
        self, 
        order_id: uuid.UUID, 
        update_data: OrderUpdateRequest
    ) -> OrderResponse:
        """Update order with validation"""
        # Get current order
        current_order = await self.get_order(order_id)
        
        # Prepare update dictionary
        update_dict = {}
        
        if update_data.status:
            # Validate status transition
            self._validate_status_transition(current_order.status, update_data.status)
            update_dict["status"] = update_data.status.value
        
        if update_data.estimated_time is not None:
            update_dict["estimated_time"] = update_data.estimated_time
        
        if update_data.priority:
            update_dict["priority"] = update_data.priority.value
        
        if update_data.special_instructions is not None:
            update_dict["special_instructions"] = update_data.special_instructions
        
        if update_data.actual_completion_time is not None:
            update_dict["actual_completion_time"] = update_data.actual_completion_time
        
        if update_data.failure_reason is not None:
            update_dict["failure_reason"] = update_data.failure_reason
        
        # Update in database
        updated_order = await self.db.update_order(order_id, update_dict)
        if not updated_order:
            raise ValidationError("Failed to update order")
        
        logger.info(f"Updated order {order_id}")
        return updated_order
    
    async def delete_order(self, order_id: uuid.UUID) -> bool:
        """Delete an order (only if not in progress)"""
        # Get current order
        current_order = await self.get_order(order_id)
        
        # Validate order can be deleted
        if current_order.status in [OrderStatus.IN_FLIGHT, OrderStatus.SCHEDULED]:
            raise InvalidStatusTransitionError(
                current_order.status.value, 
                "deleted"
            )
        
        # Delete from database
        deleted = await self.db.delete_order(order_id)
        if deleted:
            logger.info(f"Deleted order {order_id}")
        
        return deleted
    
    async def start_order(self, order_id: uuid.UUID) -> OrderResponse:
        """Start order execution (transition to scheduled)"""
        return await self.update_order_status(order_id, OrderStatus.SCHEDULED)
    
    async def abort_order(self, order_id: uuid.UUID, reason: str = "Aborted by user") -> OrderResponse:
        """Abort order execution"""
        return await self.update_order_status(order_id, OrderStatus.FAILED, reason)
    
    async def get_order_stats(self) -> OrderStatsResponse:
        """Get comprehensive order statistics"""
        return await self.db.get_order_stats()
    
    async def get_pending_orders(self) -> List[OrderResponse]:
        """Get all pending orders for processing"""
        return await self.get_orders(status=OrderStatus.PENDING)
    
    async def get_active_orders(self) -> List[OrderResponse]:
        """Get all active orders (scheduled or in-flight)"""
        scheduled = await self.get_orders(status=OrderStatus.SCHEDULED)
        in_flight = await self.get_orders(status=OrderStatus.IN_FLIGHT)
        return scheduled + in_flight
    
    async def calculate_eta(self, order_id: uuid.UUID) -> Optional[int]:
        """Calculate estimated time of arrival for an order"""
        order = await self.get_order(order_id)
        
        if order.status != OrderStatus.IN_FLIGHT:
            return None
        
        if not (order.started_at and order.estimated_time):
            return None
        
        # Calculate elapsed time
        elapsed_minutes = (datetime.utcnow() - order.started_at).total_seconds() / 60
        
        # Calculate remaining time
        remaining_minutes = order.estimated_time - elapsed_minutes
        
        return max(0, int(remaining_minutes))
    
    async def get_overdue_orders(self) -> List[OrderResponse]:
        """Get orders that are overdue"""
        active_orders = await self.get_active_orders()
        overdue_orders = []
        
        for order in active_orders:
            if order.is_overdue():
                overdue_orders.append(order)
        
        return overdue_orders
    
    async def estimate_delivery_cost(self, order: OrderResponse) -> float:
        """Estimate delivery cost based on distance and priority"""
        pickup = order.pickup_coordinates
        dropoff = order.dropoff_coordinates
        
        distance_km = pickup.distance_to(dropoff)
        
        # Base cost calculation
        base_cost = 5.00  # Base delivery fee
        distance_cost = distance_km * 2.50  # Per km rate
        
        # Priority multiplier
        priority_multipliers = {
            "low": 1.0,
            "medium": 1.2,
            "high": 1.5
        }
        
        priority_multiplier = priority_multipliers.get(order.priority.value, 1.0)
        
        total_cost = (base_cost + distance_cost) * priority_multiplier
        
        return round(total_cost, 2)
    
    def _validate_service_area(self, coordinates: Coordinates) -> None:
        """Validate coordinates are within service area"""
        center_lat = settings.service_area_center_lat
        center_lng = settings.service_area_center_lng
        max_radius_km = settings.service_area_radius_km
        
        center = Coordinates(lat=center_lat, lng=center_lng)
        distance = coordinates.distance_to(center)
        
        if distance > max_radius_km:
            raise ValidationError(
                f"Location is outside service area. "
                f"Maximum distance from center: {max_radius_km}km, "
                f"actual distance: {distance:.2f}km"
            )
    
    def _validate_status_transition(self, current_status: OrderStatus, new_status: OrderStatus) -> None:
        """Validate that status transition is allowed"""
        allowed_transitions = {
            OrderStatus.PENDING: [OrderStatus.SCHEDULED, OrderStatus.FAILED],
            OrderStatus.SCHEDULED: [OrderStatus.IN_FLIGHT, OrderStatus.FAILED],
            OrderStatus.IN_FLIGHT: [OrderStatus.COMPLETED, OrderStatus.FAILED],
            OrderStatus.COMPLETED: [],  # Terminal state
            OrderStatus.FAILED: []  # Terminal state
        }
        
        if new_status not in allowed_transitions.get(current_status, []):
            raise InvalidStatusTransitionError(current_status.value, new_status.value)
    
    async def get_delivery_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for deliveries"""
        stats = await self.get_order_stats()
        orders = await self.get_orders(limit=1000)  # Get recent orders
        
        # Calculate average delivery time by priority
        priority_times = {"low": [], "medium": [], "high": []}
        on_time_deliveries = 0
        
        for order in orders:
            if order.status == OrderStatus.COMPLETED and order.actual_completion_time:
                priority_times[order.priority.value].append(order.actual_completion_time)
                
                # Check if delivered on time (within estimated time + 20% buffer)
                if order.estimated_time:
                    buffer_time = order.estimated_time * 1.2
                    if order.actual_completion_time <= buffer_time:
                        on_time_deliveries += 1
        
        # Calculate averages
        avg_times = {}
        for priority, times in priority_times.items():
            avg_times[priority] = sum(times) / len(times) if times else 0
        
        on_time_rate = (on_time_deliveries / len(orders) * 100) if orders else 0
        
        return {
            "total_orders": stats.total_orders,
            "success_rate": stats.success_rate,
            "average_completion_time": stats.average_completion_time,
            "on_time_delivery_rate": round(on_time_rate, 2),
            "average_time_by_priority": avg_times,
            "active_orders": len(await self.get_active_orders()),
            "pending_orders": stats.pending_orders
        }