import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Square, 
  RotateCcw, 
  MapPin, 
  Gauge, 
  Battery, 
  Navigation,
  Plane,
  AlertTriangle
} from "lucide-react";
import { useBackendHealth, useWebSocketTelemetry } from "@/hooks/useBackendAPI";

interface MissionState {
  orderId: string | null;
  status: "idle" | "planning" | "uploading" | "executing" | "completed" | "failed";
  progress: number;
  currentWaypoint: number;
  totalWaypoints: number;
  estimatedTimeRemaining: number;
}

interface TelemetryData {
  orderId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundSpeed: number;
  heading: number;
  batteryRemaining: number;
  missionProgress: number;
}

export function MissionControlPanel() {
  const [missionState, setMissionState] = useState<MissionState>({
    orderId: null,
    status: "idle",
    progress: 0,
    currentWaypoint: 0,
    totalWaypoints: 0,
    estimatedTimeRemaining: 0
  });

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const { data: healthData } = useBackendHealth();

  // WebSocket integration for real-time updates
  useWebSocketTelemetry(
    (data: TelemetryData) => {
      setTelemetry(data);
      setMissionState(prev => ({
        ...prev,
        progress: data.missionProgress * 100,
        orderId: data.orderId
      }));
    },
    (statusUpdate) => {
      setMissionState(prev => ({
        ...prev,
        status: statusUpdate.status === "in_flight" ? "executing" : 
               statusUpdate.status === "completed" ? "completed" :
               statusUpdate.status === "failed" ? "failed" : prev.status
      }));
    }
  );

  const handleStartMission = async () => {
    // This would trigger mission start via backend API
    try {
      setMissionState(prev => ({ ...prev, status: "planning" }));
      // Backend API call would go here
      console.log("Starting mission...");
    } catch (error) {
      console.error("Failed to start mission:", error);
      setMissionState(prev => ({ ...prev, status: "failed" }));
    }
  };

  const handleAbortMission = async () => {
    try {
      setMissionState(prev => ({ ...prev, status: "idle" }));
      // Backend API call to abort mission
      console.log("Aborting mission...");
    } catch (error) {
      console.error("Failed to abort mission:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "idle": return "secondary";
      case "planning": return "secondary";
      case "uploading": return "secondary";
      case "executing": return "default";
      case "completed": return "default";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  const isSystemHealthy = healthData?.status === "healthy";

  return (
    <div className="space-y-6">
      {/* Mission Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Plane className="h-5 w-5" />
              <span>Mission Control</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${isSystemHealthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-sm text-muted-foreground">
                {isSystemHealthy ? 'System Online' : 'System Offline'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Mission Status</div>
              <Badge variant={getStatusColor(missionState.status)} className="text-sm">
                {missionState.status.toUpperCase()}
              </Badge>
            </div>
            
            {missionState.orderId && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Active Order</div>
                <div className="font-mono text-sm">{missionState.orderId}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-secondary rounded-full h-2">
                  <motion.div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${missionState.progress}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${missionState.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(missionState.progress)}%</span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Control Buttons */}
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleStartMission}
              disabled={missionState.status === "executing" || !isSystemHealthy}
              className="flex items-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Start Mission</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={handleAbortMission}
              disabled={missionState.status === "idle"}
              className="flex items-center space-x-2"
            >
              <Square className="h-4 w-4" />
              <span>Abort</span>
            </Button>
            
            <Button
              variant="ghost"
              disabled={missionState.status === "executing"}
              className="flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Telemetry */}
      {telemetry && (
        <Card>
          <CardHeader>
            <CardTitle>Live Telemetry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Position</span>
                </div>
                <div className="font-mono text-sm">
                  {telemetry.latitude.toFixed(6)}, {telemetry.longitude.toFixed(6)}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                  <span>Altitude</span>
                </div>
                <div className="font-mono text-sm">{telemetry.altitude.toFixed(1)} m</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Navigation className="h-4 w-4" />
                  <span>Speed</span>
                </div>
                <div className="font-mono text-sm">{telemetry.groundSpeed.toFixed(1)} m/s</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Battery className="h-4 w-4" />
                  <span>Battery</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="font-mono text-sm">{Math.round(telemetry.batteryRemaining * 100)}%</div>
                  {telemetry.batteryRemaining < 0.2 && (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}