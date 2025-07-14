import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Heart,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Database,
  Server,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useBackendHealth } from "@/hooks/useBackendAPI";

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  trend: "up" | "down" | "stable";
  threshold: {
    warning: number;
    critical: number;
  };
}

interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  responseTime: number;
  uptime: number;
  lastCheck: Date;
  endpoint: string;
}

interface HistoricalData {
  timestamp: number;
  cpu: number;
  memory: number;
  responseTime: number;
}

export function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [systemUptime, setSystemUptime] = useState(0);

  const { data: healthData, isLoading, isError, refetch } = useBackendHealth();

  // Initialize metrics and services
  useEffect(() => {
    const initialMetrics: HealthMetric[] = [
      {
        name: "CPU Usage",
        value: 0,
        unit: "%",
        status: "healthy",
        trend: "stable",
        threshold: { warning: 70, critical: 90 }
      },
      {
        name: "Memory Usage",
        value: 0,
        unit: "%",
        status: "healthy",
        trend: "stable",
        threshold: { warning: 80, critical: 95 }
      },
      {
        name: "Response Time",
        value: 0,
        unit: "ms",
        status: "healthy",
        trend: "stable",
        threshold: { warning: 500, critical: 1000 }
      },
      {
        name: "Active Connections",
        value: 0,
        unit: "",
        status: "healthy",
        trend: "stable",
        threshold: { warning: 100, critical: 200 }
      }
    ];

    const initialServices: ServiceStatus[] = [
      {
        name: "FastAPI Backend",
        status: "offline",
        responseTime: 0,
        uptime: 0,
        lastCheck: new Date(),
        endpoint: "/health"
      },
      {
        name: "Supabase Database",
        status: "offline",
        responseTime: 0,
        uptime: 0,
        lastCheck: new Date(),
        endpoint: "supabase"
      },
      {
        name: "WebSocket Server",
        status: "offline",
        responseTime: 0,
        uptime: 0,
        lastCheck: new Date(),
        endpoint: "/ws/telemetry"
      },
      {
        name: "MAVSDK Service",
        status: "offline",
        responseTime: 0,
        uptime: 0,
        lastCheck: new Date(),
        endpoint: "mavsdk"
      }
    ];

    setMetrics(initialMetrics);
    setServices(initialServices);
  }, []);

  // Update metrics based on health data
  useEffect(() => {
    if (healthData) {
      const now = Date.now();
      
      // Simulate metrics (in real app, these would come from health endpoint)
      const newMetrics: HealthMetric[] = [
        {
          name: "CPU Usage",
          value: 35 + Math.random() * 30,
          unit: "%",
          status: "healthy",
          trend: "stable",
          threshold: { warning: 70, critical: 90 }
        },
        {
          name: "Memory Usage",
          value: 60 + Math.random() * 20,
          unit: "%",
          status: "healthy",
          trend: "up",
          threshold: { warning: 80, critical: 95 }
        },
        {
          name: "Response Time",
          value: 50 + Math.random() * 100,
          unit: "ms",
          status: "healthy",
          trend: "stable",
          threshold: { warning: 500, critical: 1000 }
        },
        {
          name: "Active Connections",
          value: 5 + Math.random() * 10,
          unit: "",
          status: "healthy",
          trend: "stable",
          threshold: { warning: 100, critical: 200 }
        }
      ];

      // Determine status based on thresholds
      newMetrics.forEach(metric => {
        if (metric.value >= metric.threshold.critical) {
          metric.status = "critical";
        } else if (metric.value >= metric.threshold.warning) {
          metric.status = "warning";
        } else {
          metric.status = "healthy";
        }
      });

      setMetrics(newMetrics);

      // Update services
      setServices(prev => prev.map(service => {
        if (service.name === "FastAPI Backend") {
          return {
            ...service,
            status: isError ? "offline" : "online",
            responseTime: newMetrics[2].value,
            uptime: isError ? 0 : systemUptime,
            lastCheck: new Date()
          };
        }
        return service;
      }));

      // Add to historical data
      setHistoricalData(prev => {
        const newData: HistoricalData = {
          timestamp: now,
          cpu: newMetrics[0].value,
          memory: newMetrics[1].value,
          responseTime: newMetrics[2].value
        };
        return [...prev.slice(-19), newData]; // Keep last 20 points
      });
    }
  }, [healthData, isError, systemUptime]);

  // System uptime counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemUptime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "critical":
      case "offline":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return "default";
      case "warning":
      case "degraded":
        return "secondary";
      case "critical":
      case "offline":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case "down":
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return null;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const overallHealth = metrics.every(m => m.status === "healthy") ? "healthy" :
                       metrics.some(m => m.status === "critical") ? "critical" : "warning";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Overall Health Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Heart className="h-5 w-5" />
                <span>System Health Overview</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(overallHealth)}
                  <Badge variant={getStatusColor(overallHealth)}>
                    {overallHealth.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">System Uptime</div>
                <div className="text-2xl font-bold flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <span>{formatUptime(systemUptime)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Services Online</div>
                <div className="text-2xl font-bold flex items-center space-x-2">
                  <Server className="h-5 w-5 text-green-500" />
                  <span>{services.filter(s => s.status === "online").length}/{services.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">{metric.name}</div>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(metric.status)}
                          {getTrendIcon(metric.trend)}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">
                          {metric.value.toFixed(metric.unit === "ms" ? 0 : 1)}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {metric.unit}
                          </span>
                        </div>
                        
                        <Progress
                          value={Math.min(100, (metric.value / metric.threshold.critical) * 100)}
                          className="h-2"
                        />
                        
                        <div className="text-xs text-muted-foreground">
                          Warning: {metric.threshold.warning}{metric.unit} | 
                          Critical: {metric.threshold.critical}{metric.unit}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Status */}
        <Card>
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.map((service, index) => (
                <motion.div
                  key={service.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {service.name.includes("Backend") && <Server className="h-4 w-4" />}
                      {service.name.includes("Database") && <Database className="h-4 w-4" />}
                      {service.name.includes("WebSocket") && <Wifi className="h-4 w-4" />}
                      {service.name.includes("MAVSDK") && <Zap className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium">{service.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Endpoint: {service.endpoint}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm">
                        Response: {service.responseTime.toFixed(0)}ms
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Uptime: {formatUptime(service.uptime)}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <Badge variant={getStatusColor(service.status)}>
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>CPU & Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip 
                    labelFormatter={(value) => new Date(value as number).toLocaleTimeString()}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`, 
                      name === "cpu" ? "CPU" : "Memory"
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memory" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip 
                    labelFormatter={(value) => new Date(value as number).toLocaleTimeString()}
                    formatter={(value: number) => [`${value.toFixed(0)}ms`, "Response Time"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="responseTime" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}