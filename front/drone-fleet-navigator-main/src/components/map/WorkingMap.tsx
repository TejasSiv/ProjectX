import { useEffect, useRef, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";

const WorkingMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Default center (NYC)
  const defaultCenter: [number, number] = [40.7128, -74.0060];

  useEffect(() => {
    let mounted = true;
    let map: any = null;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        console.log('Initializing map...');
        
        // Import Leaflet
        const L = (await import('leaflet')).default;
        
        // Import CSS
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
          zoom: 12,
          zoomControl: true,
          attributionControl: true
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapRef.current = map;
        console.log('Map initialized successfully');
        setMapReady(true);

      } catch (err: any) {
        console.error('Error initializing map:', err);
        setError(`Map initialization failed: ${err.message}`);
      }
    };

    // Small delay to ensure DOM is ready
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

  // Add markers when orders change
  useEffect(() => {
    if (!mapReady || !mapRef.current || !orders?.length) return;

    const addMarkers = async () => {
      try {
        const L = (await import('leaflet')).default;
        const map = mapRef.current;
        
        // Clear existing layers
        map.eachLayer((layer: any) => {
          if (layer.options && (layer.options.isMarker || layer.options.isPolyline)) {
            map.removeLayer(layer);
          }
        });

        // Create red icon for dropoff
        const redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        // Add markers for each order
        orders.forEach((order) => {
          // Pickup marker (blue/default)
          const pickupMarker = L.marker(order.pickupCoords, { isMarker: true })
            .addTo(map)
            .bindPopup(`
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #2563eb;">📍 Pickup Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Order:</strong> #${order.id.slice(0, 8)}</p>
                <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Customer:</strong> ${order.customerId}</p>
                <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Status:</strong> ${order.status}</p>
                <p style="margin: 0; font-size: 12px;"><strong>Coordinates:</strong> ${order.pickupCoords[0].toFixed(4)}, ${order.pickupCoords[1].toFixed(4)}</p>
              </div>
            `);

          // Dropoff marker (red)
          const dropoffMarker = L.marker(order.dropoffCoords, { icon: redIcon, isMarker: true })
            .addTo(map)
            .bindPopup(`
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #dc2626;">🎯 Dropoff Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Order:</strong> #${order.id.slice(0, 8)}</p>
                <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Customer:</strong> ${order.customerId}</p>
                <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Status:</strong> ${order.status}</p>
                ${order.estimatedTime ? `<p style="margin: 0 0 4px 0; font-size: 12px;"><strong>ETA:</strong> ${order.estimatedTime} min</p>` : ''}
                <p style="margin: 0; font-size: 12px;"><strong>Coordinates:</strong> ${order.dropoffCoords[0].toFixed(4)}, ${order.dropoffCoords[1].toFixed(4)}</p>
              </div>
            `);

          // Route line
          const routeColor = order.status === 'in_flight' ? '#22c55e' : 
                           order.status === 'scheduled' ? '#3b82f6' : 
                           order.status === 'completed' ? '#6b7280' : '#9ca3af';
          
          const routeLine = L.polyline([order.pickupCoords, order.dropoffCoords], {
            color: routeColor,
            weight: order.status === 'in_flight' ? 4 : 2,
            opacity: order.status === 'in_flight' ? 0.8 : 0.5,
            dashArray: order.status === 'completed' ? '10, 10' : undefined,
            isPolyline: true
          }).addTo(map);
        });

        console.log(`Added markers for ${orders.length} orders`);

      } catch (err) {
        console.error('Error adding markers:', err);
      }
    };

    addMarkers();
  }, [orders, mapReady]);

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
                    {isLoading ? 'Loading Orders...' : 'Initializing Map...'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? 'Fetching delivery data...' : 'Setting up map components...'}
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
      {/* Map */}
      <div className="lg:col-span-3">
        <Card>
          <CardContent className="p-0">
            <div 
              ref={mapContainerRef}
              className="h-[600px] w-full rounded-lg"
              style={{ minHeight: '600px', background: '#f0f0f0' }}
            />
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
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {orders?.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No active orders</p>
                <p className="text-xs text-muted-foreground mt-2">Create an order to see it on the map</p>
              </div>
            ) : (
              orders?.slice(0, 15).map((order) => (
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
              <div>Map Ready: {mapReady ? '✅' : '❌'}</div>
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
              <div className="w-4 h-1 bg-gray-500"></div>
              <span>Completed Route</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkingMap;