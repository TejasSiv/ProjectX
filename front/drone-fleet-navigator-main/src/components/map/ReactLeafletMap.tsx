import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";
import L from 'leaflet';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom red icon for dropoff locations
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const ReactLeafletMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Default center (NYC)
  const defaultCenter: [number, number] = [40.7128, -74.0060];

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
      {/* Map */}
      <div className="lg:col-span-3">
        <Card>
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
                
                {orders?.map((order) => (
                  <div key={order.id}>
                    {/* Pickup Marker (Blue - Default) */}
                    <Marker position={order.pickupCoords}>
                      <Popup>
                        <div style={{ padding: '8px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontWeight: '600' }}>📍 Pickup Location</h3>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Order: #{order.id.slice(0, 8)}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Customer: {order.customerId}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Status: {order.status}</p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Dropoff Marker (Red) */}
                    <Marker position={order.dropoffCoords} icon={redIcon}>
                      <Popup>
                        <div style={{ padding: '8px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontWeight: '600' }}>🎯 Dropoff Location</h3>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Order: #{order.id.slice(0, 8)}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Customer: {order.customerId}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Status: {order.status}</p>
                          {order.estimatedTime && (
                            <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>ETA: {order.estimatedTime} min</p>
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Active Orders ({orders?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders?.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No active orders</p>
                <p className="text-xs text-muted-foreground mt-2">Create an order to see it on the map</p>
              </div>
            ) : (
              orders?.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedOrder === order.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedOrder(order.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      #{order.id.slice(0, 8)}
                    </span>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-500" />
                      From: {order.pickupCoords[0].toFixed(4)}, {order.pickupCoords[1].toFixed(4)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      To: {order.dropoffCoords[0].toFixed(4)}, {order.dropoffCoords[1].toFixed(4)}
                    </div>
                    <div>Customer: {order.customerId}</div>
                    {order.estimatedTime && (
                      <div>ETA: {order.estimatedTime} min</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Map Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <div>Total Orders: {orders?.length || 0}</div>
              <div>Pending: {orders?.filter(o => o.status === 'pending').length || 0}</div>
              <div>In Flight: {orders?.filter(o => o.status === 'in_flight').length || 0}</div>
              <div>Completed: {orders?.filter(o => o.status === 'completed').length || 0}</div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legend</CardTitle>
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
              <div className="w-4 h-1 bg-green-500"></div>
              <span>In Flight Route</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-1 bg-blue-500"></div>
              <span>Scheduled Route</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-1 bg-gray-500 border-dashed border-t-2"></div>
              <span>Completed Route</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReactLeafletMap;