import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryOrder } from "@/components/delivery/OrderCard";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async (): Promise<DeliveryOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch orders: ${error.message}`);
      }

      // Transform database format to component format
      return (data || []).map((order) => ({
        id: order.id,
        customerId: order.customer_id,
        pickupCoords: order.pickup_coords as [number, number],
        dropoffCoords: order.dropoff_coords as [number, number],
        status: order.status as DeliveryOrder["status"],
        createdAt: order.created_at,
        estimatedTime: order.estimated_time || undefined,
      }));
    },
    refetchInterval: 5000, // Poll every 5 seconds
    refetchIntervalInBackground: true,
  });
}