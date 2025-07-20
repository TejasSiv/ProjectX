import { useState, useEffect } from "react";

export default function SafeOrders() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching orders data...');
        
        // Test direct Supabase connection first
        const SUPABASE_URL = "https://liswqdeiydvouikhuuwf.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw";
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&limit=5`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const orders = await response.json();
        console.log('Orders fetched:', orders);
        setData(orders);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Catch any render errors
  try {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white', 
        color: 'black', 
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
          🚁 Safe Orders Debug Page
        </h1>
        
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
          <p><strong>Status:</strong></p>
          <p>Loading: {loading ? 'Yes' : 'No'}</p>
          <p>Error: {error || 'None'}</p>
          <p>Data Count: {data ? data.length : 'N/A'}</p>
          <p>Current Time: {new Date().toLocaleString()}</p>
        </div>

        {loading && (
          <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
            🔄 Loading orders from Supabase...
          </div>
        )}

        {error && (
          <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '5px' }}>
            ❌ Error: {error}
          </div>
        )}

        {data && data.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h2>✅ Found {data.length} Orders:</h2>
            <div style={{ backgroundColor: '#e8f5e8', padding: '15px', borderRadius: '5px' }}>
              {data.map((order: any, index: number) => (
                <div key={index} style={{ 
                  marginBottom: '10px', 
                  padding: '10px', 
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '3px'
                }}>
                  <div><strong>ID:</strong> {order.id}</div>
                  <div><strong>Customer:</strong> {order.customer_id}</div>
                  <div><strong>Status:</strong> {order.status}</div>
                  <div><strong>Priority:</strong> {order.priority}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && data.length === 0 && !loading && (
          <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '5px' }}>
            ⚠️ No orders found in database
          </div>
        )}
      </div>
    );
  } catch (renderError: any) {
    console.error('Render error:', renderError);
    return (
      <div style={{ padding: '20px', backgroundColor: 'red', color: 'white' }}>
        💥 Render Error: {renderError.message}
      </div>
    );
  }
}