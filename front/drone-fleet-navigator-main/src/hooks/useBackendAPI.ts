import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';

// Types matching backend models
interface DeliveryOrder {
  id: string;
  customer_id: string;
  pickup_coordinates: { lat: number; lng: number };
  dropoff_coordinates: { lat: number; lng: number };
  status: 'pending' | 'scheduled' | 'in_flight' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  estimated_time?: number;
  created_at: string;
  updated_at: string;
}

interface CreateOrderRequest {
  customer_id: string;
  pickup_coordinates: { lat: number; lng: number };
  dropoff_coordinates: { lat: number; lng: number };
  priority: 'low' | 'medium' | 'high';
  package_weight?: number;
  special_instructions?: string;
}

interface TelemetryData {
  drone_id: string;
  position: {
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
  };
  status: {
    is_armed: boolean;
    is_flying: boolean;
    battery_remaining: number;
    gps_signal_strength: number;
    speed: number;
  };
  mission_id?: string;
  timestamp: string;
}

class BackendAPIClient {
  private baseURL: string;
  private wsURL: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    this.wsURL = import.meta.env.VITE_API_WS_URL || 'ws://localhost:8000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Order Management
  async getOrders(status?: string): Promise<DeliveryOrder[]> {
    const params = status ? `?status=${status}` : '';
    return this.request<DeliveryOrder[]>(`/api/v1/orders${params}`);
  }

  async createOrder(order: CreateOrderRequest): Promise<DeliveryOrder> {
    return this.request<DeliveryOrder>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async updateOrder(id: string, updates: Partial<DeliveryOrder>): Promise<DeliveryOrder> {
    return this.request<DeliveryOrder>(`/api/v1/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteOrder(id: string): Promise<void> {
    return this.request<void>(`/api/v1/orders/${id}`, {
      method: 'DELETE',
    });
  }

  async startOrder(id: string): Promise<DeliveryOrder> {
    return this.request<DeliveryOrder>(`/api/v1/orders/${id}/start`, {
      method: 'POST',
    });
  }

  async abortOrder(id: string, reason?: string): Promise<DeliveryOrder> {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return this.request<DeliveryOrder>(`/api/v1/orders/${id}/abort${params}`, {
      method: 'POST',
    });
  }

  // Telemetry & Health
  async getCurrentTelemetry(): Promise<TelemetryData> {
    return this.request<TelemetryData>('/api/v1/telemetry/current');
  }

  async getSystemHealth(): Promise<any> {
    return this.request<any>('/health');
  }

  // WebSocket Connection
  connectWebSocket(onMessage: (data: any) => void, onError?: (error: Event) => void): WebSocket {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    const wsUrl = `${this.wsURL}/api/v1/telemetry/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Subscribe to all topics
      this.ws?.send(JSON.stringify({
        type: 'subscribe',
        topics: ['telemetry', 'orders', 'missions', 'alerts']
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;
      
      // Auto-reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectWebSocket(onMessage, onError);
        }, delay);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    return this.ws;
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

const apiClient = new BackendAPIClient();

// React Query Hooks
export function useBackendOrders(status?: string) {
  return useQuery({
    queryKey: ['backend-orders', status],
    queryFn: () => apiClient.getOrders(status),
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 0, // Always refetch
    retry: 2,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (order: CreateOrderRequest) => apiClient.createOrder(order),
    onSuccess: () => {
      // Invalidate orders cache
      queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DeliveryOrder> }) =>
      apiClient.updateOrder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useStartOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.startOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useAbortOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.abortOrder(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useTelemetry() {
  return useQuery({
    queryKey: ['telemetry'],
    queryFn: () => apiClient.getCurrentTelemetry(),
    refetchInterval: 2000, // Poll every 2 seconds
    retry: 3,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getSystemHealth(),
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

// Real-time WebSocket Hook
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleMessage = (data: any) => {
      setLastMessage(data);
      setError(null);

      // Handle different message types
      switch (data.type) {
        case 'telemetry':
          queryClient.setQueryData(['telemetry'], data.payload);
          break;
        case 'order_update':
          queryClient.invalidateQueries({ queryKey: ['backend-orders'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          break;
        case 'mission_update':
          queryClient.invalidateQueries({ queryKey: ['missions'] });
          break;
        case 'alert':
          // Handle alerts/notifications
          console.log('System alert:', data.payload);
          break;
      }
    };

    const handleError = (error: Event) => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    wsRef.current = apiClient.connectWebSocket(handleMessage, handleError);
    
    const checkConnection = () => {
      setIsConnected(wsRef.current?.readyState === WebSocket.OPEN);
    };

    const interval = setInterval(checkConnection, 1000);

    return () => {
      clearInterval(interval);
      apiClient.disconnectWebSocket();
    };
  }, [queryClient]);

  return {
    isConnected,
    lastMessage,
    error,
    reconnect: () => {
      apiClient.disconnectWebSocket();
      wsRef.current = apiClient.connectWebSocket(
        (data) => setLastMessage(data),
        (error) => setError('Connection error')
      );
    }
  };
}

export { apiClient };

// Legacy exports for backward compatibility
export const backendAPI = apiClient;
export const useBackendHealth = useSystemHealth;
export const useWebSocketTelemetry = useWebSocket;