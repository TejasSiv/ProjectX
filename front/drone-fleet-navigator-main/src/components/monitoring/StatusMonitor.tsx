import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Radio,
  Wifi,
  Database,
  Server,
  Zap,
  Pause,
  Play
} from "lucide-react";
import { useBackendHealth, useWebSocketTelemetry } from "@/hooks/useBackendAPI";
import { useOrders } from "@/hooks/useOrders";

interface StatusEvent {
  id: string;
  timestamp: Date;
  type: "info" | "warning" | "error" | "success";
  category: "order" | "mission" | "system" | "telemetry";
  message: string;
  details?: string;
}

interface SystemStatus {
  backend: "online" | "offline" | "degraded";
  database: "online" | "offline" | "degraded";
  telemetry: "online" | "offline" | "degraded";
  websocket: "connected" | "disconnected" | "reconnecting";
  lastUpdate: Date;
}

export function StatusMonitor() {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: "offline",
    database: "offline",
    telemetry: "offline",
    websocket: "disconnected",
    lastUpdate: new Date()
  });

  const { data: healthData, isError: healthError } = useBackendHealth();
  const { data: orders, isError: ordersError } = useOrders();

  // WebSocket telemetry monitoring
  useWebSocketTelemetry(
    (telemetryData) => {
      setSystemStatus(prev => ({
        ...prev,
        telemetry: "online",
        websocket: "connected",
        lastUpdate: new Date()
      }));

      if (!isPaused) {
        addEvent({
          type: "info",
          category: "telemetry",
          message: `Telemetry update: Order ${telemetryData.orderId}`,
          details: `Alt: ${telemetryData.altitude.toFixed(1)}m, Speed: ${telemetryData.groundSpeed.toFixed(1)}m/s, Battery: ${Math.round(telemetryData.batteryRemaining * 100)}%`
        });
      }
    },
    (statusUpdate) => {
      if (!isPaused) {
        addEvent({
          type: statusUpdate.status === "completed" ? "success" : 
                statusUpdate.status === "failed" ? "error" : "info",
          category: "order",
          message: `Order ${statusUpdate.orderId} status: ${statusUpdate.status}`,
          details: statusUpdate.message
        });
      }
    }
  );

  // Monitor system health
  useEffect(() => {
    const newStatus: SystemStatus = {
      backend: healthError ? "offline" : healthData ? "online" : "degraded",
      database: ordersError ? "offline" : orders ? "online" : "degraded",
      telemetry: systemStatus.telemetry,
      websocket: systemStatus.websocket,
      lastUpdate: new Date()
    };

    setSystemStatus(newStatus);

    // Add system status events
    if (healthError && systemStatus.backend !== "offline") {
      addEvent({
        type: "error",
        category: "system",
        message: "Backend service offline",
        details: "Unable to connect to FastAPI backend"
      });
    }

    if (ordersError && systemStatus.database !== "offline") {
      addEvent({
        type: "error",
        category: "system",
        message: "Database connection lost",
        details: "Unable to fetch orders from Supabase"
      });
    }
  }, [healthData, healthError, orders, ordersError]);

  // WebSocket connection monitoring
  useEffect(() => {
    const wsCheckInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - systemStatus.lastUpdate.getTime();
      
      if (timeSinceLastUpdate > 10000 && systemStatus.websocket === "connected") {
        setSystemStatus(prev => ({
          ...prev,
          websocket: "disconnected",
          telemetry: "offline"
        }));

        if (!isPaused) {
          addEvent({
            type: "warning",
            category: "system",
            message: "WebSocket connection lost",
            details: "Real-time telemetry unavailable"
          });
        }
      }
    }, 5000);

    return () => clearInterval(wsCheckInterval);
  }, [systemStatus.lastUpdate, systemStatus.websocket, isPaused]);

  const addEvent = (eventData: Omit<StatusEvent, 'id' | 'timestamp'>) => {
    const newEvent: StatusEvent = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      ...eventData
    };

    setEvents(prev => [newEvent, ...prev.slice(0, 99)]); // Keep last 100 events
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "offline":
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "degraded":
      case "reconnecting":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "connected":
        return "default";
      case "offline":
      case "disconnected":
        return "destructive";
      case "degraded":
      case "reconnecting":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "order":
        return "📦";
      case "mission":
        return "🚁";
      case "system":
        return "⚙️";
      case "telemetry":
        return "📡";
      default:
        return "ℹ️";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      addEvent({
        type: "info",
        category: "system",
        message: "Event monitoring paused"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Status</span>
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Last updated: {formatTime(systemStatus.lastUpdate)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Server className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Backend API</div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus.backend)}
                  <Badge variant={getStatusColor(systemStatus.backend)} className="text-xs">
                    {systemStatus.backend}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Database className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Database</div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus.database)}
                  <Badge variant={getStatusColor(systemStatus.database)} className="text-xs">
                    {systemStatus.database}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Radio className="h-5 w-5 text-purple-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Telemetry</div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus.telemetry)}
                  <Badge variant={getStatusColor(systemStatus.telemetry)} className="text-xs">
                    {systemStatus.telemetry}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Wifi className="h-5 w-5 text-orange-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">WebSocket</div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus.websocket)}
                  <Badge variant={getStatusColor(systemStatus.websocket)} className="text-xs">
                    {systemStatus.websocket}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Event Log</span>
              <Badge variant="secondary">{events.length}</Badge>
              {isPaused && <Badge variant="secondary">Paused</Badge>}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                className="flex items-center space-x-2"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearEvents}
                disabled={events.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <AnimatePresence>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                  <div className="text-sm text-muted-foreground">No events yet</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    System events will appear here in real-time
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-lg">{getCategoryIcon(event.category)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {getEventIcon(event.type)}
                          <div className="text-sm font-medium truncate">
                            {event.message}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(event.timestamp)}</span>
                          </div>
                        </div>
                        {event.details && (
                          <div className="text-xs text-muted-foreground">
                            {event.details}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}