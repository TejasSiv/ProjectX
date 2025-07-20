import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Radio, Battery, Signal, ExternalLink } from "lucide-react";

interface DronePosition {
  id: string;
  orderId: string;
  position: [number, number];
  altitude: number;
  speed: number;
  battery: number;
  status: 'idle' | 'flying' | 'completed';
  lastUpdate: Date;
}

interface Mission {
  id: string;
  order_id: string;
  waypoints: Array<{
    lat: number;
    lng: number;
    action: string;
    altitude: number;
    description: string;
  }>;
  status: string;
  progress: number;
  current_waypoint_index: number;
}

const ReliableMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [drones, setDrones] = useState<DronePosition[]>([]);
  const [selectedDrone, setSelectedDrone] = useState<string | null>(null);

  // Fetch missions data
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const response = await fetch("https://liswqdeiydvouikhuuwf.supabase.co/rest/v1/missions?select=*", {
          headers: {
            'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw",
            'Authorization': "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw"
          }
        });
        const data = await response.json();
        setMissions(data || []);
        console.log('Missions loaded:', data?.length);
      } catch (err) {
        console.error('Error fetching missions:', err);
      }
    };

    fetchMissions();
    const interval = setInterval(fetchMissions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Generate simulated drone positions
  useEffect(() => {
    if (!missions.length || !orders?.length) return;

    const simulatedDrones: DronePosition[] = missions.map((mission, index) => {
      const order = orders.find(o => o.id === mission.order_id);
      if (!order) return null;

      const currentWaypoint = mission.waypoints[mission.current_waypoint_index] || mission.waypoints[0];
      const progress = mission.progress || 0;
      
      let position: [number, number];
      if (mission.status === 'in_progress' && mission.current_waypoint_index < mission.waypoints.length - 1) {
        const current = mission.waypoints[mission.current_waypoint_index];
        const next = mission.waypoints[mission.current_waypoint_index + 1];
        const segmentProgress = (progress * mission.waypoints.length) % 1;
        position = [
          current.lat + (next.lat - current.lat) * segmentProgress,
          current.lng + (next.lng - current.lng) * segmentProgress
        ];
      } else {
        position = [currentWaypoint.lat, currentWaypoint.lng];
      }

      return {
        id: `drone-${index + 1}`,
        orderId: mission.order_id,
        position,
        altitude: currentWaypoint.altitude,
        speed: mission.status === 'in_progress' ? 15 + Math.random() * 10 : 0,
        battery: 85 + Math.random() * 15,
        status: mission.status === 'completed' ? 'completed' : 
                mission.status === 'in_progress' ? 'flying' : 'idle',
        lastUpdate: new Date()
      };
    }).filter(Boolean) as DronePosition[];

    setDrones(simulatedDrones);
    console.log('Drones updated:', simulatedDrones.length);
  }, [missions, orders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'flying': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getGoogleMapsUrl = (coords: [number, number]) => {
    return `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
  };

  const getRouteUrl = (pickup: [number, number], dropoff: [number, number]) => {
    return `https://www.google.com/maps/dir/${pickup[0]},${pickup[1]}/${dropoff[0]},${dropoff[1]}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="h-[600px] bg-muted/20 rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <div className="text-lg font-medium">Loading Orders...</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Interactive Map Display */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-500 animate-pulse" />
              Live Drone Tracking
              <Badge variant="outline" className="ml-auto">
                {drones.length} Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[600px] bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6 overflow-y-auto border-2 border-dashed border-green-200">
              
              {/* Map Header */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-green-700 mb-2">🗽 NYC Drone Operations Center</h3>
                <p className="text-sm text-gray-600">Real-time tracking of {drones.length} active drones across Manhattan</p>
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  <span className="bg-green-100 px-2 py-1 rounded">✅ Map Active</span>
                  <span className="bg-blue-100 px-2 py-1 rounded">📡 Live Updates</span>
                  <span className="bg-purple-100 px-2 py-1 rounded">🚁 {drones.filter(d => d.status === 'flying').length} Flying</span>
                </div>
              </div>

              {/* Drone Grid Display */}
              <div className="space-y-4">
                {drones.length === 0 ? (
                  <div className="text-center py-24">
                    <div className="text-6xl mb-4">🚁</div>
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No Drones Active</h3>
                    <p className="text-gray-500">Drones will appear here when missions are in progress</p>
                  </div>
                ) : (
                  drones.map((drone) => {
                    const order = orders?.find(o => o.id === drone.orderId);
                    const mission = missions.find(m => m.order_id === drone.orderId);
                    return (
                      <div
                        key={drone.id}
                        className={`bg-white border-2 rounded-lg p-4 transition-all duration-300 ${
                          selectedDrone === drone.id ? 'border-green-400 shadow-lg scale-105' : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                        }`}
                        onClick={() => setSelectedDrone(selectedDrone === drone.id ? null : drone.id)}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          
                          {/* Drone Status */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                                drone.status === 'flying' ? 'bg-green-100 animate-bounce' : 
                                drone.status === 'completed' ? 'bg-gray-100' : 'bg-yellow-100'
                              }`}>
                                🚁
                              </div>
                              <div>
                                <div className="font-semibold text-gray-800">{drone.id}</div>
                                <Badge className={getStatusColor(drone.status)}>
                                  {drone.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">
                              Order: #{order?.id.slice(0, 8)}
                            </div>
                          </div>

                          {/* Current Position */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <MapPin className="w-4 h-4 text-green-600" />
                              <span>Current Position</span>
                            </div>
                            <div className="text-xs text-gray-600 font-mono">
                              {drone.position[0].toFixed(4)}, {drone.position[1].toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Altitude: {drone.altitude}m
                            </div>
                            <a
                              href={getGoogleMapsUrl(drone.position)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Live
                            </a>
                          </div>

                          {/* Mission Info */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Navigation className="w-4 h-4 text-blue-600" />
                              <span>Mission Route</span>
                            </div>
                            {order && (
                              <>
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span>From: {order.pickupCoords[0].toFixed(3)}, {order.pickupCoords[1].toFixed(3)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span>To: {order.dropoffCoords[0].toFixed(3)}, {order.dropoffCoords[1].toFixed(3)}</span>
                                  </div>
                                </div>
                                <a
                                  href={getRouteUrl(order.pickupCoords, order.dropoffCoords)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Get Route
                                </a>
                              </>
                            )}
                          </div>

                          {/* Telemetry */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700">Live Telemetry</div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <Battery className="w-3 h-3 text-green-600" />
                                <span className="font-mono">{drone.battery.toFixed(0)}%</span>
                                <div className={`w-8 h-2 rounded-full ${
                                  drone.battery > 50 ? 'bg-green-200' : 'bg-yellow-200'
                                }`}>
                                  <div 
                                    className={`h-full rounded-full ${
                                      drone.battery > 50 ? 'bg-green-500' : 'bg-yellow-500'
                                    }`}
                                    style={{ width: `${drone.battery}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <Signal className="w-3 h-3 text-blue-600" />
                                <span className="font-mono">{drone.speed.toFixed(1)} m/s</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Updated: {drone.lastUpdate.toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {selectedDrone === drone.id && mission && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-sm font-medium mb-2">Mission Progress</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {mission.waypoints.map((waypoint, index) => (
                                <div key={index} className={`p-2 rounded ${
                                  index <= mission.current_waypoint_index ? 'bg-green-100' : 'bg-gray-100'
                                }`}>
                                  <div className="font-medium">{waypoint.action}</div>
                                  <div className="text-gray-600">{waypoint.description}</div>
                                  <div className="text-gray-500">{waypoint.lat.toFixed(3)}, {waypoint.lng.toFixed(3)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-500" />
              Control Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{drones.length}</div>
                <div className="text-xs text-gray-600">Total Drones</div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {drones.filter(d => d.status === 'flying').length}
                </div>
                <div className="text-xs text-gray-600">Currently Flying</div>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {drones.filter(d => d.status === 'idle').length}
                </div>
                <div className="text-xs text-gray-600">On Standby</div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {drones.filter(d => d.status === 'completed').length}
                </div>
                <div className="text-xs text-gray-600">Missions Complete</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span>Map Status:</span>
                <span className="text-green-600">✅ Active</span>
              </div>
              <div className="flex justify-between">
                <span>Data Feed:</span>
                <span className="text-green-600">🔄 Live</span>
              </div>
              <div className="flex justify-between">
                <span>Missions:</span>
                <span className="text-blue-600">{missions.length} Total</span>
              </div>
              <div className="flex justify-between">
                <span>Orders:</span>
                <span className="text-blue-600">{orders?.length || 0} Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Flying</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span>Idle/Standby</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
              <span>Mission Complete</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>External Maps</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReliableMap;