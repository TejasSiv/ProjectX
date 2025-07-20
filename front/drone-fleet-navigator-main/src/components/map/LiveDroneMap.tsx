import { useEffect, useRef, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck, Radio, Battery, Signal } from "lucide-react";

interface DronePosition {
  id: string;
  orderId: string;
  position: [number, number];
  altitude: number;
  heading: number;
  speed: number;
  battery: number;
  status: 'idle' | 'takeoff' | 'flying' | 'landing' | 'completed';
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

const LiveDroneMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [drones, setDrones] = useState<DronePosition[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

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
    const interval = setInterval(fetchMissions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Generate simulated drone positions based on missions
  useEffect(() => {
    if (!missions.length || !orders?.length) return;

    const simulatedDrones: DronePosition[] = missions.map((mission, index) => {
      const order = orders.find(o => o.id === mission.order_id);
      if (!order) return null;

      // Simulate drone position based on mission progress
      const currentWaypoint = mission.waypoints[mission.current_waypoint_index] || mission.waypoints[0];
      const progress = mission.progress || 0;
      
      // If in progress, simulate movement between waypoints
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
        heading: Math.random() * 360, // Simulated heading
        speed: mission.status === 'in_progress' ? 15 + Math.random() * 10 : 0,
        battery: 85 + Math.random() * 15, // Simulated battery 85-100%
        status: mission.status === 'completed' ? 'completed' : 
                mission.status === 'in_progress' ? 'flying' : 'idle',
        lastUpdate: new Date()
      };
    }).filter(Boolean) as DronePosition[];

    setDrones(simulatedDrones);
  }, [missions, orders]);

  // Initialize map
  useEffect(() => {
    let mounted = true;
    let map: any = null;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        console.log('Initializing live drone map...');
        
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (!mounted) return;

        // Fix marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Create map
        map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          zoomControl: true,
          attributionControl: true
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapRef.current = map;
        console.log('Live drone map initialized successfully');
        setMapReady(true);

      } catch (err: any) {
        console.error('Error initializing map:', err);
        setError(`Map initialization failed: ${err.message}`);
      }
    };

    const timer = setTimeout(initMap, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (map) {
        try {
          map.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
      }
    };
  }, []);

  // Update map markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const updateMapMarkers = async () => {
      try {
        const L = (await import('leaflet')).default;
        const map = mapRef.current;

        // Clear existing markers
        markersRef.current.forEach(marker => {
          map.removeLayer(marker);
        });
        markersRef.current.clear();

        // Create custom drone icon
        const droneIcon = L.divIcon({
          html: `<div style="
            width: 32px; 
            height: 32px; 
            background: #22c55e; 
            border: 3px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 16px;
          ">🚁</div>`,
          className: 'custom-drone-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const completedDroneIcon = L.divIcon({
          html: `<div style="
            width: 28px; 
            height: 28px; 
            background: #6b7280; 
            border: 2px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            font-size: 14px;
          ">🚁</div>`,
          className: 'custom-drone-marker-completed',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        // Add drone markers
        drones.forEach((drone) => {
          const order = orders?.find(o => o.id === drone.orderId);
          if (!order) return;

          const icon = drone.status === 'completed' ? completedDroneIcon : droneIcon;
          const marker = L.marker(drone.position, { icon })
            .addTo(map)
            .bindPopup(`
              <div style="padding: 12px; min-width: 240px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #22c55e;">🚁 Drone ${drone.id}</h3>
                <div style="margin-bottom: 8px;">
                  <strong>Order:</strong> #${order.id.slice(0, 8)}<br>
                  <strong>Customer:</strong> ${order.customerId}<br>
                  <strong>Status:</strong> ${drone.status}
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Position:</strong> ${drone.position[0].toFixed(4)}, ${drone.position[1].toFixed(4)}<br>
                  <strong>Altitude:</strong> ${drone.altitude}m<br>
                  <strong>Speed:</strong> ${drone.speed.toFixed(1)} m/s
                </div>
                <div style="font-size: 12px; color: #666;">
                  <strong>Battery:</strong> ${drone.battery.toFixed(0)}%<br>
                  <strong>Last Update:</strong> ${drone.lastUpdate.toLocaleTimeString()}
                </div>
              </div>
            `);

          markersRef.current.set(drone.id, marker);
        });

        // Add pickup/dropoff markers for orders
        orders?.forEach((order) => {
          // Pickup marker (blue)
          const pickupMarker = L.marker(order.pickupCoords)
            .addTo(map)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #3b82f6;">📍 Pickup</h3>
                <p style="margin: 0;">Order: #${order.id.slice(0, 8)}</p>
                <p style="margin: 0; font-size: 12px;">Customer: ${order.customerId}</p>
              </div>
            `);

          // Dropoff marker (red)
          const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
          });

          const dropoffMarker = L.marker(order.dropoffCoords, { icon: redIcon })
            .addTo(map)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #dc2626;">🎯 Dropoff</h3>
                <p style="margin: 0;">Order: #${order.id.slice(0, 8)}</p>
                <p style="margin: 0; font-size: 12px;">Customer: ${order.customerId}</p>
              </div>
            `);

          markersRef.current.set(`pickup-${order.id}`, pickupMarker);
          markersRef.current.set(`dropoff-${order.id}`, dropoffMarker);

          // Route line
          const routeColor = order.status === 'in_flight' ? '#22c55e' : 
                           order.status === 'scheduled' ? '#3b82f6' : '#6b7280';
          
          const routeLine = L.polyline([order.pickupCoords, order.dropoffCoords], {
            color: routeColor,
            weight: 2,
            opacity: 0.6,
            dashArray: order.status === 'completed' ? '5, 5' : undefined
          }).addTo(map);

          markersRef.current.set(`route-${order.id}`, routeLine);
        });

        console.log(`Updated map with ${drones.length} drones and ${orders?.length || 0} orders`);

      } catch (err) {
        console.error('Error updating map markers:', err);
      }
    };

    updateMapMarkers();
  }, [drones, orders, mapReady]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'flying': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="h-[600px] bg-red-50 rounded-lg flex items-center justify-center border-2 border-dashed border-red-200">
                <div className="text-center space-y-4">
                  <div className="text-lg font-medium text-red-600">Map Error</div>
                  <div className="text-sm text-red-500">{error}</div>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-red-600 text-white rounded"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !mapReady) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="h-[600px] bg-muted/20 rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <div className="text-lg font-medium">
                    {isLoading ? 'Loading Orders...' : 'Initializing Live Map...'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? 'Fetching delivery data...' : 'Setting up drone tracking...'}
                  </div>
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
      {/* Live Map */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-500" />
              Live Drone Tracking
              <Badge variant="outline" className="ml-auto">
                {drones.length} Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              ref={mapContainerRef}
              className="h-[600px] w-full rounded-lg"
              style={{ minHeight: '600px' }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Drone Status Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Active Drones ({drones.length})
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
                      <div className="flex items-center gap-2">
                        <Battery className="w-3 h-3" />
                        {drone.battery.toFixed(0)}%
                      </div>
                      <div className="flex items-center gap-2">
                        <Signal className="w-3 h-3" />
                        {drone.speed.toFixed(1)} m/s
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Mission Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mission Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <div>Total Missions: {missions.length}</div>
              <div>Active Drones: {drones.filter(d => d.status === 'flying').length}</div>
              <div>Completed: {missions.filter(m => m.status === 'completed').length}</div>
              <div>In Progress: {missions.filter(m => m.status === 'in_progress').length}</div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs">🚁</div>
              <span>Active Drone</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center text-xs">🚁</div>
              <span>Completed Mission</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span>Pickup Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span>Dropoff Location</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveDroneMap;