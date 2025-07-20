from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timedelta
import asyncio
import logging
from supabase import create_client, Client
from .config import settings
from ..models.orders import OrderCreateRequest, OrderResponse, OrderStatus, OrderStatsResponse
from ..models.missions import MissionResponse, MissionStatus

logger = logging.getLogger(__name__)

class DatabaseService:
    """Supabase database integration service"""
    
    def __init__(self):
        """Initialize database connection"""
        self.supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        self._connection_healthy = False
        
    async def health_check(self) -> bool:
        """Check database connection health"""
        try:
            # Simple query to test connection
            result = self.supabase.table("orders").select("id").limit(1).execute()
            self._connection_healthy = True
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            self._connection_healthy = False
            return False
    
    @property
    def is_healthy(self) -> bool:
        """Get connection health status"""
        return self._connection_healthy
    
    # Order Management Methods
    
    async def create_order(self, order_data: OrderCreateRequest) -> Optional[OrderResponse]:
        """Create a new order in the database"""
        try:
            # Prepare order data for insertion
            order_dict = {
                "id": str(uuid.uuid4()),
                "customer_id": order_data.customer_id,
                "pickup_coordinates": order_data.pickup_coordinates.dict(),
                "dropoff_coordinates": order_data.dropoff_coordinates.dict(),
                "status": OrderStatus.PENDING.value,
                "priority": order_data.priority.value,
                "estimated_time": order_data.estimated_time or order_data.estimate_flight_time(),
                "package_weight": order_data.package_weight,
                "special_instructions": order_data.special_instructions,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("orders").insert(order_dict).execute()
            
            if result.data:
                order_data = result.data[0]
                return self._dict_to_order_response(order_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to create order: {e}")
            return None
    
    async def get_order(self, order_id: uuid.UUID) -> Optional[OrderResponse]:
        """Retrieve a single order by ID"""
        try:
            result = self.supabase.table("orders").select("*").eq("id", str(order_id)).execute()
            
            if result.data:
                return self._dict_to_order_response(result.data[0])
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get order {order_id}: {e}")
            return None
    
    async def get_orders(
        self, 
        status: Optional[OrderStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[OrderResponse]:
        """Retrieve orders with optional filtering"""
        try:
            query = self.supabase.table("orders").select("*")
            
            if status:
                query = query.eq("status", status.value)
                
            query = query.order("created_at", desc=True).limit(limit).offset(offset)
            result = query.execute()
            
            orders = []
            for order_data in result.data:
                order_response = self._dict_to_order_response(order_data)
                if order_response:
                    orders.append(order_response)
            
            return orders
            
        except Exception as e:
            logger.error(f"Failed to get orders: {e}")
            return []
    
    async def update_order(
        self, 
        order_id: uuid.UUID, 
        update_data: Dict[str, Any]
    ) -> Optional[OrderResponse]:
        """Update an existing order"""
        try:
            # Add updated timestamp
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Handle status transitions with timestamps
            if "status" in update_data:
                if update_data["status"] == OrderStatus.SCHEDULED.value:
                    update_data["scheduled_at"] = datetime.utcnow().isoformat()
                elif update_data["status"] == OrderStatus.IN_FLIGHT.value:
                    update_data["started_at"] = datetime.utcnow().isoformat()
                elif update_data["status"] in [OrderStatus.COMPLETED.value, OrderStatus.FAILED.value]:
                    update_data["completed_at"] = datetime.utcnow().isoformat()
            
            result = self.supabase.table("orders").update(update_data).eq("id", str(order_id)).execute()
            
            if result.data:
                return self._dict_to_order_response(result.data[0])
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to update order {order_id}: {e}")
            return None
    
    async def delete_order(self, order_id: uuid.UUID) -> bool:
        """Delete an order"""
        try:
            result = self.supabase.table("orders").delete().eq("id", str(order_id)).execute()
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Failed to delete order {order_id}: {e}")
            return False
    
    async def get_order_stats(self) -> OrderStatsResponse:
        """Get order statistics"""
        try:
            # Get all orders
            result = self.supabase.table("orders").select("status, created_at, completed_at, started_at").execute()
            orders = result.data
            
            total_orders = len(orders)
            if total_orders == 0:
                return OrderStatsResponse(
                    total_orders=0,
                    pending_orders=0,
                    in_flight_orders=0,
                    completed_orders=0,
                    failed_orders=0,
                    success_rate=0.0
                )
            
            # Count by status
            status_counts = {}
            completion_times = []
            
            for order in orders:
                status = order.get("status", "pending")
                status_counts[status] = status_counts.get(status, 0) + 1
                
                # Calculate completion time for completed orders
                if (status == "completed" and 
                    order.get("started_at") and order.get("completed_at")):
                    try:
                        started = datetime.fromisoformat(order["started_at"].replace('Z', '+00:00'))
                        completed = datetime.fromisoformat(order["completed_at"].replace('Z', '+00:00'))
                        completion_time = (completed - started).total_seconds() / 60
                        completion_times.append(completion_time)
                    except:
                        pass
            
            completed_count = status_counts.get("completed", 0)
            failed_count = status_counts.get("failed", 0)
            success_rate = (completed_count / total_orders * 100) if total_orders > 0 else 0.0
            
            avg_completion_time = None
            if completion_times:
                avg_completion_time = sum(completion_times) / len(completion_times)
            
            return OrderStatsResponse(
                total_orders=total_orders,
                pending_orders=status_counts.get("pending", 0),
                in_flight_orders=status_counts.get("in_flight", 0),
                completed_orders=completed_count,
                failed_orders=failed_count,
                average_completion_time=avg_completion_time,
                success_rate=success_rate
            )
            
        except Exception as e:
            logger.error(f"Failed to get order stats: {e}")
            return OrderStatsResponse(
                total_orders=0,
                pending_orders=0,
                in_flight_orders=0,
                completed_orders=0,
                failed_orders=0,
                success_rate=0.0
            )
    
    # Mission Management Methods
    
    async def create_mission(self, mission_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new mission in the database"""
        try:
            mission_dict = {
                "id": str(uuid.uuid4()),
                "order_id": str(mission_data["order_id"]),
                "waypoints": mission_data["waypoints"],
                "parameters": mission_data.get("parameters", {}),
                "status": MissionStatus.CREATED.value,
                "progress": 0.0,
                "current_waypoint_index": 0,
                "description": mission_data.get("description"),
                "total_distance": mission_data.get("total_distance", 0.0),
                "estimated_time": mission_data.get("estimated_time", 0),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("missions").insert(mission_dict).execute()
            
            if result.data:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to create mission: {e}")
            return None
    
    async def get_mission(self, mission_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Retrieve a mission by ID"""
        try:
            result = self.supabase.table("missions").select("*").eq("id", str(mission_id)).execute()
            
            if result.data:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get mission {mission_id}: {e}")
            return None
    
    async def update_mission(
        self, 
        mission_id: uuid.UUID, 
        update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update mission data"""
        try:
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Handle status transitions
            if "status" in update_data:
                if update_data["status"] == MissionStatus.EXECUTING.value:
                    update_data["started_at"] = datetime.utcnow().isoformat()
                elif update_data["status"] in [
                    MissionStatus.COMPLETED.value, 
                    MissionStatus.ABORTED.value, 
                    MissionStatus.FAILED.value
                ]:
                    update_data["completed_at"] = datetime.utcnow().isoformat()
            
            result = self.supabase.table("missions").update(update_data).eq("id", str(mission_id)).execute()
            
            if result.data:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to update mission {mission_id}: {e}")
            return None
    
    async def get_missions_by_order(self, order_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Get all missions for a specific order"""
        try:
            result = self.supabase.table("missions").select("*").eq("order_id", str(order_id)).execute()
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get missions for order {order_id}: {e}")
            return []
    
    # Helper Methods
    
    def _dict_to_order_response(self, order_data: Dict[str, Any]) -> Optional[OrderResponse]:
        """Convert database dictionary to OrderResponse model"""
        try:
            # Parse timestamps
            created_at = datetime.fromisoformat(order_data["created_at"].replace('Z', '+00:00'))
            updated_at = datetime.fromisoformat(order_data["updated_at"].replace('Z', '+00:00'))
            
            scheduled_at = None
            if order_data.get("scheduled_at"):
                scheduled_at = datetime.fromisoformat(order_data["scheduled_at"].replace('Z', '+00:00'))
            
            started_at = None
            if order_data.get("started_at"):
                started_at = datetime.fromisoformat(order_data["started_at"].replace('Z', '+00:00'))
            
            completed_at = None
            if order_data.get("completed_at"):
                completed_at = datetime.fromisoformat(order_data["completed_at"].replace('Z', '+00:00'))
            
            return OrderResponse(
                id=uuid.UUID(order_data["id"]),
                customer_id=order_data["customer_id"],
                pickup_coordinates=order_data["pickup_coordinates"],
                dropoff_coordinates=order_data["dropoff_coordinates"],
                status=OrderStatus(order_data["status"]),
                priority=order_data["priority"],
                estimated_time=order_data.get("estimated_time"),
                actual_completion_time=order_data.get("actual_completion_time"),
                package_weight=order_data.get("package_weight"),
                special_instructions=order_data.get("special_instructions"),
                failure_reason=order_data.get("failure_reason"),
                created_at=created_at,
                updated_at=updated_at,
                scheduled_at=scheduled_at,
                started_at=started_at,
                completed_at=completed_at
            )
            
        except Exception as e:
            logger.error(f"Failed to convert order data: {e}")
            return None
    
    async def ensure_tables_exist(self):
        """Ensure required database tables exist (for development)"""
        # Note: In production, use Supabase migrations
        # This is a placeholder for table creation logic
        pass
    
    async def cleanup_old_records(self, days: int = 30):
        """Clean up old completed/failed orders (optional maintenance)"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Delete old completed/failed orders
            self.supabase.table("orders").delete().lt(
                "completed_at", cutoff_date.isoformat()
            ).in_("status", ["completed", "failed"]).execute()
            
            logger.info(f"Cleaned up orders older than {days} days")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old records: {e}")