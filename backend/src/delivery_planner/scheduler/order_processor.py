import asyncio
import logging
from typing import List, Optional
from datetime import datetime, timedelta

from ..core.config import settings
from ..core.exceptions import MissionExecutionError
from ..models.orders import OrderResponse, OrderStatus, Priority
from ..services.order_service import OrderService
from ..services.mission_service import MissionService
from ..services.drone_service import DroneService
from ..utils.websocket import websocket_manager

logger = logging.getLogger(__name__)

class OrderProcessor:
    """Automated order processing and mission scheduling"""
    
    def __init__(
        self, 
        order_service: OrderService,
        mission_service: MissionService,
        drone_service: DroneService
    ):
        self.order_service = order_service
        self.mission_service = mission_service
        self.drone_service = drone_service
        self.is_running = False
        self.processing_task = None
        self.active_missions = {}
        self.last_health_check = None
        
    async def start(self):
        """Start the order processing loop"""
        if self.is_running:
            logger.warning("Order processor is already running")
            return
            
        self.is_running = True
        self.processing_task = asyncio.create_task(self._processing_loop())
        logger.info("Order processor started")
        
    async def stop(self):
        """Stop the order processing loop"""
        self.is_running = False
        
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
                
        logger.info("Order processor stopped")
    
    async def _processing_loop(self):
        """Main processing loop"""
        while self.is_running:
            try:
                # Health check
                await self._perform_health_check()
                
                # Process pending orders
                await self._process_pending_orders()
                
                # Check scheduled orders
                await self._check_scheduled_orders()
                
                # Monitor active missions
                await self._monitor_active_missions()
                
                # Check for overdue orders
                await self._check_overdue_orders()
                
                # Wait for next cycle
                await asyncio.sleep(settings.order_processing_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in order processing loop: {e}")
                await asyncio.sleep(10)  # Wait longer on error
    
    async def _perform_health_check(self):
        """Perform periodic health checks"""
        now = datetime.utcnow()
        
        if (self.last_health_check is None or 
            (now - self.last_health_check).seconds > settings.health_check_interval):
            
            try:
                # Check drone connection
                if not self.drone_service.is_connected:
                    logger.warning("Drone not connected - attempting reconnection")
                    await self.drone_service.connect_to_drone()
                
                # Send health update via WebSocket
                health_data = {
                    "drone_connected": self.drone_service.is_connected,
                    "active_missions": len(self.active_missions),
                    "processor_status": "running" if self.is_running else "stopped"
                }
                
                await websocket_manager.send_alert(
                    {"health_status": health_data},
                    severity="info"
                )
                
                self.last_health_check = now
                
            except Exception as e:
                logger.error(f"Health check failed: {e}")
    
    async def _process_pending_orders(self):
        """Process all pending orders"""
        try:
            pending_orders = await self.order_service.get_pending_orders()
            
            if not pending_orders:
                return
            
            logger.info(f"Processing {len(pending_orders)} pending orders")
            
            # Sort by priority and creation time
            sorted_orders = self._prioritize_orders(pending_orders)
            
            for order in sorted_orders:
                try:
                    await self._process_single_order(order)
                except Exception as e:
                    logger.error(f"Failed to process order {order.id}: {e}")
                    
                    # Mark order as failed
                    await self.order_service.update_order_status(
                        order.id, 
                        OrderStatus.FAILED,
                        failure_reason=f"Processing failed: {str(e)}"
                    )
                    
        except Exception as e:
            logger.error(f"Error processing pending orders: {e}")
    
    async def _process_single_order(self, order: OrderResponse):
        """Process a single order into a mission"""
        try:
            # Check if we can accept more missions
            if len(self.active_missions) >= settings.max_concurrent_missions:
                logger.info(f"Max concurrent missions reached, skipping order {order.id}")
                return
            
            # Create mission from order
            mission_data = await self.mission_service.create_mission_from_order(order)
            
            # Update order status to scheduled
            await self.order_service.update_order_status(order.id, OrderStatus.SCHEDULED)
            
            # Send order update notification
            await websocket_manager.send_order_update({
                "order_id": str(order.id),
                "status": "scheduled",
                "mission_id": mission_data["id"]
            })
            
            logger.info(f"Order {order.id} scheduled with mission {mission_data['id']}")
            
        except Exception as e:
            logger.error(f"Failed to process order {order.id}: {e}")
            raise
    
    async def _check_scheduled_orders(self):
        """Check scheduled orders and start missions when ready"""
        try:
            # Get scheduled orders
            scheduled_orders = await self.order_service.get_orders(status=OrderStatus.SCHEDULED)
            
            for order in scheduled_orders:
                try:
                    # Check if drone is available and connected
                    if not self.drone_service.is_connected:
                        continue
                    
                    # Check mission capacity
                    if len(self.active_missions) >= settings.max_concurrent_missions:
                        continue
                    
                    # Get missions for this order
                    missions = await self.mission_service.get_missions_by_order(order.id)
                    
                    if not missions:
                        logger.warning(f"No missions found for scheduled order {order.id}")
                        continue
                    
                    mission = missions[0]  # Take the first mission
                    
                    # Execute the mission
                    success = await self.mission_service.execute_mission(mission["id"])
                    
                    if success:
                        # Update order status
                        await self.order_service.update_order_status(order.id, OrderStatus.IN_FLIGHT)
                        
                        # Track active mission
                        self.active_missions[mission["id"]] = {
                            "order_id": order.id,
                            "started_at": datetime.utcnow(),
                            "mission_data": mission
                        }
                        
                        # Send mission update
                        await websocket_manager.send_mission_update({
                            "mission_id": mission["id"],
                            "order_id": str(order.id),
                            "status": "executing"
                        })
                        
                        logger.info(f"Started mission {mission['id']} for order {order.id}")
                    
                except Exception as e:
                    logger.error(f"Failed to start mission for order {order.id}: {e}")
                    
                    # Mark order as failed
                    await self.order_service.update_order_status(
                        order.id,
                        OrderStatus.FAILED,
                        failure_reason=f"Mission start failed: {str(e)}"
                    )
                    
        except Exception as e:
            logger.error(f"Error checking scheduled orders: {e}")
    
    async def _monitor_active_missions(self):
        """Monitor active missions for completion or failure"""
        completed_missions = []
        
        for mission_id, mission_info in self.active_missions.items():
            try:
                # Get current mission status
                mission = await self.mission_service.get_mission(mission_id)
                
                if mission["status"] in ["completed", "failed", "aborted"]:
                    # Mission finished
                    order_id = mission_info["order_id"]
                    
                    if mission["status"] == "completed":
                        # Mark order as completed
                        await self.order_service.update_order_status(order_id, OrderStatus.COMPLETED)
                        
                        # Send completion notification
                        await websocket_manager.send_order_update({
                            "order_id": str(order_id),
                            "status": "completed",
                            "mission_id": mission_id
                        })
                        
                        logger.info(f"Mission {mission_id} completed successfully")
                        
                    else:
                        # Mission failed or aborted
                        failure_reason = mission.get("failure_reason", f"Mission {mission['status']}")
                        await self.order_service.update_order_status(
                            order_id,
                            OrderStatus.FAILED,
                            failure_reason=failure_reason
                        )
                        
                        logger.warning(f"Mission {mission_id} {mission['status']}: {failure_reason}")
                    
                    completed_missions.append(mission_id)
                
                else:
                    # Check for mission timeout
                    elapsed_time = datetime.utcnow() - mission_info["started_at"]
                    if elapsed_time.seconds > settings.mission_timeout_seconds:
                        
                        logger.warning(f"Mission {mission_id} timed out after {elapsed_time.seconds}s")
                        
                        # Abort the mission
                        await self.mission_service.abort_mission(mission_id, "Mission timeout")
                        
                        # Mark order as failed
                        await self.order_service.update_order_status(
                            mission_info["order_id"],
                            OrderStatus.FAILED,
                            failure_reason="Mission timeout"
                        )
                        
                        completed_missions.append(mission_id)
                
            except Exception as e:
                logger.error(f"Error monitoring mission {mission_id}: {e}")
        
        # Remove completed missions from tracking
        for mission_id in completed_missions:
            del self.active_missions[mission_id]
    
    async def _check_overdue_orders(self):
        """Check for overdue orders and send alerts"""
        try:
            overdue_orders = await self.order_service.get_overdue_orders()
            
            if overdue_orders:
                # Send alert for overdue orders
                await websocket_manager.send_alert(
                    {
                        "message": f"{len(overdue_orders)} orders are overdue",
                        "overdue_count": len(overdue_orders),
                        "order_ids": [str(order.id) for order in overdue_orders]
                    },
                    severity="warning"
                )
                
                logger.warning(f"Found {len(overdue_orders)} overdue orders")
                
        except Exception as e:
            logger.error(f"Error checking overdue orders: {e}")
    
    def _prioritize_orders(self, orders: List[OrderResponse]) -> List[OrderResponse]:
        """Prioritize orders based on priority and creation time"""
        priority_weights = {
            Priority.HIGH: 3,
            Priority.MEDIUM: 2,
            Priority.LOW: 1
        }
        
        def sort_key(order):
            priority_weight = priority_weights.get(order.priority, 1)
            # Earlier orders get higher priority (negative timestamp)
            time_weight = -order.created_at.timestamp()
            return (priority_weight * 1000000 + time_weight)
        
        return sorted(orders, key=sort_key, reverse=True)
    
    def get_status(self) -> dict:
        """Get current processor status"""
        return {
            "is_running": self.is_running,
            "active_missions": len(self.active_missions),
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "drone_connected": self.drone_service.is_connected,
            "mission_details": [
                {
                    "mission_id": mission_id,
                    "order_id": str(info["order_id"]),
                    "started_at": info["started_at"].isoformat(),
                    "duration_seconds": (datetime.utcnow() - info["started_at"]).seconds
                }
                for mission_id, info in self.active_missions.items()
            ]
        }