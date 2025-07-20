import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from enum import Enum

from ..core.config import settings
from ..models.missions import MissionStatus
from ..services.mission_service import MissionService
from ..services.drone_service import DroneService
from ..utils.websocket import websocket_manager

logger = logging.getLogger(__name__)

class SchedulerMode(str, Enum):
    """Mission scheduler modes"""
    MANUAL = "manual"          # Manual mission execution only
    SEMI_AUTO = "semi_auto"    # Auto-schedule but require manual approval
    FULL_AUTO = "full_auto"    # Fully automated scheduling

class MissionQueue:
    """Priority queue for mission scheduling"""
    
    def __init__(self):
        self.high_priority = []
        self.medium_priority = []
        self.low_priority = []
        self.scheduled = []
    
    def add_mission(self, mission_data: dict, priority: str = "medium"):
        """Add mission to appropriate queue"""
        if priority == "high":
            self.high_priority.append(mission_data)
        elif priority == "low":
            self.low_priority.append(mission_data)
        else:
            self.medium_priority.append(mission_data)
    
    def get_next_mission(self) -> Optional[dict]:
        """Get next mission based on priority"""
        if self.high_priority:
            return self.high_priority.pop(0)
        elif self.medium_priority:
            return self.medium_priority.pop(0)
        elif self.low_priority:
            return self.low_priority.pop(0)
        return None
    
    def get_queue_status(self) -> dict:
        """Get current queue status"""
        return {
            "high_priority": len(self.high_priority),
            "medium_priority": len(self.medium_priority),
            "low_priority": len(self.low_priority),
            "scheduled": len(self.scheduled),
            "total": len(self.high_priority) + len(self.medium_priority) + len(self.low_priority)
        }

class MissionScheduler:
    """Advanced mission scheduling and resource management"""
    
    def __init__(self, mission_service: MissionService, drone_service: DroneService):
        self.mission_service = mission_service
        self.drone_service = drone_service
        self.mission_queue = MissionQueue()
        self.is_running = False
        self.scheduler_task = None
        self.mode = SchedulerMode.SEMI_AUTO
        
        # Scheduling parameters
        self.max_queue_size = 50
        self.scheduling_interval = 10  # seconds
        self.resource_check_interval = 30  # seconds
        
        # Statistics
        self.stats = {
            "missions_scheduled": 0,
            "missions_completed": 0,
            "missions_failed": 0,
            "total_flight_time": 0,
            "average_queue_time": 0
        }
        
        # Resource tracking
        self.drone_resources = {
            "battery_level": 100.0,
            "flight_time_remaining": 30.0,  # minutes
            "maintenance_due": False,
            "weather_suitable": True
        }
    
    async def start(self):
        """Start the mission scheduler"""
        if self.is_running:
            logger.warning("Mission scheduler is already running")
            return
        
        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info(f"Mission scheduler started in {self.mode} mode")
    
    async def stop(self):
        """Stop the mission scheduler"""
        self.is_running = False
        
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Mission scheduler stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                # Update resource status
                await self._update_resource_status()
                
                # Process mission queue
                await self._process_mission_queue()
                
                # Check for completed missions
                await self._check_mission_completion()
                
                # Optimize scheduling
                await self._optimize_schedule()
                
                # Send status update
                await self._send_status_update()
                
                await asyncio.sleep(self.scheduling_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(30)  # Wait longer on error
    
    async def schedule_mission(self, mission_data: dict, priority: str = "medium") -> bool:
        """Schedule a new mission"""
        try:
            # Validate mission data
            if not self._validate_mission(mission_data):
                logger.warning(f"Mission validation failed: {mission_data.get('id', 'unknown')}")
                return False
            
            # Check queue capacity
            if self.mission_queue.get_queue_status()["total"] >= self.max_queue_size:
                logger.warning("Mission queue is full, cannot schedule new mission")
                return False
            
            # Add to queue
            self.mission_queue.add_mission(mission_data, priority)
            self.stats["missions_scheduled"] += 1
            
            # Send notification
            await websocket_manager.send_mission_update({
                "mission_id": mission_data["id"],
                "status": "queued",
                "priority": priority,
                "queue_position": self._get_queue_position(mission_data["id"])
            })
            
            logger.info(f"Mission {mission_data['id']} scheduled with {priority} priority")
            return True
            
        except Exception as e:
            logger.error(f"Failed to schedule mission: {e}")
            return False
    
    async def _process_mission_queue(self):
        """Process missions in the queue"""
        if not self._can_execute_mission():
            return
        
        # Get next mission from queue
        next_mission = self.mission_queue.get_next_mission()
        if not next_mission:
            return
        
        try:
            if self.mode == SchedulerMode.FULL_AUTO:
                # Automatically execute mission
                await self._execute_queued_mission(next_mission)
                
            elif self.mode == SchedulerMode.SEMI_AUTO:
                # Request approval for execution
                await self._request_mission_approval(next_mission)
                
            else:  # MANUAL mode
                # Just notify that mission is ready
                await websocket_manager.send_mission_update({
                    "mission_id": next_mission["id"],
                    "status": "ready_for_manual_execution",
                    "message": "Mission ready for manual approval"
                })
                
        except Exception as e:
            logger.error(f"Failed to process queued mission {next_mission['id']}: {e}")
    
    async def _execute_queued_mission(self, mission_data: dict):
        """Execute a mission from the queue"""
        try:
            mission_id = mission_data["id"]
            
            # Execute the mission
            success = await self.mission_service.execute_mission(mission_id)
            
            if success:
                # Move to scheduled list
                self.mission_queue.scheduled.append(mission_data)
                
                # Update statistics
                self.stats["missions_completed"] += 1
                
                # Send notification
                await websocket_manager.send_mission_update({
                    "mission_id": mission_id,
                    "status": "executing",
                    "scheduled_at": datetime.utcnow().isoformat()
                })
                
                logger.info(f"Successfully executed queued mission {mission_id}")
                
            else:
                self.stats["missions_failed"] += 1
                logger.error(f"Failed to execute queued mission {mission_id}")
                
        except Exception as e:
            logger.error(f"Error executing queued mission: {e}")
            self.stats["missions_failed"] += 1
    
    async def _request_mission_approval(self, mission_data: dict):
        """Request approval for mission execution"""
        approval_request = {
            "type": "mission_approval_request",
            "mission_id": mission_data["id"],
            "mission_data": mission_data,
            "estimated_duration": mission_data.get("estimated_time", 0),
            "battery_required": self._estimate_battery_usage(mission_data),
            "weather_conditions": await self._get_weather_conditions(),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await websocket_manager.send_alert(approval_request, severity="info")
        logger.info(f"Requested approval for mission {mission_data['id']}")
    
    async def approve_mission(self, mission_id: str, approved: bool = True) -> bool:
        """Approve or reject a mission for execution"""
        try:
            if approved:
                # Find mission in queue and execute
                for queue in [self.mission_queue.high_priority, 
                             self.mission_queue.medium_priority, 
                             self.mission_queue.low_priority]:
                    for mission in queue:
                        if mission["id"] == mission_id:
                            queue.remove(mission)
                            await self._execute_queued_mission(mission)
                            return True
                
                logger.warning(f"Mission {mission_id} not found in queue for approval")
                return False
                
            else:
                # Remove from queue
                for queue in [self.mission_queue.high_priority,
                             self.mission_queue.medium_priority,
                             self.mission_queue.low_priority]:
                    queue[:] = [m for m in queue if m["id"] != mission_id]
                
                await websocket_manager.send_mission_update({
                    "mission_id": mission_id,
                    "status": "rejected",
                    "message": "Mission rejected by operator"
                })
                
                logger.info(f"Mission {mission_id} rejected")
                return True
                
        except Exception as e:
            logger.error(f"Error processing mission approval: {e}")
            return False
    
    async def _update_resource_status(self):
        """Update drone and system resource status"""
        try:
            if self.drone_service.is_connected:
                # Get current telemetry
                telemetry = await self.drone_service.get_telemetry()
                
                self.drone_resources.update({
                    "battery_level": telemetry.status.battery_remaining,
                    "flight_time_remaining": self._estimate_flight_time_remaining(
                        telemetry.status.battery_remaining
                    ),
                    "weather_suitable": await self._check_weather_conditions()
                })
                
        except Exception as e:
            logger.error(f"Failed to update resource status: {e}")
    
    async def _check_mission_completion(self):
        """Check for completed scheduled missions"""
        completed_missions = []
        
        for mission in self.mission_queue.scheduled:
            try:
                mission_data = await self.mission_service.get_mission(mission["id"])
                
                if mission_data["status"] in ["completed", "failed", "aborted"]:
                    completed_missions.append(mission)
                    
                    # Update statistics
                    if mission_data["status"] == "completed":
                        self.stats["missions_completed"] += 1
                        if "actual_duration" in mission_data:
                            self.stats["total_flight_time"] += mission_data["actual_duration"]
                    else:
                        self.stats["missions_failed"] += 1
                        
            except Exception as e:
                logger.error(f"Error checking mission completion: {e}")
        
        # Remove completed missions
        for mission in completed_missions:
            self.mission_queue.scheduled.remove(mission)
    
    async def _optimize_schedule(self):
        """Optimize mission scheduling based on various factors"""
        try:
            # Sort missions by priority and efficiency
            self._sort_mission_queues()
            
            # Check for mission conflicts
            await self._resolve_mission_conflicts()
            
            # Optimize for battery usage
            self._optimize_for_battery()
            
        except Exception as e:
            logger.error(f"Error optimizing schedule: {e}")
    
    def _sort_mission_queues(self):
        """Sort missions within each priority queue"""
        for queue in [self.mission_queue.high_priority,
                     self.mission_queue.medium_priority,
                     self.mission_queue.low_priority]:
            queue.sort(key=lambda m: self._calculate_mission_score(m), reverse=True)
    
    def _calculate_mission_score(self, mission_data: dict) -> float:
        """Calculate priority score for mission scheduling"""
        score = 0.0
        
        # Time factor (older missions get higher score)
        created_at = datetime.fromisoformat(mission_data.get("created_at", datetime.utcnow().isoformat()))
        age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600
        score += age_hours * 10
        
        # Distance factor (shorter distances get higher score for efficiency)
        distance = mission_data.get("total_distance", 0)
        if distance > 0:
            score += (1.0 / distance) * 100
        
        # Battery efficiency factor
        estimated_battery = self._estimate_battery_usage(mission_data)
        if estimated_battery < 20:  # Prefer missions that use less battery
            score += 50
        
        return score
    
    def _can_execute_mission(self) -> bool:
        """Check if we can execute a mission based on current resources"""
        return (
            self.drone_service.is_connected and
            self.drone_resources["battery_level"] > 30 and  # Minimum battery level
            self.drone_resources["weather_suitable"] and
            not self.drone_resources["maintenance_due"] and
            len(self.mission_queue.scheduled) < settings.max_concurrent_missions
        )
    
    def _validate_mission(self, mission_data: dict) -> bool:
        """Validate mission data before scheduling"""
        required_fields = ["id", "waypoints", "estimated_time"]
        return all(field in mission_data for field in required_fields)
    
    def _estimate_battery_usage(self, mission_data: dict) -> float:
        """Estimate battery usage for a mission"""
        # Simplified battery estimation
        distance = mission_data.get("total_distance", 0)
        return min(100.0, distance * 2.0)  # 2% per km
    
    def _estimate_flight_time_remaining(self, battery_level: float) -> float:
        """Estimate remaining flight time based on battery"""
        # Simplified calculation: 30 minutes at full battery
        return (battery_level / 100.0) * 30.0
    
    async def _check_weather_conditions(self) -> bool:
        """Check if weather conditions are suitable for flight"""
        # Placeholder - in real implementation, integrate with weather API
        return True
    
    async def _get_weather_conditions(self) -> dict:
        """Get current weather conditions"""
        # Placeholder weather data
        return {
            "wind_speed": 5.0,
            "visibility": "good",
            "precipitation": "none",
            "temperature": 20.0
        }
    
    async def _resolve_mission_conflicts(self):
        """Resolve conflicts between missions"""
        # Placeholder for conflict resolution logic
        pass
    
    def _optimize_for_battery(self):
        """Optimize mission order for battery efficiency"""
        # Group missions by proximity to minimize travel
        pass
    
    def _get_queue_position(self, mission_id: str) -> int:
        """Get position of mission in queue"""
        for i, mission in enumerate(self.mission_queue.high_priority):
            if mission["id"] == mission_id:
                return i + 1
        
        offset = len(self.mission_queue.high_priority)
        for i, mission in enumerate(self.mission_queue.medium_priority):
            if mission["id"] == mission_id:
                return offset + i + 1
        
        offset += len(self.mission_queue.medium_priority)
        for i, mission in enumerate(self.mission_queue.low_priority):
            if mission["id"] == mission_id:
                return offset + i + 1
        
        return -1
    
    async def _send_status_update(self):
        """Send scheduler status update via WebSocket"""
        status = {
            "scheduler_mode": self.mode,
            "queue_status": self.mission_queue.get_queue_status(),
            "resource_status": self.drone_resources,
            "statistics": self.stats,
            "is_running": self.is_running
        }
        
        await websocket_manager.broadcast(
            {"type": "scheduler_status", "data": status},
            topic="scheduler"
        )
    
    def get_status(self) -> dict:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "mode": self.mode,
            "queue_status": self.mission_queue.get_queue_status(),
            "resource_status": self.drone_resources,
            "statistics": self.stats
        }
    
    def set_mode(self, mode: SchedulerMode):
        """Set scheduler mode"""
        self.mode = mode
        logger.info(f"Scheduler mode changed to {mode}")
    
    def clear_queue(self):
        """Clear all missions from queue"""
        self.mission_queue = MissionQueue()
        logger.info("Mission queue cleared")