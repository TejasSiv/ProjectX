from supabase import create_client, Client
from typing import Optional, List, Dict, Any
import asyncio
from datetime import datetime, timezone

from .config import settings
from .logger import main_logger


class SupabaseClient:
    """Supabase client for backend integration."""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._initialize_client()
        
    def _initialize_client(self):
        """Initialize Supabase client."""
        try:
            # Use service key if available, otherwise anon key
            key = settings.supabase_service_key or settings.supabase_anon_key
            
            self.client = create_client(settings.supabase_url, key)
            main_logger.info("Supabase client initialized successfully")
            
        except Exception as e:
            main_logger.error(f"Failed to initialize Supabase client: {str(e)}")
            self.client = None
            
    async def get_orders(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get orders from Supabase."""
        if not self.client:
            main_logger.error("Supabase client not initialized")
            return []
            
        try:
            query = self.client.table("orders").select("*")
            
            if status:
                query = query.eq("status", status)
                
            response = query.order("created_at", desc=True).execute()
            
            return response.data or []
            
        except Exception as e:
            main_logger.error(f"Error fetching orders from Supabase: {str(e)}")
            return []
            
    async def get_order_by_id(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific order by ID."""
        if not self.client:
            return None
            
        try:
            response = self.client.table("orders").select("*").eq("id", order_id).execute()
            
            if response.data:
                return response.data[0]
            return None
            
        except Exception as e:
            main_logger.error(f"Error fetching order {order_id}: {str(e)}")
            return None
            
    async def update_order_status(self, order_id: str, status: str, **kwargs) -> bool:
        """Update order status in Supabase."""
        if not self.client:
            return False
            
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Add any additional fields
            update_data.update(kwargs)
            
            response = self.client.table("orders").update(update_data).eq("id", order_id).execute()
            
            main_logger.info(f"Updated order {order_id} status to {status}")
            return True
            
        except Exception as e:
            main_logger.error(f"Error updating order {order_id}: {str(e)}")
            return False
            
    async def create_order(self, order_data: Dict[str, Any]) -> Optional[str]:
        """Create a new order in Supabase."""
        if not self.client:
            return None
            
        try:
            response = self.client.table("orders").insert(order_data).execute()
            
            if response.data:
                order_id = response.data[0]["id"]
                main_logger.info(f"Created order {order_id}")
                return order_id
                
            return None
            
        except Exception as e:
            main_logger.error(f"Error creating order: {str(e)}")
            return None
            
    async def get_pending_orders(self) -> List[Dict[str, Any]]:
        """Get all pending orders for processing."""
        return await self.get_orders(status="pending")
        
    async def listen_to_order_changes(self, callback):
        """Listen to real-time order changes."""
        if not self.client:
            main_logger.error("Cannot listen to changes without Supabase client")
            return
            
        try:
            # Set up real-time subscription
            def handle_changes(payload):
                main_logger.info(f"Order change detected: {payload['eventType']}")
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(payload))
                else:
                    callback(payload)
                    
            subscription = self.client.table("orders").on("*", handle_changes).subscribe()
            main_logger.info("Subscribed to order changes")
            
            return subscription
            
        except Exception as e:
            main_logger.error(f"Error setting up real-time subscription: {str(e)}")
            return None


# Global Supabase client instance
supabase_client = SupabaseClient()