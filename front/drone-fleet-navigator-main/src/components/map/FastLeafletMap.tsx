import { useEffect, useState, useRef, useCallback } from "react";
import { useOrders } from "@/hooks/useOrders";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Truck } from "lucide-react";

// Leaflet interfaces for type safety
interface LeafletModule {
  map: (element: HTMLElement) => LeafletMapInstance;
  tileLayer: (url: string, options: any) => LeafletLayer;
  marker: (coords: [number, number], options?: any) => LeafletMarker;
  icon: (options: any) => LeafletIcon;
  polyline: (coords: [number, number][], options?: any) => LeafletPolyline;
  featureGroup: (layers: any[]) => LeafletFeatureGroup;
}

interface LeafletMapInstance {
  remove: () => void;
  setView: (center: [number, number], zoom: number) => LeafletMapInstance;
  fitBounds: (bounds: any, options?: any) => void;
  removeLayer: (layer: any) => void;
}

interface LeafletMarker {
  addTo: (map: LeafletMapInstance) => LeafletMarker;
  bindPopup: (content: string) => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
}

interface LeafletLayer {
  addTo: (map: LeafletMapInstance) => LeafletLayer;
}

interface LeafletPolyline {
  addTo: (map: LeafletMapInstance) => LeafletPolyline;
}

interface LeafletFeatureGroup {
  getBounds: () => any;
}

interface LeafletIcon {}

// Simulated drone positions for live tracking (optimized)
const useDronePositions = () => {
  const [dronePositions, setDronePositions] = useState<Record<string, [number, number]>>({});
  const { data: orders } = useOrders();

  useEffect(() => {
    if (!orders?.length) return;

    const interval = setInterval(() => {
      const newPositions: Record<string, [number, number]> = {};
      const now = Date.now();
      
      orders.forEach(order => {
        if (order.status === 'in_flight') {
          const [pickupLat, pickupLon] = order.pickupCoords;
          const [dropoffLat, dropoffLon] = order.dropoffCoords;
          
          // Optimized progress calculation
          const progress = ((now % 60000) / 60000);
          const lat = pickupLat + (dropoffLat - pickupLat) * progress;
          const lon = pickupLon + (dropoffLon - pickupLon) * progress;
          
          newPositions[order.id] = [lat, lon];
        }
      });
      
      setDronePositions(newPositions);
    }, 2000);

    return () => clearInterval(interval);
  }, [orders]);

  return dronePositions;
};

const FastLeafletMap = () => {
  const { data: orders, isLoading } = useOrders();
  const dronePositions = useDronePositions();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markersRef = useRef<Record<string, any>>({});
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York City

  // Optimized Leaflet loading with caching
  const loadLeaflet = useCallback(async (): Promise<LeafletModule> => {
    if (leafletRef.current) return leafletRef.current;

    try {
      // Parallel loading of Leaflet module and CSS
      const [leafletModule] = await Promise.all([
        import('leaflet'),
        // CSS should already be preloaded from index.html
        typeof window !== 'undefined' && !document.querySelector('link[href*="leaflet.css"]') 
          ? import('leaflet/dist/leaflet.css') 
          : Promise.resolve()
      ]);

      // Optimize icon loading
      if (leafletModule.Icon.Default.prototype._getIconUrl) {
        delete (leafletModule.Icon.Default.prototype as any)._getIconUrl;
      }

      leafletModule.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      leafletRef.current = leafletModule as LeafletModule;
      return leafletRef.current;
    } catch (err) {
      console.error('Failed to load Leaflet:', err);
      throw err;
    }
  }, []);

  // Initialize map with optimizations
  useEffect(() => {
    let mounted = true;
    let initPromise: Promise<void> | null = null;

    const initializeMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      try {
        const L = await loadLeaflet();
        
        if (!mounted || mapRef.current) return;

        // Create map with optimized settings
        const map = L.map(mapContainerRef.current, {
          preferCanvas: true, // Use canvas for better performance
          zoomControl: true,
          attributionControl: true,
        }).setView(defaultCenter, 12);

        // Add tile layer with optimized settings
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
          tileSize: 256,
          zoomOffset: 0,
          // Performance optimizations
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 2,
        }).addTo(map);

        mapRef.current = map;
        setMapLoaded(true);

      } catch (err) {
        console.error('Error initializing map:', err);
        if (mounted) {
          setError('Failed to load map');
        }
      }
    };

    initPromise = initializeMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loadLeaflet]);

  // Optimized marker updates with debouncing
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !orders || !leafletRef.current) return;

    const updateMarkers = async () => {
      try {
        const L = leafletRef.current!;

        // Batch clear existing markers
        const markersToRemove = Object.values(markersRef.current);
        markersToRemove.forEach(marker => {
          try {
            mapRef.current?.removeLayer(marker);
          } catch (e) {
            // Ignore errors for already removed markers
          }
        });
        markersRef.current = {};

        // Pre-create icons (reuse for performance)
        const pickupIcon = L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const dropoffIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const droneIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        });

        const layers: any[] = [];

        // Batch create markers
        orders.forEach((order) => {
          // Pickup marker
          const pickupMarker = L.marker(order.pickupCoords, { icon: pickupIcon })
            .addTo(mapRef.current!)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600;">Pickup Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Order #${order.id.slice(0, 8)}</p>
                <span style="padding: 2px 6px; font-size: 11px; border-radius: 4px; ${getStatusInlineStyle(order.status)}">${order.status}</span>
              </div>
            `)
            .on('click', () => setSelectedOrder(order.id));

          // Dropoff marker
          const dropoffMarker = L.marker(order.dropoffCoords, { icon: dropoffIcon })
            .addTo(mapRef.current!)
            .bindPopup(`
              <div style="padding: 8px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600;">Dropoff Location</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Order #${order.id.slice(0, 8)}</p>
                <span style="padding: 2px 6px; font-size: 11px; border-radius: 4px; ${getStatusInlineStyle(order.status)}">${order.status}</span>
              </div>
            `)
            .on('click', () => setSelectedOrder(order.id));

          // Route line
          const routeLine = L.polyline([order.pickupCoords, order.dropoffCoords], {
            color: order.status === 'in_flight' ? '#22c55e' : '#6b7280',
            weight: order.status === 'in_flight' ? 4 : 2,
            opacity: order.status === 'in_flight' ? 0.8 : 0.5,
            dashArray: order.status === 'completed' ? '10, 10' : undefined
          }).addTo(mapRef.current!);

          layers.push(pickupMarker, dropoffMarker, routeLine);

          markersRef.current[`${order.id}-pickup`] = pickupMarker;
          markersRef.current[`${order.id}-dropoff`] = dropoffMarker;
          markersRef.current[`${order.id}-route`] = routeLine;

          // Live drone position
          if (dronePositions[order.id]) {
            const droneMarker = L.marker(dronePositions[order.id], { icon: droneIcon })
              .addTo(mapRef.current!)
              .bindPopup(`
                <div style="padding: 8px;">
                  <h3 style="margin: 0 0 4px 0; font-weight: 600;">Drone Position</h3>
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Order #${order.id.slice(0, 8)}</p>
                  <p style="margin: 0; font-size: 12px;">In Flight</p>
                </div>
              `);

            layers.push(droneMarker);
            markersRef.current[`${order.id}-drone`] = droneMarker;
          }
        });

        // Optimize bounds fitting
        if (orders.length > 0 && layers.length > 0) {
          try {
            const group = L.featureGroup(layers);
            mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
          } catch (e) {
            // Fallback to default view if bounds fitting fails
            mapRef.current.setView(defaultCenter, 12);
          }
        }

      } catch (err) {
        console.error('Error updating markers:', err);
      }
    };

    // Debounce marker updates
    const timeoutId = setTimeout(updateMarkers, 100);
    return () => clearTimeout(timeoutId);
  }, [orders, dronePositions, mapLoaded]);

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

  const getStatusInlineStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'background: #fef3c7; color: #92400e;';
      case 'scheduled': return 'background: #dbeafe; color: #1e40af;';
      case 'in_flight': return 'background: #d1fae5; color: #065f46;';
      case 'completed': return 'background: #f3f4f6; color: #374151;';
      case 'failed': return 'background: #fee2e2; color: #991b1b;';
      default: return 'background: #f3f4f6; color: #374151;';
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !mapLoaded) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="h-[600px] bg-muted/20 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <div className="text-lg font-medium">Loading Interactive Map</div>
                  <div className="text-sm text-muted-foreground">
                    {mapLoaded ? 'Loading orders...' : 'Initializing Leaflet map...'}
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
      {/* Interactive Map */}
      <div className="lg:col-span-3">
        <Card>
          <CardContent className="p-0">
            <div 
              ref={mapContainerRef}
              className="h-[600px] w-full rounded-lg"
              style={{ minHeight: '600px' }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Order List Sidebar - Same as before */}
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

export default FastLeafletMap;