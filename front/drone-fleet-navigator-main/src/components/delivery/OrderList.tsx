import { motion, AnimatePresence } from "framer-motion";
import { OrderCard, type DeliveryOrder } from "./OrderCard";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderListProps {
  orders?: DeliveryOrder[];
  isLoading?: boolean;
  error?: Error | null;
}

const LoadingSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="space-y-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-16 text-center"
  >
    <div className="text-6xl mb-4">🚁</div>
    <h3 className="text-xl font-semibold text-foreground mb-2">No Orders Yet</h3>
    <p className="text-muted-foreground max-w-md">
      Mission queue is empty. New drone delivery orders will appear here as they come in.
    </p>
  </motion.div>
);

export function OrderList({ orders = [], isLoading = false, error = null }: OrderListProps) {

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <div className="text-destructive mb-2">Error loading orders</div>
        <p className="text-muted-foreground text-sm">{error.message}</p>
      </motion.div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState />;
  }

  return (
    <motion.div 
      layout
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <AnimatePresence mode="popLayout">
        {orders.map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              delay: index * 0.05,
              duration: 0.3,
              ease: "easeOut"
            }}
          >
            <OrderCard order={order} index={index} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}