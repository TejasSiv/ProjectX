import { useEffect, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";

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

const SimpleMap = () => {
  const { data: orders, isLoading } = useOrders();
  const dronePositions = useDronePositions();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="h-[600px] bg-card border border-border rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Map Placeholder */}
      <div className="lg:col-span-3">
        <Card>
          <CardContent className="p-6">
            <div className="h-[600px] bg-muted/20 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
              <div className="text-center space-y-4">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground" />
                <div className="text-lg font-medium">Interactive Map</div>
                <div className="text-sm text-muted-foreground max-w-md">
                  Interactive map with live drone tracking will be displayed here once fully loaded.
                  For now, you can view active orders in the sidebar.
                </div>
                <div className="text-xs text-muted-foreground">
                  Map coordinates: 40.7128, -74.0060 (New York City)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order List Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Active Orders
            </CardTitle>
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
                    {order.estimatedTime && (
                      <div>ETA: {order.estimatedTime} min</div>
                    )}
                    {dronePositions[order.id] && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Navigation className="w-3 h-3" />
                        Live: {dronePositions[order.id][0].toFixed(4)}, {dronePositions[order.id][1].toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Orders:</span>
                  <span className="font-medium">{orders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>In Flight:</span>
                  <span className="font-medium text-green-600">
                    {orders.filter(o => o.status === 'in_flight').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pending:</span>
                  <span className="font-medium text-yellow-600">
                    {orders.filter(o => o.status === 'pending').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Completed:</span>
                  <span className="font-medium text-gray-600">
                    {orders.filter(o => o.status === 'completed').length}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span>Pickup Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-red-500" />
              <span>Dropoff Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Navigation className="w-4 h-4 text-green-500" />
              <span>Live Drone Position</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Order Identifier</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleMap;