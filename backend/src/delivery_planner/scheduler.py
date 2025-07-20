import asyncio
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from .core.database import SessionLocal, DeliveryOrder, OrderStatus
from .core.config import settings
from .core.logger import scheduler_logger
from .mission.mission_runner import mission_runner
from .mission.telemetry_listener import telemetry_listener
from .mission.multi_drone_mission_runner import multi_drone_mission_runner
from .mission.drone_fleet_manager import fleet_manager


class OrderScheduler:
    """Scheduler for processing pending orders and managing missions."""
    
    def __init__(self):
        self.is_running = False
        self.current_orders: dict = {}  # order_id -> drone_id mapping
        self._task: Optional[asyncio.Task] = None
        self.use_multi_drone = True  # Flag to use multi-drone system
        
    async def start(self):
        """Start the order scheduler."""
        if self.is_running:
            scheduler_logger.warning("Scheduler is already running")
            return
            
        self.is_running = True
        scheduler_logger.info("Starting order scheduler")
        
        # Connect to drone system
        await mission_runner.connect()
        
        # Start telemetry listener
        await telemetry_listener.start_listening()
        
        # Start the main scheduler loop
        self._task = asyncio.create_task(self._scheduler_loop())
        
    async def stop(self):
        """Stop the order scheduler."""
        if not self.is_running:
            return
            
        self.is_running = False
        scheduler_logger.info("Stopping order scheduler")
        
        # Cancel the scheduler task
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
                
        # Stop telemetry listener
        await telemetry_listener.stop_listening()
        
        # Disconnect from drone
        await mission_runner.disconnect()
        
    async def _scheduler_loop(self):
        """Main scheduler loop."""
        while self.is_running:
            try:
                # Check for pending orders
                await self._process_pending_orders()
                
                # Sleep before next iteration
                await asyncio.sleep(settings.scheduler_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                scheduler_logger.error(f"Error in scheduler loop: {str(e)}")
                await asyncio.sleep(settings.scheduler_interval)
                
        scheduler_logger.info("Scheduler loop stopped")
        
    async def _process_pending_orders(self):
        """Process pending orders using multi-drone system."""
        if self.use_multi_drone:
            await self._process_pending_orders_multi_drone()
        else:
            await self._process_pending_orders_single_drone()
            
    async def _process_pending_orders_multi_drone(self):
        """Process pending orders with multi-drone fleet."""
        db = SessionLocal()
        try:
            # Get available drone
            available_drone = fleet_manager.get_available_drone()
            if not available_drone:
                return  # No drones available
                
            # Get pending orders (can process multiple simultaneously)
            pending_orders = db.query(DeliveryOrder).filter(
                DeliveryOrder.status == OrderStatus.PENDING
            ).order_by(DeliveryOrder.created_at).limit(1).all()  # Process one at a time for now
            
            for pending_order in pending_orders:
                scheduler_logger.info(f"Processing pending order {pending_order.id} with multi-drone system")
                
                # Update order status to scheduled
                pending_order.status = OrderStatus.SCHEDULED
                pending_order.updated_at = datetime.now(timezone.utc)
                db.commit()
                
                # Execute mission using multi-drone system
                success = await multi_drone_mission_runner.execute_order_mission(pending_order)
                
                if success:
                    # Track the order
                    drone_id = fleet_manager.get_drone_for_order(pending_order.id)
                    if drone_id:
                        self.current_orders[pending_order.id] = drone_id
                        
                    # Update status to in-flight
                    await self._update_order_status(pending_order.id, OrderStatus.IN_FLIGHT)
                    
                    # Monitor mission in background
                    asyncio.create_task(self._monitor_multi_drone_mission(pending_order.id))
                else:
                    await self._handle_mission_failure(pending_order.id, "Failed to start multi-drone mission")
                    
                break  # Process one order at a time for now
                
        except Exception as e:
            scheduler_logger.error(f"Error processing pending orders (multi-drone): {str(e)}")
            db.rollback()
        finally:
            db.close()
            
    async def _process_pending_orders_single_drone(self):
        """Process pending orders with single drone (legacy)."""
        # Skip if we're already processing an order
        if self.current_orders:
            return
            
        db = SessionLocal()
        try:
            # Get the oldest pending order
            pending_order = db.query(DeliveryOrder).filter(
                DeliveryOrder.status == OrderStatus.PENDING
            ).order_by(DeliveryOrder.created_at).first()
            
            if not pending_order:
                return
                
            scheduler_logger.info(f"Processing pending order {pending_order.id}")
            
            # Update order status to scheduled
            pending_order.status = OrderStatus.SCHEDULED
            pending_order.updated_at = datetime.now(timezone.utc)
            db.commit()
            
            # Start mission execution
            await self._execute_mission(pending_order)
            
        except Exception as e:
            scheduler_logger.error(f"Error processing pending orders: {str(e)}")
            db.rollback()
        finally:
            db.close()
            
    async def _execute_mission(self, order: DeliveryOrder):
        """Execute a mission for the given order."""
        try:
            self.current_order = order.id
            
            # Upload mission to drone
            success = await mission_runner.upload_mission(order)
            
            if not success:
                await self._handle_mission_failure(order.id, "Failed to upload mission")
                return
                
            # Update order status to in-flight
            await self._update_order_status(order.id, OrderStatus.IN_FLIGHT)
            
            # Start mission monitoring
            telemetry_listener.start_mission_monitoring(order.id)
            
            # Start the mission
            mission_success = await mission_runner.start_mission()
            
            if not mission_success:
                await self._handle_mission_failure(order.id, "Failed to start mission")
                return
                
            scheduler_logger.info(f"Mission started for order {order.id}")
            
            # Monitor mission completion in background
            asyncio.create_task(self._monitor_mission_completion(order.id))
            
        except Exception as e:
            scheduler_logger.error(f"Error executing mission for order {order.id}: {str(e)}")
            await self._handle_mission_failure(order.id, f"Mission execution error: {str(e)}")
            
    async def _monitor_multi_drone_mission(self, order_id: str):
        """Monitor multi-drone mission completion."""
        try:
            timeout_minutes = 30
            timeout_seconds = timeout_minutes * 60
            start_time = datetime.now(timezone.utc)
            
            while order_id in self.current_orders:
                # Check if mission is still active in multi-drone system
                active_missions = multi_drone_mission_runner.get_active_missions()
                
                if order_id not in active_missions:
                    # Mission completed or failed
                    await self._handle_multi_drone_mission_completion(order_id)
                    break
                    
                # Check for timeout
                elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                if elapsed > timeout_seconds:
                    scheduler_logger.warning(f"Multi-drone mission timeout for order {order_id}")
                    await multi_drone_mission_runner.abort_mission(order_id)
                    await self._handle_mission_failure(order_id, "Mission timeout")
                    break
                    
                await asyncio.sleep(5)  # Check every 5 seconds
                
        except Exception as e:
            scheduler_logger.error(f"Error monitoring multi-drone mission: {str(e)}")
            await self._handle_mission_failure(order_id, str(e))
            
    async def _handle_multi_drone_mission_completion(self, order_id: str):
        """Handle completion of multi-drone mission."""
        try:
            scheduler_logger.info(f"Multi-drone mission completed for order {order_id}")
            
            # Update order status
            await self._update_order_status(order_id, OrderStatus.COMPLETED)
            
            # Remove from current orders
            if order_id in self.current_orders:
                del self.current_orders[order_id]
                
        except Exception as e:
            scheduler_logger.error(f"Error handling multi-drone mission completion: {str(e)}")
            
    async def _monitor_mission_completion(self, order_id: str):
        """Monitor mission completion and update order status."""
        try:
            # Wait for mission completion or timeout
            timeout_minutes = 30  # Maximum mission duration
            timeout_seconds = timeout_minutes * 60
            
            start_time = datetime.now(timezone.utc)
            
            while self.current_order == order_id:
                # Check if mission is complete
                if await mission_runner.is_mission_complete():
                    await self._handle_mission_completion(order_id)
                    break
                    
                # Check for timeout
                elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                if elapsed > timeout_seconds:
                    scheduler_logger.warning(f"Mission timeout for order {order_id}")
                    await self._handle_mission_failure(order_id, "Mission timeout")
                    break
                    
                await asyncio.sleep(5)  # Check every 5 seconds
                
        except Exception as e:
            scheduler_logger.error(f"Error monitoring mission completion: {str(e)}")
            await self._handle_mission_failure(order_id, str(e))
            
    async def _handle_mission_completion(self, order_id: str):
        """Handle successful mission completion."""
        try:
            scheduler_logger.info(f"Mission completed for order {order_id}")
            
            # Update order status
            await self._update_order_status(order_id, OrderStatus.COMPLETED)
            
            # Stop mission monitoring
            telemetry_listener.stop_mission_monitoring(order_id)
            
            # Clear current order
            self.current_order = None
            
        except Exception as e:
            scheduler_logger.error(f"Error handling mission completion: {str(e)}")
            
    async def _handle_mission_failure(self, order_id: str, error_message: str):
        """Handle mission failure."""
        try:
            scheduler_logger.error(f"Mission failed for order {order_id}: {error_message}")
            
            # Try to abort mission
            await mission_runner.abort_mission()
            
            # Update order status
            await self._update_order_status(order_id, OrderStatus.FAILED)
            
            # Stop mission monitoring
            telemetry_listener.stop_mission_monitoring(order_id)
            
            # Clear current order
            self.current_order = None
            
        except Exception as e:
            scheduler_logger.error(f"Error handling mission failure: {str(e)}")
            
    async def _update_order_status(self, order_id: str, status: OrderStatus):
        """Update order status in database."""
        db = SessionLocal()
        try:
            order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
            if order:
                order.status = status
                order.updated_at = datetime.now(timezone.utc)
                db.commit()
                scheduler_logger.info(f"Updated order {order_id} status to {status}")
            else:
                scheduler_logger.warning(f"Order {order_id} not found for status update")
                
        except Exception as e:
            scheduler_logger.error(f"Error updating order status: {str(e)}")
            db.rollback()
        finally:
            db.close()
            
    async def force_complete_order(self, order_id: str):
        """Force complete an order (for testing/admin purposes)."""
        scheduler_logger.info(f"Force completing order {order_id}")
        await self._handle_mission_completion(order_id)
        
    async def force_fail_order(self, order_id: str, reason: str = "Manually failed"):
        """Force fail an order (for testing/admin purposes)."""
        scheduler_logger.info(f"Force failing order {order_id}: {reason}")
        await self._handle_mission_failure(order_id, reason)
        
    def get_status(self) -> dict:
        """Get scheduler status."""
        if self.use_multi_drone:
            fleet_stats = fleet_manager.get_fleet_statistics()
            active_missions = multi_drone_mission_runner.get_active_missions()
            
            return {
                "is_running": self.is_running,
                "mode": "multi_drone",
                "current_orders": self.current_orders,
                "active_missions": len(active_missions),
                "fleet_status": fleet_stats,
                "telemetry_active": telemetry_listener.is_listening
            }
        else:
            return {
                "is_running": self.is_running,
                "mode": "single_drone",
                "current_order": getattr(self, 'current_order', None),
                "drone_connected": mission_runner.is_connected,
                "telemetry_active": telemetry_listener.is_listening
            }


# Global scheduler instance
order_scheduler = OrderScheduler()