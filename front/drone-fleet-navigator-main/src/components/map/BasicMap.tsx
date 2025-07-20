import { useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck, ExternalLink } from "lucide-react";

const BasicMap = () => {
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
      {/* Map Placeholder with Interactive List */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Locations Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[600px] bg-muted/10 rounded-lg p-6 overflow-y-auto">
              {orders?.length === 0 ? (
                <div className="text-center py-24">
                  <MapPin className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Orders to Display</h3>
                  <p className="text-muted-foreground">Create delivery orders to see them mapped here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold mb-2">NYC Delivery Routes</h3>
                    <p className="text-sm text-muted-foreground">Click any location to view in Google Maps</p>
                  </div>
                  
                  {orders?.map((order, index) => (
                    <div
                      key={order.id}
                      className="bg-background border rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">#{order.id.slice(0, 8)}</span>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Customer: {order.customerId}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Pickup Location */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span>Pickup Location</span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {order.pickupCoords[0].toFixed(4)}, {order.pickupCoords[1].toFixed(4)}
                          </div>
                          <a
                            href={getGoogleMapsUrl(order.pickupCoords)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View in Maps
                          </a>
                        </div>

                        {/* Dropoff Location */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>Dropoff Location</span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {order.dropoffCoords[0].toFixed(4)}, {order.dropoffCoords[1].toFixed(4)}
                          </div>
                          <a
                            href={getGoogleMapsUrl(order.dropoffCoords)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View in Maps
                          </a>
                        </div>

                        {/* Route Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Navigation className="w-3 h-3" />
                            <span>Route</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.estimatedTime ? `ETA: ${order.estimatedTime} min` : 'Time: TBD'}
                          </div>
                          <a
                            href={getRouteUrl(order.pickupCoords, order.dropoffCoords)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Get Directions
                          </a>
                        </div>
                      </div>

                      {/* Route Status Bar */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Created: {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'in_flight' ? 'bg-green-100 text-green-800' :
                            order.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status === 'in_flight' ? '🚁 Drone En Route' :
                             order.status === 'scheduled' ? '📅 Scheduled' :
                             order.status === 'completed' ? '✅ Delivered' :
                             '⏳ Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-muted/50 p-3 rounded">
                <div className="text-2xl font-bold">{orders?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Total Orders</div>
              </div>
              
              <div className="bg-yellow-500/10 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-600">
                  {orders?.filter(o => o.status === 'pending').length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              
              <div className="bg-green-500/10 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {orders?.filter(o => o.status === 'in_flight').length || 0}
                </div>
                <div className="text-xs text-muted-foreground">In Flight</div>
              </div>
              
              <div className="bg-gray-500/10 p-3 rounded">
                <div className="text-2xl font-bold text-gray-600">
                  {orders?.filter(o => o.status === 'completed').length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span>Pickup Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span>Dropoff Location</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>External Map Links</span>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Interactive map with external Google Maps integration for detailed navigation.
              </p>
              <p className="text-xs text-muted-foreground">
                Click "View in Maps" or "Get Directions" to open locations in Google Maps.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BasicMap;