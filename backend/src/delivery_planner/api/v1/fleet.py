from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Optional
import asyncio

from ...mission.drone_fleet_manager import fleet_manager, DroneStatus
from ...mission.mavlink_port_manager import port_manager
from ...mission.multi_drone_telemetry import telemetry_aggregator
from ...mission.multi_drone_mission_runner import multi_drone_mission_runner
from ...core.logger import main_logger

router = APIRouter(tags=["fleet"])


@router.get("/status")
async def get_fleet_status():
    """Get overall fleet status and statistics."""
    try:
        fleet_stats = fleet_manager.get_fleet_statistics()
        telemetry_stats = telemetry_aggregator.get_fleet_statistics()
        port_stats = port_manager.get_statistics()
        active_missions = multi_drone_mission_runner.get_active_missions()
        
        return {
            "fleet": fleet_stats,
            "telemetry": telemetry_stats,
            "ports": port_stats,
            "active_missions": len(active_missions),
            "mission_assignments": active_missions
        }
    except Exception as e:
        main_logger.error(f"Error getting fleet status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get fleet status: {str(e)}")


@router.get("/drones")
async def get_all_drones():
    """Get status of all drones in the fleet."""
    try:
        drones_status = fleet_manager.get_all_drones_status()
        return {"drones": drones_status}
    except Exception as e:
        main_logger.error(f"Error getting drone list: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get drone list: {str(e)}")


@router.get("/drones/{drone_id}")
async def get_drone_details(drone_id: str):
    """Get detailed information about a specific drone."""
    try:
        if drone_id not in fleet_manager.drones:
            raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
            
        drone_info = fleet_manager.drones[drone_id]
        telemetry_history = telemetry_aggregator.get_drone_telemetry_history(drone_id, limit=50)
        health_status = telemetry_aggregator.drone_health_status.get(drone_id)
        
        return {
            "drone_id": drone_id,
            "status": drone_info.status.value,
            "is_connected": drone_info.is_connected,
            "battery_level": drone_info.battery_level,
            "current_order_id": drone_info.current_order_id,
            "last_position": drone_info.last_position,
            "config": {
                "name": drone_info.config.name,
                "mavlink_port": drone_info.config.mavlink_port,
                "home_position": {
                    "latitude": drone_info.config.home_lat,
                    "longitude": drone_info.config.home_lon,
                    "altitude": drone_info.config.home_alt
                }
            },
            "telemetry_history": [t.__dict__ for t in telemetry_history],
            "health_status": health_status.__dict__ if health_status else None
        }
    except HTTPException:
        raise
    except Exception as e:
        main_logger.error(f"Error getting drone details for {drone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get drone details: {str(e)}")


@router.post("/drones/{drone_id}/status")
async def update_drone_status(drone_id: str, status: str):
    """Update the status of a specific drone."""
    try:
        if drone_id not in fleet_manager.drones:
            raise HTTPException(status_code=404, detail=f"Drone {drone_id} not found")
            
        try:
            new_status = DroneStatus(status)
        except ValueError:
            valid_statuses = [s.value for s in DroneStatus]
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status '{status}'. Valid statuses: {valid_statuses}"
            )
            
        fleet_manager.update_drone_status(drone_id, new_status)
        
        return {
            "drone_id": drone_id,
            "old_status": fleet_manager.drones[drone_id].status.value,
            "new_status": status,
            "message": f"Updated drone {drone_id} status to {status}"
        }
    except HTTPException:
        raise
    except Exception as e:
        main_logger.error(f"Error updating drone status for {drone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update drone status: {str(e)}")


@router.post("/missions/{order_id}/abort")
async def abort_mission(order_id: str):
    """Abort an active mission."""
    try:
        success = await multi_drone_mission_runner.abort_mission(order_id)
        
        if success:
            return {
                "order_id": order_id,
                "message": f"Mission for order {order_id} aborted successfully"
            }
        else:
            raise HTTPException(
                status_code=404, 
                detail=f"No active mission found for order {order_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        main_logger.error(f"Error aborting mission for order {order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to abort mission: {str(e)}")


@router.get("/ports")
async def get_port_status():
    """Get MAVLink port allocation status."""
    try:
        port_status = port_manager.get_port_status()
        port_stats = port_manager.get_statistics()
        allocated_ports = port_manager.get_allocated_ports()
        
        return {
            "port_status": port_status,
            "statistics": port_stats,
            "allocations": allocated_ports
        }
    except Exception as e:
        main_logger.error(f"Error getting port status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get port status: {str(e)}")


@router.post("/ports/{port}/reserve")
async def reserve_port(port: int):
    """Reserve a MAVLink port."""
    try:
        success = port_manager.reserve_port(port)
        
        if success:
            return {
                "port": port,
                "message": f"Port {port} reserved successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reserve port {port} - not in port pool"
            )
    except HTTPException:
        raise
    except Exception as e:
        main_logger.error(f"Error reserving port {port}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reserve port: {str(e)}")


@router.delete("/ports/{port}/reserve")
async def unreserve_port(port: int):
    """Remove reservation from a MAVLink port."""
    try:
        success = port_manager.unreserve_port(port)
        
        if success:
            return {
                "port": port,
                "message": f"Port {port} unreserved successfully"
            }
        else:
            return {
                "port": port,
                "message": f"Port {port} was not reserved"
            }
    except Exception as e:
        main_logger.error(f"Error unreserving port {port}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to unreserve port: {str(e)}")


@router.get("/telemetry/export")
async def export_telemetry_data(drone_id: Optional[str] = None, format: str = "json"):
    """Export telemetry data for analysis."""
    try:
        if format not in ["json"]:
            raise HTTPException(status_code=400, detail="Only 'json' format is currently supported")
            
        data = telemetry_aggregator.export_telemetry_data(drone_id, format)
        
        return {
            "drone_id": drone_id,
            "format": format,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        main_logger.error(f"Error exporting telemetry data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export telemetry data: {str(e)}")


@router.post("/validate")
async def validate_fleet_configuration():
    """Validate fleet configuration and fix any issues."""
    try:
        # Validate port assignments
        port_issues = port_manager.validate_port_assignments()
        
        response = {
            "port_validation": {
                "issues_found": len(port_issues),
                "issues": port_issues
            }
        }
        
        # Auto-fix port issues if found
        if port_issues:
            port_manager.auto_fix_port_assignments()
            response["port_validation"]["auto_fix_applied"] = True
            
        # Get updated statistics
        response["updated_statistics"] = {
            "fleet": fleet_manager.get_fleet_statistics(),
            "ports": port_manager.get_statistics(),
            "telemetry": telemetry_aggregator.get_fleet_statistics()
        }
        
        return response
    except Exception as e:
        main_logger.error(f"Error validating fleet configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to validate fleet configuration: {str(e)}")


@router.get("/health")
async def get_fleet_health():
    """Get comprehensive fleet health status."""
    try:
        drone_health = {}
        for drone_id in fleet_manager.drones.keys():
            health_metrics = telemetry_aggregator.drone_health_status.get(drone_id)
            if health_metrics:
                drone_health[drone_id] = {
                    "is_healthy": health_metrics.is_healthy,
                    "battery_level": health_metrics.battery_level,
                    "connection_status": health_metrics.connection_status,
                    "warnings": health_metrics.warning_messages,
                    "errors": health_metrics.error_messages,
                    "last_update": health_metrics.last_telemetry_update.isoformat()
                }
                
        fleet_stats = telemetry_aggregator.get_fleet_statistics()
        
        # Calculate overall fleet health
        total_drones = fleet_stats.get("total_drones", 0)
        healthy_drones = fleet_stats.get("healthy_drones", 0)
        fleet_health_percentage = (healthy_drones / total_drones * 100) if total_drones > 0 else 0
        
        return {
            "fleet_health_percentage": fleet_health_percentage,
            "total_drones": total_drones,
            "healthy_drones": healthy_drones,
            "drones_with_warnings": fleet_stats.get("drones_with_warnings", 0),
            "drones_with_errors": fleet_stats.get("drones_with_errors", 0),
            "drone_health_details": drone_health
        }
    except Exception as e:
        main_logger.error(f"Error getting fleet health: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get fleet health: {str(e)}")