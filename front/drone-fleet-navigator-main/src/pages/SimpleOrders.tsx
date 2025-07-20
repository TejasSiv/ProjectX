import { useOrders } from "@/hooks/useOrders";

export default function SimpleOrders() {
  const { data: orders = [], isLoading, error } = useOrders();

  console.log('Orders data:', orders);
  console.log('Loading:', isLoading);
  console.log('Error:', error);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'white', 
      color: 'black', 
      minHeight: '100vh' 
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        Orders Debug Page
      </h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
        <p><strong>Error:</strong> {error ? error.message : 'None'}</p>
        <p><strong>Orders Count:</strong> {orders.length}</p>
      </div>

      {isLoading && (
        <div style={{ padding: '20px', backgroundColor: '#e3f2fd' }}>
          Loading orders...
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', backgroundColor: '#ffebee' }}>
          Error: {error.message}
        </div>
      )}

      {orders.length === 0 && !isLoading && !error && (
        <div style={{ padding: '20px', backgroundColor: '#fff3e0' }}>
          No orders found
        </div>
      )}

      {orders.length > 0 && (
        <div>
          <h2>Orders ({orders.length}):</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {orders.slice(0, 5).map((order, index) => (
              <li key={order.id || index} style={{ 
                marginBottom: '10px', 
                padding: '10px', 
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}>
                <div><strong>ID:</strong> {order.id}</div>
                <div><strong>Customer:</strong> {order.customerId}</div>
                <div><strong>Status:</strong> {order.status}</div>
                <div><strong>Created:</strong> {order.createdAt}</div>
              </li>
            ))}
          </ul>
          {orders.length > 5 && <p>... and {orders.length - 5} more orders</p>}
        </div>
      )}
    </div>
  );
}