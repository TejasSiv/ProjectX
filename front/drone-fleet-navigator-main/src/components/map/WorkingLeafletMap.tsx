import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Radio, Battery } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom drone icon
const createDroneIcon = (status: string) => {
  const color = status === 'flying' ? '#22c55e' : status === 'completed' ? '#6b7280' : '#eab308';
  return L.divIcon({
    html: `<div style="
      width: 30px; 
      height: 30px; 
      background: ${color}; 
      border: 3px solid white; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 14px;
    ">🚁</div>`,
    className: 'custom-drone-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Red icon for dropoff locations
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

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

const WorkingLeafletMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [drones, setDrones] = useState<DronePosition[]>([]);

  // Default center (NYC)
  const defaultCenter: [number, number] = [40.7128, -74.0060];

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'flying': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getRouteColor = (status: string) => {
    switch (status) {
      case 'in_flight': return '#22c55e';
      case 'completed': return '#6b7280';
      case 'scheduled': return '#3b82f6';
      default: return '#9ca3af';
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
                  <div className="text-lg font-medium">Loading Map...</div>
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
      {/* Map */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <MapPin className="w-5 h-5 text-blue-500" />
              Live Drone Map
              <Badge variant="outline" className="ml-auto">
                {drones.length} Drones
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[600px] w-full rounded-lg overflow-hidden">
              <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* Drone markers */}
                {drones.map((drone) => {
                  const order = orders?.find(o => o.id === drone.orderId);
                  return (
                    <Marker 
                      key={drone.id} 
                      position={drone.position} 
                      icon={createDroneIcon(drone.status)}
                    >
                      <Popup>
                        <div style={{ padding: '8px', minWidth: '200px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#22c55e' }}>
                            🚁 {drone.id}
                          </h3>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Order:</strong> #{order?.id.slice(0, 8)}<br/>
                            <strong>Customer:</strong> {order?.customerId}<br/>
                            <strong>Status:</strong> {drone.status}
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Position:</strong> {drone.position[0].toFixed(4)}, {drone.position[1].toFixed(4)}<br/>
                            <strong>Altitude:</strong> {drone.altitude}m<br/>
                            <strong>Speed:</strong> {drone.speed.toFixed(1)} m/s
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            <strong>Battery:</strong> {drone.battery.toFixed(0)}%<br/>
                            <strong>Last Update:</strong> {drone.lastUpdate.toLocaleTimeString()}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Order markers and routes */}
                {orders?.map((order) => (
                  <div key={order.id}>
                    {/* Pickup Marker (Blue - Default) */}
                    <Marker position={order.pickupCoords}>
                      <Popup>
                        <div style={{ padding: '8px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#3b82f6' }}>
                            📍 Pickup Location
                          </h3>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                            Order: #{order.id.slice(0, 8)}
                          </p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                            Customer: {order.customerId}
                          </p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Dropoff Marker (Red) */}
                    <Marker position={order.dropoffCoords} icon={redIcon}>
                      <Popup>
                        <div style={{ padding: '8px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#dc2626' }}>
                            🎯 Dropoff Location
                          </h3>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                            Order: #{order.id.slice(0, 8)}
                          </p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                            Customer: {order.customerId}
                          </p>
                          {order.estimatedTime && (
                            <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                              ETA: {order.estimatedTime} min
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Route Line */}
                    <Polyline
                      positions={[order.pickupCoords, order.dropoffCoords]}
                      color={getRouteColor(order.status)}
                      weight={order.status === 'in_flight' ? 4 : 2}
                      opacity={order.status === 'in_flight' ? 0.8 : 0.5}
                      dashArray={order.status === 'completed' ? '10, 10' : undefined}
                    />
                  </div>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Radio className="w-5 h-5 text-green-500" />
              Live Drones ({drones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
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
                    className="p-3 rounded-lg border bg-background"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-2 text-foreground">
                        🚁 {drone.id}
                      </span>
                      <Badge className={getStatusColor(drone.status)}>
                        {drone.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Order: #{order?.id.slice(0, 8)}</div>
                      <div>Position: {drone.position[0].toFixed(4)}, {drone.position[1].toFixed(4)}</div>
                      <div className="flex items-center gap-2">
                        <Battery className="w-3 h-3" />
                        {drone.battery.toFixed(0)}%
                      </div>
                      <div>Speed: {drone.speed.toFixed(1)} m/s</div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <div className="flex justify-between text-foreground">
                <span>Total Orders:</span>
                <span>{orders?.length || 0}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>Active Drones:</span>
                <span className="text-green-400">{drones.filter(d => d.status === 'flying').length}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>Completed:</span>
                <span>{drones.filter(d => d.status === 'completed').length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Legend</CardTitle>
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

export default WorkingLeafletMap;