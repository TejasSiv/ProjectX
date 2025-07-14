import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Backend API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/telemetry";

// API client
class BackendAPI {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Order endpoints
  async getOrders(params?: {
    status_filter?: string;
    customer_id?: string;
    page?: number;
    size?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status_filter) searchParams.set("status_filter", params.status_filter);
    if (params?.customer_id) searchParams.set("customer_id", params.customer_id);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.size) searchParams.set("size", params.size.toString());

    const query = searchParams.toString();
    return this.request(`/api/v1/orders${query ? `?${query}` : ""}`);
  }

  async getOrder(orderId: string) {
    return this.request(`/api/v1/orders/${orderId}`);
  }

  async createOrder(orderData: {
    customer_id: string;
    pickup_coords: [number, number];
    dropoff_coords: [number, number];
  }) {
    return this.request("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  }

  async updateOrder(orderId: string, updates: any) {
    return this.request(`/api/v1/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request(`/api/v1/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async deleteOrder(orderId: string) {
    return this.request(`/api/v1/orders/${orderId}`, {
      method: "DELETE",
    });
  }

  // Health endpoint
  async getHealth() {
    return this.request("/health");
  }
}

export const backendAPI = new BackendAPI(API_BASE_URL);

// React Query hooks for backend API
export function useBackendOrders(params?: {
  status_filter?: string;
  customer_id?: string;
  page?: number;
  size?: number;
}) {
  return useQuery({
    queryKey: ["backend-orders", params],
    queryFn: () => backendAPI.getOrders(params),
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

export function useBackendOrder(orderId: string) {
  return useQuery({
    queryKey: ["backend-order", orderId],
    queryFn: () => backendAPI.getOrder(orderId),
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: backendAPI.createOrder.bind(backendAPI),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] }); // Also invalidate Supabase orders
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ orderId, updates }: { orderId: string; updates: any }) =>
      backendAPI.updateOrder(orderId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      backendAPI.updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useBackendHealth() {
  return useQuery({
    queryKey: ["backend-health"],
    queryFn: () => backendAPI.getHealth(),
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// WebSocket hook for real-time telemetry
export function useWebSocketTelemetry(
  onTelemetry?: (data: any) => void,
  onStatusUpdate?: (data: any) => void
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["websocket-telemetry"],
    queryFn: () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log("Connected to telemetry WebSocket");
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === "telemetry" && onTelemetry) {
              onTelemetry(message.data);
            } else if (message.type === "status_update" && onStatusUpdate) {
              onStatusUpdate(message.data);
              // Invalidate orders when status updates
              queryClient.invalidateQueries({ queryKey: ["orders"] });
              queryClient.invalidateQueries({ queryKey: ["backend-orders"] });
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };

        ws.onclose = () => {
          console.log("WebSocket connection closed");
        };
      });
    },
    enabled: true,
    retry: true,
    refetchInterval: false,
  });
}