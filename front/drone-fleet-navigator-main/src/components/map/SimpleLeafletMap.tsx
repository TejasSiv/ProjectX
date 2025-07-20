import { useEffect, useState, useRef } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";

const SimpleLeafletMap = () => {
  const { data: orders, isLoading } = useOrders();
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Default center
  const defaultCenter: [number, number] = [40.7128, -74.0060];

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        console.log('Starting map initialization...');
        
        // Import Leaflet
        const L = await import('leaflet');
        console.log('Leaflet imported successfully');

        // Import CSS
        await import('leaflet/dist/leaflet.css');
        console.log('Leaflet CSS imported');

        if (!mounted) return;

        // Fix marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Create map
        console.log('Creating map...');
        const map = L.map(mapContainerRef.current).setView(defaultCenter, 12);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        mapRef.current = map;
        console.log('Map created successfully');
        setMapReady(true);

      } catch (err) {
        console.error('Error initializing map:', err);
        setError(`Failed to load map: ${err}`);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Add markers when orders change
  useEffect(() => {
    if (!mapReady || !mapRef.current || !orders) return;

    const addMarkers = async () => {
      try {
        const L = await import('leaflet');
        
        // Clear existing markers (simple approach)
        mapRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            mapRef.current.removeLayer(layer);
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
          // Pickup marker (blue)
          L.marker(order.pickupCoords)
            .addTo(mapRef.current)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600;">📍 Pickup Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 14px;">Order: #${order.id.slice(0, 8)}</p>
                <p style="margin: 0; font-size: 12px; color: #666;">Status: ${order.status}</p>
              </div>
            `);

          // Dropoff marker (red)
          L.marker(order.dropoffCoords, { icon: redIcon })
            .addTo(mapRef.current)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600;">🎯 Dropoff Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 14px;">Order: #${order.id.slice(0, 8)}</p>
                <p style="margin: 0; font-size: 12px; color: #666;">Status: ${order.status}</p>
              </div>
            `);

          // Route line
          L.polyline([order.pickupCoords, order.dropoffCoords], {
            color: order.status === 'in_flight' ? '#22c55e' : '#6b7280',
            weight: order.status === 'in_flight' ? 4 : 2,
            opacity: order.status === 'in_flight' ? 0.8 : 0.5,
            dashArray: order.status === 'completed' ? '10, 10' : undefined
          }).addTo(mapRef.current);
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

  if (!mapReady) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="h-[600px] bg-muted/20 rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <div className="text-lg font-medium">Initializing Map...</div>
                  <div className="text-sm text-muted-foreground">Loading Leaflet components...</div>
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
          <CardContent className="space-y-3">
            {orders?.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No active orders</p>
                <p className="text-xs text-muted-foreground mt-2">Create an order to see it on the map</p>
              </div>
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
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <div>Map Ready: {mapReady ? '✅' : '❌'}</div>
              <div>Orders Loaded: {isLoading ? '⏳' : '✅'}</div>
              <div>Orders Count: {orders?.length || 0}</div>
              <div>Error: {error ? '❌' : '✅'}</div>
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
              <span>Active Route</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-1 bg-gray-500"></div>
              <span>Inactive Route</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleLeafletMap;