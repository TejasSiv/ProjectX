import { useOrders } from "@/hooks/useOrders";

export default function Debug() {
  const { data: orders = [], isLoading, error, refetch } = useOrders();

  return (
    <div className="container px-6 py-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              🚁 Drone Delivery Orders ({orders.length})
            </h1>
            <p className="text-gray-400">
              Real-time drone delivery mission control and monitoring
            </p>
          </div>
          
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {isLoading ? '🔄 Loading...' : '↻ Refresh Data'}
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-300">
              <strong className="text-white">Status:</strong> {isLoading ? 'Loading' : 'Ready'}
            </span>
            <span className="text-gray-300">
              <strong className="text-white">Total Orders:</strong> {orders.length}
            </span>
            <span className="text-gray-300">
              <strong className="text-white">Error:</strong> {error ? 'Yes' : 'None'}
            </span>
            <span className="text-gray-300">
              <strong className="text-white">Last Updated:</strong> {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
            <strong>❌ Error:</strong> {error.message}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="bg-blue-900/50 border border-blue-700 text-blue-100 px-4 py-3 rounded-lg">
            🔄 Loading orders from database...
          </div>
        )}

        {/* Status Summary */}
        {orders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {['pending', 'scheduled', 'in_flight', 'completed', 'failed'].map(status => {
              const count = orders.filter(o => o.status === status).length;
              const colors = {
                pending: 'bg-yellow-900/50 border-yellow-700 text-yellow-100',
                scheduled: 'bg-blue-900/50 border-blue-700 text-blue-100',
                in_flight: 'bg-green-900/50 border-green-700 text-green-100',
                completed: 'bg-emerald-900/50 border-emerald-700 text-emerald-100',
                failed: 'bg-red-900/50 border-red-700 text-red-100'
              };
              return (
                <div key={status} className={`p-3 rounded-lg border ${colors[status]}`}>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs uppercase tracking-wide">{status.replace('_', ' ')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Orders Grid */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className="bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-gray-600 transition-all duration-200 hover:shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-white font-medium text-sm">
                      #{order.id.slice(0, 8)}...
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      order.status === 'pending' ? 'bg-yellow-900 text-yellow-100' :
                      order.status === 'scheduled' ? 'bg-blue-900 text-blue-100' :
                      order.status === 'in_flight' ? 'bg-green-900 text-green-100' :
                      order.status === 'completed' ? 'bg-emerald-900 text-emerald-100' :
                      'bg-red-900 text-red-100'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="text-gray-300 text-xs space-y-1">
                    <p><strong>Customer:</strong> {order.customerId}</p>
                    <p><strong>Pickup:</strong> {order.pickupCoords?.[0]?.toFixed(4)}, {order.pickupCoords?.[1]?.toFixed(4)}</p>
                    <p><strong>Dropoff:</strong> {order.dropoffCoords?.[0]?.toFixed(4)}, {order.dropoffCoords?.[1]?.toFixed(4)}</p>
                    {order.estimatedTime && (
                      <p><strong>Est. Time:</strong> {order.estimatedTime} min</p>
                    )}
                    <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {orders.length > 12 && (
          <div className="text-center text-gray-400 text-sm">
            ... and {orders.length - 12} more orders
          </div>
        )}

        {/* No Orders */}
        {orders.length === 0 && !isLoading && !error && (
          <div className="bg-gray-800 border border-gray-700 text-gray-300 px-4 py-8 rounded-lg text-center">
            <p>No orders found in database</p>
          </div>
        )}
      </div>
    </div>
  );
}