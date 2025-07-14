import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Zap, 
  Wind, 
  Thermometer, 
  Wifi, 
  Satellite,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TelemetryReading {
  timestamp: number;
  altitude: number;
  speed: number;
  battery: number;
  temperature: number;
  signalStrength: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  uptime: number;
  connectionStatus: "connected" | "connecting" | "disconnected";
  lastUpdate: Date;
}

export function TelemetryDashboard() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [currentReading, setCurrentReading] = useState<TelemetryReading | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    networkLatency: 0,
    uptime: 0,
    connectionStatus: "connecting",
    lastUpdate: new Date()
  });

  // Simulate telemetry updates (replace with actual WebSocket data)
  useEffect(() => {
    const interval = setInterval(() => {
      const newReading: TelemetryReading = {
        timestamp: Date.now(),
        altitude: 20 + Math.sin(Date.now() / 10000) * 5,
        speed: 15 + Math.random() * 5,
        battery: Math.max(20, 100 - (Date.now() % 100000) / 1000),
        temperature: 25 + Math.random() * 10,
        signalStrength: 80 + Math.random() * 20
      };

      setCurrentReading(newReading);
      setTelemetryHistory(prev => {
        const updated = [...prev, newReading];
        return updated.slice(-20); // Keep last 20 readings
      });

      setSystemMetrics(prev => ({
        ...prev,
        cpuUsage: 30 + Math.random() * 40,
        memoryUsage: 50 + Math.random() * 30,
        networkLatency: 20 + Math.random() * 50,
        connectionStatus: "connected",
        lastUpdate: new Date()
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return "destructive";
    if (value >= thresholds.warning) return "secondary";
    return "default";
  };

  const MetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    unit, 
    status = "default",
    trend
  }: {
    icon: any;
    title: string;
    value: number;
    unit: string;
    status?: "default" | "warning" | "critical";
    trend?: "up" | "down" | "stable";
  }) => (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              status === "critical" ? "bg-red-100 text-red-600" :
              status === "warning" ? "bg-yellow-100 text-yellow-600" :
              "bg-blue-100 text-blue-600"
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{title}</div>
              <div className="text-2xl font-bold">
                {value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              </div>
            </div>
          </div>
          {trend && (
            <div className={`flex items-center space-x-1 text-xs ${
              trend === "up" ? "text-green-600" :
              trend === "down" ? "text-red-600" :
              "text-gray-600"
            }`}>
              <TrendingUp className={`h-3 w-3 ${trend === "down" ? "rotate-180" : ""}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Live Telemetry Stream</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full animate-pulse ${
                systemMetrics.connectionStatus === "connected" ? "bg-green-500" :
                systemMetrics.connectionStatus === "connecting" ? "bg-yellow-500" :
                "bg-red-500"
              }`} />
              <Badge variant={
                systemMetrics.connectionStatus === "connected" ? "default" :
                systemMetrics.connectionStatus === "connecting" ? "secondary" :
                "destructive"
              }>
                {systemMetrics.connectionStatus}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Real-time Metrics Grid */}
      {currentReading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Activity}
            title="Altitude"
            value={currentReading.altitude}
            unit="m"
            status={currentReading.altitude > 50 ? "warning" : "default"}
            trend="stable"
          />
          <MetricCard
            icon={Wind}
            title="Ground Speed"
            value={currentReading.speed}
            unit="m/s"
            status="default"
            trend="up"
          />
          <MetricCard
            icon={Zap}
            title="Battery"
            value={currentReading.battery}
            unit="%"
            status={currentReading.battery < 30 ? "critical" : currentReading.battery < 50 ? "warning" : "default"}
            trend={currentReading.battery < 50 ? "down" : "stable"}
          />
          <MetricCard
            icon={Satellite}
            title="Signal"
            value={currentReading.signalStrength}
            unit="%"
            status={currentReading.signalStrength < 70 ? "warning" : "default"}
            trend="stable"
          />
        </div>
      )}

      {/* System Performance */}
      <Card>
        <CardHeader>
          <CardTitle>System Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPU Usage</span>
                <span>{systemMetrics.cpuUsage.toFixed(1)}%</span>
              </div>
              <Progress value={systemMetrics.cpuUsage} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Memory Usage</span>
                <span>{systemMetrics.memoryUsage.toFixed(1)}%</span>
              </div>
              <Progress value={systemMetrics.memoryUsage} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Network Latency</span>
                <span>{systemMetrics.networkLatency.toFixed(0)}ms</span>
              </div>
              <Progress 
                value={Math.min(100, systemMetrics.networkLatency)} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Altitude History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={telemetryHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => formatTime(value as number)}
                  formatter={(value: number) => [`${value.toFixed(1)} m`, "Altitude"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="altitude" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Battery Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={telemetryHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => formatTime(value as number)}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Battery"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="battery" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Warnings */}
      {currentReading && currentReading.battery < 30 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">Low Battery Warning</div>
                  <div className="text-sm text-red-600">
                    Battery level is at {currentReading.battery.toFixed(1)}%. Consider returning to launch.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}