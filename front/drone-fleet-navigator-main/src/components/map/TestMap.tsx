import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

const TestMap = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    let mounted = true;

    const testLeaflet = async () => {
      addLog("🚀 Starting Leaflet test...");
      
      try {
        // Check if container exists
        if (!mapContainerRef.current) {
          addLog("❌ Map container not found");
          return;
        }
        addLog("✅ Map container found");

        // Test dynamic import
        addLog("📦 Importing Leaflet...");
        const startTime = Date.now();
        
        const L = await import('leaflet');
        addLog(`✅ Leaflet imported in ${Date.now() - startTime}ms`);
        
        // Test CSS import
        addLog("🎨 Importing Leaflet CSS...");
        await import('leaflet/dist/leaflet.css');
        addLog("✅ Leaflet CSS imported");

        if (!mounted) {
          addLog("⚠️ Component unmounted during import");
          return;
        }

        // Fix icons
        addLog("🔧 Fixing Leaflet icons...");
        try {
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          });
          addLog("✅ Icons fixed");
        } catch (iconError) {
          addLog(`⚠️ Icon fix error: ${iconError}`);
        }

        // Create map
        addLog("🗺️ Creating map instance...");
        try {
          const map = L.map(mapContainerRef.current, {
            center: [40.7128, -74.0060],
            zoom: 12
          });
          addLog("✅ Map instance created");

          // Add tiles
          addLog("🌍 Adding tile layer...");
          const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          });
          
          tileLayer.addTo(map);
          addLog("✅ Tile layer added");

          // Test marker
          addLog("📍 Adding test marker...");
          const marker = L.marker([40.7128, -74.0060]).addTo(map);
          marker.bindPopup('Test marker - Map is working!').openPopup();
          addLog("✅ Test marker added");

          mapRef.current = map;
          setMapReady(true);
          addLog("🎉 Map initialization complete!");

        } catch (mapError) {
          addLog(`❌ Map creation error: ${mapError}`);
          setError(`Map creation failed: ${mapError}`);
        }

      } catch (err) {
        addLog(`❌ Import error: ${err}`);
        setError(`Failed to import Leaflet: ${err}`);
      }
    };

    // Add a small delay to ensure DOM is ready
    setTimeout(testLeaflet, 100);

    return () => {
      mounted = false;
      if (mapRef.current) {
        try {
          addLog("🧹 Cleaning up map...");
          mapRef.current.remove();
          mapRef.current = null;
        } catch (e) {
          addLog(`⚠️ Cleanup error: ${e}`);
        }
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Map Container */}
      <div className="lg:col-span-3">
        <Card>
          <CardContent className="p-0">
            <div 
              ref={mapContainerRef}
              className="h-[600px] w-full rounded-lg border-2 border-dashed border-blue-300"
              style={{ 
                minHeight: '600px', 
                background: mapReady ? '#f0f0f0' : '#ffeeee',
                position: 'relative'
              }}
            >
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold mb-2">
                      {error ? '❌ Error' : '⏳ Initializing...'}
                    </div>
                    {error && (
                      <div className="text-red-600 text-sm mb-4">{error}</div>
                    )}
                    <div className="text-sm text-gray-600">
                      Check the logs panel →
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Panel */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold mb-3">🔍 Debug Logs</h3>
            <div className="text-xs font-mono space-y-1 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">Waiting for logs...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="py-1 border-b border-gray-100">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold mb-3">📊 Status</h3>
            <div className="space-y-2 text-sm">
              <div>Map Ready: {mapReady ? '✅' : '❌'}</div>
              <div>Error: {error ? '❌' : '✅'}</div>
              <div>Container: {mapContainerRef.current ? '✅' : '❌'}</div>
              <div>Logs: {logs.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold mb-3">🛠️ Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setLogs([]);
                  setError(null);
                  setMapReady(false);
                }}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm"
              >
                Clear Logs
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm"
              >
                Reload Page
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold mb-3">ℹ️ Info</h3>
            <div className="text-xs space-y-1">
              <div>Browser: {navigator.userAgent.split(' ')[0]}</div>
              <div>Window: {typeof window !== 'undefined' ? '✅' : '❌'}</div>
              <div>React: Available</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestMap;