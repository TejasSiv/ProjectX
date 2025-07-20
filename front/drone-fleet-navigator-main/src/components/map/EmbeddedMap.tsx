import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Radio, Battery, Maximize2 } from "lucide-react";

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

const EmbeddedMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [drones, setDrones] = useState<DronePosition[]>([]);

  // Default center (NYC)
  const mapCenter = "40.7128,-74.0060";
  const zoom = "12";

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
  }, [missions, orders]);

  // Generate Google Maps URL with markers
  const generateMapUrl = () => {
    let url = `https://www.google.com/maps/embed/v1/view?key=AIzaSyC4R6AN7SmujjPUIGKdyao2Kqitzr1kiRg&center=${mapCenter}&zoom=${zoom}`;
    
    // Add markers for drones and locations
    if (drones.length > 0 || orders?.length) {
      const markers: string[] = [];
      
      // Add drone markers
      drones.forEach((drone) => {
        const color = drone.status === 'flying' ? 'green' : drone.status === 'completed' ? 'gray' : 'yellow';
        markers.push(`color:${color}|label:D|${drone.position[0]},${drone.position[1]}`);
      });
      
      // Add pickup/dropoff markers
      orders?.forEach((order, index) => {
        if (index < 10) { // Limit to avoid URL length issues
          markers.push(`color:blue|label:P|${order.pickupCoords[0]},${order.pickupCoords[1]}`);
          markers.push(`color:red|label:D|${order.dropoffCoords[0]},${order.dropoffCoords[1]}`);
        }
      });

      if (markers.length > 0) {
        url = `https://www.google.com/maps/embed/v1/view?key=AIzaSyC4R6AN7SmujjPUIGKdyao2Kqitzr1kiRg&center=${mapCenter}&zoom=${zoom}&markers=${markers.join('|')}`;
      }
    }
    
    return url;
  };

  // Fallback OpenStreetMap embed
  const openStreetMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=-74.2,40.6,-73.8,40.8&layer=mapnik&marker=${mapCenter}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'flying': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
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
                  <div className="text-lg font-medium">Loading Map Data...</div>
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
      {/* Embedded Map */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              Live Drone Map - NYC Operations
              <Badge variant="outline" className="ml-auto">
                {drones.length} Drones Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative h-[600px] w-full">
              {/* Primary embedded map */}
              <iframe
                src={openStreetMapUrl}
                width="100%"
                height="600"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-lg"
                title="Drone Delivery Map"
              />
              
              {/* Map overlay with drone indicators */}
              <div className="absolute top-4 left-4 right-4 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {drones.filter(d => d.status === 'flying').length} Flying
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        {drones.filter(d => d.status === 'idle').length} Idle
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        {drones.filter(d => d.status === 'completed').length} Complete
                      </span>
                    </div>
                    <button 
                      onClick={() => window.open(openStreetMapUrl, '_blank')}
                      className="pointer-events-auto flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Full Screen
                    </button>
                  </div>
                </div>
              </div>

              {/* Live drone positions overlay */}
              {drones.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
                    <div className="text-sm font-medium mb-2">Live Drone Positions</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                      {drones.slice(0, 4).map((drone) => (
                        <div key={drone.id} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            drone.status === 'flying' ? 'bg-green-500 animate-pulse' : 
                            drone.status === 'completed' ? 'bg-gray-500' : 'bg-yellow-500'
                          }`} />
                          <span className="font-mono">
                            {drone.id}: {drone.position[0].toFixed(3)}, {drone.position[1].toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drone Control Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-500" />
              Live Drones ({drones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {drones.length === 0 ? (
              <div className="text-center py-8">
                <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No active drones</p>
              </div>
            ) : (
              drones.map((drone) => {
                const order = orders?.find(o => o.id === drone.orderId);
                return (
                  <div
                    key={drone.id}
                    className="p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        🚁 {drone.id}
                      </span>
                      <Badge className={getStatusColor(drone.status)}>
                        {drone.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Order: #{order?.id.slice(0, 8)}</div>
                      <div>Position: {drone.position[0].toFixed(4)}, {drone.position[1].toFixed(4)}</div>
                      <div>Altitude: {drone.altitude}m</div>
                      <div className="flex items-center gap-2">
                        <Battery className="w-3 h-3" />
                        {drone.battery.toFixed(0)}%
                      </div>
                      <div>Speed: {drone.speed.toFixed(1)} m/s</div>
                      <div>Updated: {drone.lastUpdate.toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Map Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Map View</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <button 
                onClick={() => window.open(`https://www.google.com/maps/@${mapCenter},${zoom}z`, '_blank')}
                className="w-full text-left px-3 py-2 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-sm text-foreground border border-blue-500/20"
              >
                📍 Google Maps View
              </button>
              <button 
                onClick={() => window.open(openStreetMapUrl, '_blank')}
                className="w-full text-left px-3 py-2 rounded bg-green-500/10 hover:bg-green-500/20 transition-colors text-sm text-foreground border border-green-500/20"
              >
                🗺️ OpenStreetMap View
              </button>
              <button 
                onClick={() => window.open(`https://www.google.com/maps/search/drone+delivery+nyc/@${mapCenter},${zoom}z`, '_blank')}
                className="w-full text-left px-3 py-2 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors text-sm text-foreground border border-purple-500/20"
              >
                🚁 Satellite View
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Live Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Live Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between text-foreground">
                <span>Total Orders:</span>
                <span className="font-mono text-foreground">{orders?.length || 0}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>Active Missions:</span>
                <span className="font-mono text-foreground">{missions.length}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>Flying Drones:</span>
                <span className="font-mono text-green-400">{drones.filter(d => d.status === 'flying').length}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>Map Center:</span>
                <span className="font-mono text-xs text-foreground">NYC</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Map Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Flying Drone</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span>Idle Drone</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span>Pickup Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span>Dropoff Location</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmbeddedMap;