import { useState } from "react";
import { motion } from "framer-motion";
import { OrderList } from "@/components/delivery/OrderList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Flight", value: "in_flight" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" }
];

export default function Orders() {
  const { data: orders = [], isLoading, error, refetch } = useOrders();
  const [activeFilter, setActiveFilter] = useState("all");

  const handleRefresh = async () => {
    await refetch();
  };

  const filteredOrders = orders.filter(order => 
    activeFilter === "all" || order.status === activeFilter
  );

  const getStatusCount = (status: string) => 
    status === "all" ? orders.length : orders.filter(order => order.status === status).length;

  return (
    <div className="container px-6 py-6 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Delivery Orders</h1>
            <p className="text-muted-foreground">
              Monitor and manage drone delivery missions in real-time
            </p>
          </div>
          
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-fit"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={activeFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(filter.value)}
                className="h-8"
              >
                {filter.label}
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-4 px-1 text-xs"
                >
                  {getStatusCount(filter.value)}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <OrderList orders={filteredOrders} isLoading={isLoading} error={error} />
      </motion.div>
    </div>
  );
}