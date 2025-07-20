import { useState, useEffect } from "react";

export default function ErrorSafeDebug() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    console.log('Component mounted, render count:', renderCount + 1);
    setRenderCount(prev => prev + 1);
    
    const fetchOrders = async () => {
      try {
        console.log('Starting fetch...');
        const response = await fetch("https://liswqdeiydvouikhuuwf.supabase.co/rest/v1/orders?select=*&limit=3", {
          headers: {
            'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw",
            'Authorization': "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw",
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        setOrders(data);
        setError(null);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Error boundary in render
  try {
    console.log('Rendering with:', { ordersCount: orders.length, loading, error, renderCount });

    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        color: 'white',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1 style={{ color: '#00ff00', marginBottom: '20px' }}>
          🚁 ERROR SAFE DEBUG PAGE (Render #{renderCount})
        </h1>
        
        <div style={{
          backgroundColor: '#333',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
          border: '1px solid #555'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '10px' }}>Status</h3>
          <p>Loading: {loading ? 'YES' : 'NO'}</p>
          <p>Error: {error || 'NONE'}</p>
          <p>Orders: {orders?.length || 0}</p>
          <p>Render Count: {renderCount}</p>
          <p>Time: {new Date().toLocaleTimeString()}</p>
        </div>

        {loading && (
          <div style={{
            backgroundColor: '#004080',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            ⏳ Loading orders...
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#800000',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            ❌ Error: {error}
          </div>
        )}

        {orders && orders.length > 0 && (
          <div style={{
            backgroundColor: '#008000',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginBottom: '15px' }}>✅ SUCCESS - {orders.length} Orders Found</h3>
            
            {orders.map((order, index) => {
              try {
                return (
                  <div key={order?.id || index} style={{
                    backgroundColor: '#444',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '3px',
                    border: '1px solid #666'
                  }}>
                    <div>ID: {order?.id || 'N/A'}</div>
                    <div>Customer: {order?.customer_id || 'N/A'}</div>
                    <div>Status: {order?.status || 'N/A'}</div>
                    <div>Priority: {order?.priority || 'N/A'}</div>
                  </div>
                );
              } catch (orderError) {
                console.error('Error rendering order:', orderError);
                return (
                  <div key={index} style={{ backgroundColor: 'red', padding: '10px', margin: '5px 0' }}>
                    Error rendering order {index}
                  </div>
                );
              }
            })}
          </div>
        )}

        <div style={{
          backgroundColor: '#444',
          padding: '15px',
          borderRadius: '5px',
          marginTop: '20px'
        }}>
          <button 
            onClick={() => {
              console.log('Refresh clicked');
              window.location.reload();
            }}
            style={{
              backgroundColor: '#0066cc',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    );
  } catch (renderError: any) {
    console.error('RENDER ERROR:', renderError);
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'red',
        color: 'white',
        minHeight: '100vh'
      }}>
        <h1>💥 RENDER ERROR</h1>
        <p>Error: {renderError?.message || 'Unknown error'}</p>
        <p>Stack: {renderError?.stack || 'No stack trace'}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }
}