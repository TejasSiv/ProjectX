import { useOrders } from "@/hooks/useOrders";

export default function SimpleOrdersDisplay() {
  const { data: orders = [], isLoading, error, refetch } = useOrders();

  return (
    <div className="container px-6 py-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Delivery Orders ({orders.length})
            </h1>
            <p className="text-gray-400">
              Monitor and manage drone delivery missions in real-time
            </p>
          </div>
          
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isLoading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>

        {/* Status */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-white">
            <strong>Status:</strong> {isLoading ? 'Loading' : 'Ready'} | 
            <strong> Orders:</strong> {orders.length} | 
            <strong> Error:</strong> {error ? 'Yes' : 'None'}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {error.message}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="bg-blue-900 border border-blue-700 text-blue-100 px-4 py-3 rounded-lg">
            🔄 Loading orders...
          </div>
        )}

        {/* Orders Grid */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-gray-600 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="text-white font-medium truncate">
                      Order #{order.id.slice(0, 8)}...
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      order.status === 'pending' ? 'bg-yellow-900 text-yellow-100' :
                      order.status === 'scheduled' ? 'bg-blue-900 text-blue-100' :
                      order.status === 'in_flight' ? 'bg-green-900 text-green-100' :
                      order.status === 'completed' ? 'bg-emerald-900 text-emerald-100' :
                      'bg-red-900 text-red-100'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="text-gray-300 text-sm">
                    <p><strong>Customer:</strong> {order.customerId}</p>
                    <p><strong>Pickup:</strong> {order.pickupCoords?.[0]?.toFixed(4)}, {order.pickupCoords?.[1]?.toFixed(4)}</p>
                    <p><strong>Dropoff:</strong> {order.dropoffCoords?.[0]?.toFixed(4)}, {order.dropoffCoords?.[1]?.toFixed(4)}</p>
                    {order.estimatedTime && (
                      <p><strong>Est. Time:</strong> {order.estimatedTime} min</p>
                    )}
                    <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Orders */}
        {orders.length === 0 && !isLoading && !error && (
          <div className="bg-gray-800 border border-gray-700 text-gray-300 px-4 py-8 rounded-lg text-center">
            <p>No orders found</p>
          </div>
        )}
      </div>
    </div>
  );
}