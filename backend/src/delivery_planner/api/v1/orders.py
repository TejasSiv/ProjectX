from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
import uuid
import logging

from ...core.exceptions import OrderNotFoundError, ValidationError
from ...models.orders import (
    OrderCreateRequest,
    OrderUpdateRequest, 
    OrderResponse,
    OrderStatus,
    OrderStatsResponse,
    OrderListResponse
)
from ...services.order_service import OrderService

logger = logging.getLogger(__name__)
router = APIRouter()

def get_order_service() -> OrderService:
    """Dependency to get order service from app state"""
    from ...main import app
    return app.state.order_service

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreateRequest,
    service: OrderService = Depends(get_order_service)
):
    """Create a new delivery order"""
    try:
        order = await service.create_order(order_data)
        logger.info(f"Created order {order.id} for customer {order.customer_id}")
        return order
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")

@router.get("/", response_model=OrderListResponse)
async def get_orders(
    status: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    limit: int = Query(100, ge=1, le=1000, description="Number of orders to return"),
    offset: int = Query(0, ge=0, description="Number of orders to skip"),
    service: OrderService = Depends(get_order_service)
):
    """Get list of orders with optional filtering"""
    try:
        orders = await service.get_orders(status=status, limit=limit, offset=offset)
        
        # Get total count for pagination (simplified - in production, use efficient count query)
        total_orders = await service.get_orders(limit=10000)  # Get all for count
        total = len(total_orders)
        has_more = offset + limit < total
        
        return OrderListResponse(
            orders=orders,
            total=total,
            offset=offset,
            limit=limit,
            has_more=has_more
        )
    except Exception as e:
        logger.error(f"Failed to get orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve orders")

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    service: OrderService = Depends(get_order_service)
):
    """Get a specific order by ID"""
    try:
        return await service.get_order(order_id)
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except Exception as e:
        logger.error(f"Failed to get order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve order")

@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: uuid.UUID,
    update_data: OrderUpdateRequest,
    service: OrderService = Depends(get_order_service)
):
    """Update an existing order"""
    try:
        return await service.update_order(order_id, update_data)
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update order")

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: uuid.UUID,
    service: OrderService = Depends(get_order_service)
):
    """Delete an order"""
    try:
        success = await service.delete_order(order_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete order")

@router.post("/{order_id}/start", response_model=OrderResponse)
async def start_order(
    order_id: uuid.UUID,
    service: OrderService = Depends(get_order_service)
):
    """Start order execution (transition to scheduled status)"""
    try:
        return await service.start_order(order_id)
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to start order")

@router.post("/{order_id}/abort", response_model=OrderResponse)
async def abort_order(
    order_id: uuid.UUID,
    reason: str = Query("Aborted by user", description="Reason for aborting order"),
    service: OrderService = Depends(get_order_service)
):
    """Abort order execution"""
    try:
        return await service.abort_order(order_id, reason)
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to abort order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to abort order")

@router.get("/{order_id}/eta")
async def get_order_eta(
    order_id: uuid.UUID,
    service: OrderService = Depends(get_order_service)
):
    """Get estimated time of arrival for an order"""
    try:
        eta = await service.calculate_eta(order_id)
        return {"order_id": order_id, "eta_minutes": eta}
    except OrderNotFoundError:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    except Exception as e:
        logger.error(f"Failed to calculate ETA for order {order_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate ETA")

@router.get("/stats/summary", response_model=OrderStatsResponse)
async def get_order_statistics(
    service: OrderService = Depends(get_order_service)
):
    """Get comprehensive order statistics"""
    try:
        return await service.get_order_stats()
    except Exception as e:
        logger.error(f"Failed to get order statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")

@router.get("/stats/performance")
async def get_performance_metrics(
    service: OrderService = Depends(get_order_service)
):
    """Get delivery performance metrics"""
    try:
        return await service.get_delivery_performance_metrics()
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")

@router.get("/active/list", response_model=List[OrderResponse])
async def get_active_orders(
    service: OrderService = Depends(get_order_service)
):
    """Get all active orders (scheduled or in-flight)"""
    try:
        return await service.get_active_orders()
    except Exception as e:
        logger.error(f"Failed to get active orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve active orders")

@router.get("/overdue/list", response_model=List[OrderResponse])
async def get_overdue_orders(
    service: OrderService = Depends(get_order_service)
):
    """Get orders that are overdue"""
    try:
        return await service.get_overdue_orders()
    except Exception as e:
        logger.error(f"Failed to get overdue orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve overdue orders")