from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import uuid
import logging

from ...core.exceptions import MissionNotFoundError, MissionExecutionError
from ...models.missions import MissionResponse, MissionStatus
from ...services.mission_service import MissionService

logger = logging.getLogger(__name__)
router = APIRouter()

def get_mission_service() -> MissionService:
    """Dependency to get mission service from app state"""
    from ...main import app
    return app.state.mission_service

@router.get("/", response_model=List[dict])
async def get_missions(
    service: MissionService = Depends(get_mission_service)
):
    """Get list of all missions"""
    try:
        # This would need implementation in MissionService
        return []
    except Exception as e:
        logger.error(f"Failed to get missions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve missions")

@router.get("/{mission_id}")
async def get_mission(
    mission_id: uuid.UUID,
    service: MissionService = Depends(get_mission_service)
):
    """Get a specific mission by ID"""
    try:
        return await service.get_mission(mission_id)
    except MissionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    except Exception as e:
        logger.error(f"Failed to get mission {mission_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve mission")

@router.post("/{mission_id}/execute")
async def execute_mission(
    mission_id: uuid.UUID,
    service: MissionService = Depends(get_mission_service)
):
    """Execute a mission"""
    try:
        success = await service.execute_mission(mission_id)
        return {"mission_id": mission_id, "success": success}
    except MissionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    except MissionExecutionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to execute mission {mission_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute mission")

@router.post("/{mission_id}/abort")
async def abort_mission(
    mission_id: uuid.UUID,
    service: MissionService = Depends(get_mission_service)
):
    """Abort a mission"""
    try:
        mission = await service.abort_mission(mission_id)
        return mission
    except MissionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    except MissionExecutionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to abort mission {mission_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to abort mission")

@router.get("/{mission_id}/status")
async def get_mission_status(
    mission_id: uuid.UUID,
    service: MissionService = Depends(get_mission_service)
):
    """Get mission status and progress"""
    try:
        mission = await service.get_mission(mission_id)
        return {
            "mission_id": mission_id,
            "status": mission["status"],
            "progress": mission.get("progress", 0),
            "current_waypoint_index": mission.get("current_waypoint_index", 0)
        }
    except MissionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found")
    except Exception as e:
        logger.error(f"Failed to get mission status {mission_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get mission status")

@router.get("/stats/summary")
async def get_mission_statistics(
    service: MissionService = Depends(get_mission_service)
):
    """Get mission execution statistics"""
    try:
        return await service.get_mission_statistics()
    except Exception as e:
        logger.error(f"Failed to get mission statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")