import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBackendOrders } from './useBackendAPI';
import type { DeliveryOrder } from "@/components/delivery/OrderCard";

const USE_BACKEND_API = import.meta.env.VITE_USE_BACKEND_API === 'true';

// Supabase-only hook for fallback
function useSupabaseOrders() {
  return useQuery({
    queryKey: ["supabase-orders"],
    queryFn: async (): Promise<DeliveryOrder[]> => {
      try {
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
          pickupCoords: order.pickup_coordinates as [number, number],
          dropoffCoords: order.dropoff_coordinates as [number, number],
          status: order.status as DeliveryOrder["status"],
          createdAt: order.created_at,
          estimatedTime: order.estimated_time || undefined,
        }));
      } catch (error) {
        console.error('Supabase orders error:', error);
        // Return empty array on error to prevent UI crash
        return [];
      }
    },
    refetchInterval: 5000, // Poll every 5 seconds
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: 1000,
  });
}

// Transform backend format to component format
function transformBackendOrder(order: any): DeliveryOrder {
  // Backend returns coordinates as objects: { lat: number, lng: number }
  return {
    id: order.id,
    customerId: order.customer_id,
    pickupCoords: [order.pickup_coordinates?.lat || 0, order.pickup_coordinates?.lng || 0] as [number, number],
    dropoffCoords: [order.dropoff_coordinates?.lat || 0, order.dropoff_coordinates?.lng || 0] as [number, number],
    status: order.status as DeliveryOrder["status"],
    createdAt: order.created_at,
    estimatedTime: order.estimated_time || undefined,
  };
}

// Main useOrders hook with fallback strategy - compatible with original signature
export function useOrders() {
  // Backend API query
  const backendQuery = useBackendOrders();
  // Supabase fallback query
  const supabaseQuery = useSupabaseOrders();

  if (USE_BACKEND_API) {
    // If backend fails or is loading with errors, fallback to Supabase
    if (backendQuery.error || (backendQuery.isError && !backendQuery.isLoading)) {
      console.warn('Backend API failed, falling back to Supabase:', backendQuery.error?.message);
      return {
        ...supabaseQuery,
        data: supabaseQuery.data || [],
        isLoading: supabaseQuery.isLoading,
        error: supabaseQuery.error,
        refetch: supabaseQuery.refetch,
        isFallback: true,
      };
    }

    // Transform backend data format - ensure it's an array
    const transformedData = (backendQuery.data && Array.isArray(backendQuery.data)) ? 
      backendQuery.data.map(transformBackendOrder) : 
      [];

    return {
      ...backendQuery,
      data: transformedData,
      refetch: backendQuery.refetch,
      isFallback: false,
    };
  }

  // Use Supabase by default
  return {
    ...supabaseQuery,
    data: supabaseQuery.data || [],
    refetch: supabaseQuery.refetch,
    isFallback: false,
  };
}

// Re-export other hooks from backend API for convenience
export {
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useStartOrder,
  useAbortOrder,
  useTelemetry,
  useSystemHealth,
  useWebSocket
} from './useBackendAPI';