import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";

// Dynamic import for Leaflet components
const DynamicMap = () => {
  const [leafletComponents, setLeafletComponents] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMap = async () => {
      try {
        // Check if we're in the browser
        if (typeof window === 'undefined') {
          return;
        }

        // Dynamic import of react-leaflet components
        const [leaflet, leafletModule] = await Promise.all([
          import('react-leaflet'),
          import('leaflet')
        ]);
        
        // Import CSS
        await import('leaflet/dist/leaflet.css');
        
        // Fix for default markers
        if (leafletModule.Icon.Default.prototype._getIconUrl) {
          delete (leafletModule.Icon.Default.prototype as any)._getIconUrl;
        }
        
        leafletModule.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        setLeafletComponents({
          MapContainer: leaflet.MapContainer,
          TileLayer: leaflet.TileLayer,
          Marker: leaflet.Marker,
          Popup: leaflet.Popup,
          Polyline: leaflet.Polyline,
          Icon: leafletModule.Icon
        });
        
        setMapReady(true);
      } catch (error) {
        console.error('Error loading map:', error);
        setError('Failed to load map components');
      }
    };

    loadMap();
  }, []);

  const { data: orders, isLoading } = useOrders();
  const dronePositions = useDronePositions();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Default center (can be customized based on your area)
  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York City

  if (error) {
    return (
      <div className="h-[600px] bg-card border border-border rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Error loading map: {error}</div>
      </div>
    );
  }

  if (!mapReady || isLoading || !leafletComponents) {
    return (
      <div className="h-[600px] bg-card border border-border rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline, Icon } = leafletComponents;

  // Custom icons for different markers
  const pickupIcon = new Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'pickup-marker'
  });

  const dropoffIcon = new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'dropoff-marker'
  });

  const droneIcon = new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'drone-marker'
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'scheduled': return 'bg-blue-500';
      case 'in_flight': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Map Container */}
      <div className="lg:col-span-3">
        <Card>
          <CardContent className="p-0">
            <div className="h-[600px] rounded-lg overflow-hidden">
              <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Render orders */}
                {orders?.map((order) => (
                  <div key={order.id}>
                    {/* Pickup marker */}
                    <Marker
                      position={order.pickupCoords}
                      icon={pickupIcon}
                      eventHandlers={{
                        click: () => setSelectedOrder(order.id)
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">Pickup Location</h3>
                          <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Dropoff marker */}
                    <Marker
                      position={order.dropoffCoords}
                      icon={dropoffIcon}
                      eventHandlers={{
                        click: () => setSelectedOrder(order.id)
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">Dropoff Location</h3>
                          <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Route line */}
                    <Polyline
                      positions={[order.pickupCoords, order.dropoffCoords]}
                      color={order.status === 'in_flight' ? '#22c55e' : '#6b7280'}
                      weight={order.status === 'in_flight' ? 4 : 2}
                      opacity={order.status === 'in_flight' ? 0.8 : 0.5}
                      dashArray={order.status === 'completed' ? '10, 10' : undefined}
                    />
                    
                    {/* Live drone position */}
                    {dronePositions[order.id] && (
                      <Marker
                        position={dronePositions[order.id]}
                        icon={droneIcon}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold">Drone Position</h3>
                            <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-sm">In Flight</p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </div>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order List Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders</p>
            ) : (
              orders?.map((order) => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedOrder === order.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedOrder(order.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      #{order.id.slice(0, 8)}
                    </span>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>From: {order.pickupCoords[0].toFixed(4)}, {order.pickupCoords[1].toFixed(4)}</div>
                    <div>To: {order.dropoffCoords[0].toFixed(4)}, {order.dropoffCoords[1].toFixed(4)}</div>
                    {order.estimatedTime && (
                      <div>ETA: {order.estimatedTime} min</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span>Pickup Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span>Dropoff Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Live Drone Position</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-1 bg-green-500"></div>
              <span>Active Route</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-1 bg-gray-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #6b7280 0, #6b7280 5px, transparent 5px, transparent 10px)'}}></div>
              <span>Completed Route</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Simulated drone positions for live tracking
const useDronePositions = () => {
  const [dronePositions, setDronePositions] = useState<Record<string, [number, number]>>({});
  const { data: orders } = useOrders();

  useEffect(() => {
    const interval = setInterval(() => {
      if (orders) {
        const newPositions: Record<string, [number, number]> = {};
        
        orders.forEach(order => {
          if (order.status === 'in_flight') {
            // Simulate drone movement between pickup and dropoff
            const [pickupLat, pickupLon] = order.pickupCoords;
            const [dropoffLat, dropoffLon] = order.dropoffCoords;
            
            // Simple linear interpolation for simulation
            const progress = (Date.now() % 60000) / 60000; // 1-minute cycle
            const lat = pickupLat + (dropoffLat - pickupLat) * progress;
            const lon = pickupLon + (dropoffLon - pickupLon) * progress;
            
            newPositions[order.id] = [lat, lon];
          }
        });
        
        setDronePositions(newPositions);
      }
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [orders]);

  return dronePositions;
};

export default DynamicMap;