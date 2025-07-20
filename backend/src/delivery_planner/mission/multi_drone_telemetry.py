import asyncio
import json
from typing import Dict, List, Optional, Callable, Set
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

from ..core.schemas import TelemetryData, StatusUpdate
from ..core.logger import mission_logger
from .drone_fleet_manager import fleet_manager, DroneStatus
from .multi_drone_mission_runner import multi_drone_mission_runner


@dataclass
class FleetTelemetryData:
    """Aggregated telemetry data for the entire fleet."""
    timestamp: datetime
    total_drones: int
    active_drones: int
    missions_in_progress: int
    average_battery_level: float
    fleet_status: str
    drone_positions: Dict[str, Dict]  # drone_id -> position data


@dataclass
class DroneHealthMetrics:
    """Health metrics for a single drone."""
    drone_id: str
    is_healthy: bool
    battery_level: float
    connection_status: str
    last_telemetry_update: datetime
    warning_messages: List[str]
    error_messages: List[str]


class MultiDroneTelemetryAggregator:
    """Aggregates and manages telemetry data from multiple drones."""
    
    def __init__(self):
        self.is_monitoring = False
        self.telemetry_callbacks: List[Callable[[TelemetryData], None]] = []
        self.fleet_callbacks: List[Callable[[FleetTelemetryData], None]] = []
        self.status_callbacks: List[Callable[[StatusUpdate], None]] = []
        self.health_callbacks: List[Callable[[DroneHealthMetrics], None]] = []
        
        self.drone_telemetry_history: Dict[str, List[TelemetryData]] = {}
        self.drone_health_status: Dict[str, DroneHealthMetrics] = {}
        self.last_fleet_update = datetime.now(timezone.utc)
        
        # Monitoring configuration
        self.telemetry_update_interval = 1.0  # seconds
        self.health_check_interval = 5.0  # seconds
        self.max_history_length = 100
        
    def add_telemetry_callback(self, callback: Callable[[TelemetryData], None]):
        """Add a callback for individual drone telemetry."""
        self.telemetry_callbacks.append(callback)
        
    def add_fleet_callback(self, callback: Callable[[FleetTelemetryData], None]):
        """Add a callback for fleet-wide telemetry."""
        self.fleet_callbacks.append(callback)
        
    def add_status_callback(self, callback: Callable[[StatusUpdate], None]):
        """Add a callback for status updates."""
        self.status_callbacks.append(callback)
        
    def add_health_callback(self, callback: Callable[[DroneHealthMetrics], None]):
        """Add a callback for drone health updates."""
        self.health_callbacks.append(callback)
        
    def remove_callback(self, callback):
        """Remove a callback from all lists."""
        for callback_list in [self.telemetry_callbacks, self.fleet_callbacks, 
                             self.status_callbacks, self.health_callbacks]:
            if callback in callback_list:
                callback_list.remove(callback)
                
    async def start_monitoring(self):
        """Start telemetry monitoring for all drones."""
        if self.is_monitoring:
            return
            
        self.is_monitoring = True
        mission_logger.info("Starting multi-drone telemetry monitoring")
        
        # Start monitoring tasks
        asyncio.create_task(self._telemetry_monitoring_loop())
        asyncio.create_task(self._health_monitoring_loop())
        asyncio.create_task(self._fleet_aggregation_loop())
        
    async def stop_monitoring(self):
        """Stop telemetry monitoring."""
        self.is_monitoring = False
        mission_logger.info("Stopping multi-drone telemetry monitoring")
        
    async def _telemetry_monitoring_loop(self):
        """Main loop for collecting telemetry from all drones."""
        while self.is_monitoring:
            try:
                current_time = datetime.now(timezone.utc)
                
                # Collect telemetry from all drones
                for drone_id, drone_info in fleet_manager.drones.items():
                    if drone_info.is_connected:
                        telemetry = await self._collect_drone_telemetry(drone_id, current_time)
                        if telemetry:
                            # Store in history
                            if drone_id not in self.drone_telemetry_history:
                                self.drone_telemetry_history[drone_id] = []
                            
                            self.drone_telemetry_history[drone_id].append(telemetry)
                            
                            # Limit history length
                            if len(self.drone_telemetry_history[drone_id]) > self.max_history_length:
                                self.drone_telemetry_history[drone_id] = \
                                    self.drone_telemetry_history[drone_id][-self.max_history_length:]
                                    
                            # Broadcast telemetry
                            self._broadcast_telemetry(telemetry)
                            
                await asyncio.sleep(self.telemetry_update_interval)
                
            except Exception as e:
                mission_logger.error(f"Error in telemetry monitoring loop: {str(e)}")
                await asyncio.sleep(1.0)
                
    async def _collect_drone_telemetry(self, drone_id: str, timestamp: datetime) -> Optional[TelemetryData]:
        """Collect telemetry data from a specific drone."""
        try:
            drone_info = fleet_manager.drones.get(drone_id)
            if not drone_info:
                return None
                
            # Get position from the multi-drone mission runner
            position = await multi_drone_mission_runner.get_drone_position(drone_id)
            if not position:
                return None
                
            # Get current order for this drone
            current_order_id = drone_info.current_order_id
            if not current_order_id:
                # No active mission, return basic telemetry
                current_order_id = f"standby_{drone_id}"
                
            # Calculate mission progress if there's an active mission
            mission_progress = 0.0
            if drone_info.current_order_id:
                mission_progress = await self._calculate_mission_progress(drone_id)
                
            telemetry = TelemetryData(
                order_id=current_order_id,
                latitude=position.latitude,
                longitude=position.longitude,
                altitude=position.altitude,
                ground_speed=position.ground_speed,
                heading=position.heading,
                battery_remaining=position.battery_remaining,
                mission_progress=mission_progress,
                timestamp=timestamp
            )
            
            return telemetry
            
        except Exception as e:
            mission_logger.error(f"Error collecting telemetry for drone {drone_id}: {str(e)}")
            return None
            
    async def _calculate_mission_progress(self, drone_id: str) -> float:
        """Calculate mission progress for a drone."""
        try:
            drone_info = fleet_manager.drones.get(drone_id)
            if not drone_info or not drone_info.current_order_id:
                return 0.0
                
            # Check if this drone has an active mission
            active_missions = multi_drone_mission_runner.get_active_missions()
            order_id = drone_info.current_order_id
            
            if order_id not in active_missions:
                return 0.0
                
            # Get telemetry history for progress calculation
            if drone_id in self.drone_telemetry_history:
                history = self.drone_telemetry_history[drone_id]
                if len(history) >= 2:
                    # Calculate based on time elapsed (simplified)
                    start_time = history[0].timestamp
                    current_time = datetime.now(timezone.utc)
                    elapsed = (current_time - start_time).total_seconds()
                    
                    # Assume 5-minute missions for now
                    estimated_duration = 300.0
                    progress = min(elapsed / estimated_duration, 1.0)
                    return progress
                    
            return 0.0
            
        except Exception as e:
            mission_logger.error(f"Error calculating mission progress for drone {drone_id}: {str(e)}")
            return 0.0
            
    async def _health_monitoring_loop(self):
        """Monitor health status of all drones."""
        while self.is_monitoring:
            try:
                current_time = datetime.now(timezone.utc)
                
                for drone_id, drone_info in fleet_manager.drones.items():
                    health_metrics = self._assess_drone_health(drone_id, drone_info, current_time)
                    self.drone_health_status[drone_id] = health_metrics
                    
                    # Broadcast health updates
                    self._broadcast_health_metrics(health_metrics)
                    
                await asyncio.sleep(self.health_check_interval)
                
            except Exception as e:
                mission_logger.error(f"Error in health monitoring loop: {str(e)}")
                await asyncio.sleep(5.0)
                
    def _assess_drone_health(self, drone_id: str, drone_info, current_time: datetime) -> DroneHealthMetrics:
        """Assess the health status of a drone."""
        warnings = []
        errors = []
        is_healthy = True
        
        # Check battery level
        if drone_info.battery_level < 0.2:
            warnings.append(f"Low battery: {drone_info.battery_level:.1%}")
        if drone_info.battery_level < 0.1:
            errors.append(f"Critical battery: {drone_info.battery_level:.1%}")
            is_healthy = False
            
        # Check connection status
        connection_status = "connected" if drone_info.is_connected else "disconnected"
        if not drone_info.is_connected:
            errors.append("Drone not connected")
            is_healthy = False
            
        # Check for stale telemetry
        if drone_id in self.drone_telemetry_history:
            last_telemetry = self.drone_telemetry_history[drone_id][-1] if self.drone_telemetry_history[drone_id] else None
            if last_telemetry:
                time_since_update = (current_time - last_telemetry.timestamp).total_seconds()
                if time_since_update > 10:  # No update for 10 seconds
                    warnings.append(f"Stale telemetry: {time_since_update:.1f}s ago")
                    last_update = last_telemetry.timestamp
                else:
                    last_update = current_time
            else:
                last_update = current_time
                warnings.append("No telemetry data available")
        else:
            last_update = current_time
            warnings.append("No telemetry history")
            
        # Check drone status
        if drone_info.status == DroneStatus.ERROR:
            errors.append(f"Drone in error state: {drone_info.status}")
            is_healthy = False
        elif drone_info.status == DroneStatus.OFFLINE:
            errors.append("Drone offline")
            is_healthy = False
            
        return DroneHealthMetrics(
            drone_id=drone_id,
            is_healthy=is_healthy,
            battery_level=drone_info.battery_level,
            connection_status=connection_status,
            last_telemetry_update=last_update,
            warning_messages=warnings,
            error_messages=errors
        )
        
    async def _fleet_aggregation_loop(self):
        """Aggregate fleet-wide telemetry data."""
        while self.is_monitoring:
            try:
                current_time = datetime.now(timezone.utc)
                fleet_data = self._aggregate_fleet_telemetry(current_time)
                
                if fleet_data:
                    self._broadcast_fleet_telemetry(fleet_data)
                    
                await asyncio.sleep(2.0)  # Fleet updates every 2 seconds
                
            except Exception as e:
                mission_logger.error(f"Error in fleet aggregation loop: {str(e)}")
                await asyncio.sleep(2.0)
                
    def _aggregate_fleet_telemetry(self, timestamp: datetime) -> Optional[FleetTelemetryData]:
        """Aggregate telemetry data from all drones."""
        try:
            total_drones = len(fleet_manager.drones)
            active_drones = sum(1 for d in fleet_manager.drones.values() if d.is_connected)
            
            # Get active missions
            active_missions = multi_drone_mission_runner.get_active_missions()
            missions_in_progress = len(active_missions)
            
            # Calculate average battery level
            if fleet_manager.drones:
                avg_battery = sum(d.battery_level for d in fleet_manager.drones.values()) / total_drones
            else:
                avg_battery = 0.0
                
            # Determine fleet status
            if missions_in_progress > 0:
                fleet_status = "active_missions"
            elif active_drones == total_drones:
                fleet_status = "all_online"
            elif active_drones > 0:
                fleet_status = "partial_online"
            else:
                fleet_status = "offline"
                
            # Collect drone positions
            drone_positions = {}
            for drone_id, drone_info in fleet_manager.drones.items():
                if drone_info.last_position:
                    lat, lon, alt = drone_info.last_position
                    drone_positions[drone_id] = {
                        "latitude": lat,
                        "longitude": lon,
                        "altitude": alt,
                        "status": drone_info.status.value,
                        "battery": drone_info.battery_level,
                        "order_id": drone_info.current_order_id
                    }
                    
            return FleetTelemetryData(
                timestamp=timestamp,
                total_drones=total_drones,
                active_drones=active_drones,
                missions_in_progress=missions_in_progress,
                average_battery_level=avg_battery,
                fleet_status=fleet_status,
                drone_positions=drone_positions
            )
            
        except Exception as e:
            mission_logger.error(f"Error aggregating fleet telemetry: {str(e)}")
            return None
            
    def _broadcast_telemetry(self, telemetry: TelemetryData):
        """Broadcast individual drone telemetry to callbacks."""
        for callback in self.telemetry_callbacks:
            try:
                callback(telemetry)
            except Exception as e:
                mission_logger.error(f"Error in telemetry callback: {str(e)}")
                
    def _broadcast_fleet_telemetry(self, fleet_data: FleetTelemetryData):
        """Broadcast fleet telemetry to callbacks."""
        for callback in self.fleet_callbacks:
            try:
                callback(fleet_data)
            except Exception as e:
                mission_logger.error(f"Error in fleet telemetry callback: {str(e)}")
                
    def _broadcast_health_metrics(self, health_metrics: DroneHealthMetrics):
        """Broadcast drone health metrics to callbacks."""
        for callback in self.health_callbacks:
            try:
                callback(health_metrics)
            except Exception as e:
                mission_logger.error(f"Error in health callback: {str(e)}")
                
    def get_drone_telemetry_history(self, drone_id: str, limit: int = 50) -> List[TelemetryData]:
        """Get telemetry history for a specific drone."""
        history = self.drone_telemetry_history.get(drone_id, [])
        return history[-limit:] if history else []
        
    def get_fleet_statistics(self) -> Dict:
        """Get comprehensive fleet statistics."""
        fleet_stats = fleet_manager.get_fleet_statistics()
        
        # Add telemetry-specific stats
        telemetry_stats = {
            "telemetry_active": self.is_monitoring,
            "drones_with_telemetry": len(self.drone_telemetry_history),
            "healthy_drones": sum(1 for h in self.drone_health_status.values() if h.is_healthy),
            "drones_with_warnings": sum(1 for h in self.drone_health_status.values() if h.warning_messages),
            "drones_with_errors": sum(1 for h in self.drone_health_status.values() if h.error_messages),
        }
        
        return {**fleet_stats, **telemetry_stats}
        
    def export_telemetry_data(self, drone_id: str = None, format: str = "json") -> str:
        """Export telemetry data in specified format."""
        if drone_id:
            data = self.drone_telemetry_history.get(drone_id, [])
        else:
            data = self.drone_telemetry_history
            
        if format.lower() == "json":
            # Convert dataclasses to dicts for JSON serialization
            if isinstance(data, list):
                export_data = [asdict(item) for item in data]
            else:
                export_data = {k: [asdict(item) for item in v] for k, v in data.items()}
                
            return json.dumps(export_data, default=str, indent=2)
        else:
            return str(data)


# Global telemetry aggregator instance
telemetry_aggregator = MultiDroneTelemetryAggregator()