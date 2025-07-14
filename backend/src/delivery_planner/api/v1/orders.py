from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, List, Dict, Any
import math
import uuid

from ...core.supabase_client import supabase_client
from ...core.schemas import (
    OrderCreate, OrderUpdate, OrderResponse, OrderListResponse, ErrorResponse, OrderStatus
)
from ...core.logger import api_logger

router = APIRouter(prefix="/orders", tags=["orders"])


def calculate_distance(coords1: List[float], coords2: List[float]) -> float:
    """Calculate distance between two coordinates using Haversine formula."""
    lat1, lon1 = coords1
    lat2, lon2 = coords2
    
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat/2) * math.sin(dlat/2) + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(dlon/2) * math.sin(dlon/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def estimate_delivery_time(pickup_coords: List[float], dropoff_coords: List[float]) -> int:
    """Estimate delivery time based on distance."""
    distance_km = calculate_distance(pickup_coords, dropoff_coords)
    
    # Assume average drone speed of 30 km/h, add 5 minutes for takeoff/landing
    flight_time_minutes = (distance_km / 30) * 60
    total_time = flight_time_minutes + 5
    
    return max(10, int(total_time))  # Minimum 10 minutes


def transform_supabase_order(order_data: Dict[str, Any]) -> OrderResponse:
    """Transform Supabase order data to OrderResponse format."""
    return OrderResponse(
        id=order_data["id"],
        customer_id=order_data["customer_id"],
        pickup_coords=order_data["pickup_coords"],
        dropoff_coords=order_data["dropoff_coords"],
        status=order_data["status"],
        created_at=order_data["created_at"],
        updated_at=order_data["updated_at"],
        estimated_time=order_data.get("estimated_time")
    )


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate):
    """Create a new delivery order via FastAPI backend."""
    try:
        # Calculate estimated delivery time
        estimated_time = estimate_delivery_time(order.pickup_coords, order.dropoff_coords)
        
        # Create order data for Supabase
        order_data = {
            "id": f"DRN-{str(uuid.uuid4())[:8].upper()}",
            "customer_id": order.customer_id,
            "pickup_coords": order.pickup_coords,
            "dropoff_coords": order.dropoff_coords,
            "estimated_time": estimated_time,
            "status": OrderStatus.PENDING.value
        }
        
        # Create order in Supabase
        order_id = await supabase_client.create_order(order_data)
        
        if not order_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create order in database"
            )
        
        # Fetch the created order
        created_order = await supabase_client.get_order_by_id(order_id)
        
        if not created_order:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created order"
            )
        
        api_logger.info(f"Created order {order_id} for customer {order.customer_id}")
        return transform_supabase_order(created_order)
        
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error creating order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create order"
        )


@router.get("/", response_model=OrderListResponse)
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, description="Filter by order status"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size")
):
    """List orders with optional filtering and pagination from Supabase."""
    try:
        # Get orders from Supabase
        orders_data = await supabase_client.get_orders(
            status=status_filter.value if status_filter else None
        )
        
        # Apply customer filter if provided
        if customer_id:
            orders_data = [order for order in orders_data if order.get("customer_id") == customer_id]
        
        # Apply pagination
        total = len(orders_data)
        offset = (page - 1) * size
        paginated_orders = orders_data[offset:offset + size]
        
        # Transform to response format
        orders = [transform_supabase_order(order) for order in paginated_orders]
        
        return OrderListResponse(
            orders=orders,
            total=total,
            page=page,
            size=size
        )
        
    except Exception as e:
        api_logger.error(f"Error listing orders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list orders"
        )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str):
    """Get a specific order by ID from Supabase."""
    try:
        order_data = await supabase_client.get_order_by_id(order_id)
        
        if not order_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found"
            )
        
        return transform_supabase_order(order_data)
        
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error getting order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get order"
        )


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str, 
    order_update: OrderUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing order."""
    try:
        order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found"
            )
        
        # Update fields that are provided
        update_data = order_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)
        
        # Recalculate estimated time if coordinates changed
        if any(field in update_data for field in ['pickup_lat', 'pickup_lon', 'dropoff_lat', 'dropoff_lon']):
            order.estimated_time = estimate_delivery_time(
                order.pickup_lat, order.pickup_lon,
                order.dropoff_lat, order.dropoff_lon
            )
        
        db.commit()
        db.refresh(order)
        
        api_logger.info(f"Updated order {order_id}")
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error updating order {order_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update order"
        )


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(order_id: str, db: Session = Depends(get_db)):
    """Delete an order."""
    try:
        order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found"
            )
        
        db.delete(order)
        db.commit()
        
        api_logger.info(f"Deleted order {order_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error deleting order {order_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete order"
        )


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str, 
    new_status: OrderStatus,
    db: Session = Depends(get_db)
):
    """Update only the status of an order."""
    try:
        order = db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found"
            )
        
        old_status = order.status
        order.status = new_status
        
        db.commit()
        db.refresh(order)
        
        api_logger.info(f"Updated order {order_id} status from {old_status} to {new_status}")
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Error updating order {order_id} status: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update order status"
        )