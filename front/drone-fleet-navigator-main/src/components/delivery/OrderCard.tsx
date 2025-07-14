import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, User } from "lucide-react";

export interface DeliveryOrder {
  id: string;
  customerId: string;
  pickupCoords: [number, number];
  dropoffCoords: [number, number];
  status: "pending" | "scheduled" | "in_flight" | "completed" | "failed";
  createdAt: string;
  estimatedTime?: number;
}

interface OrderCardProps {
  order: DeliveryOrder;
  index: number;
}

const formatCoords = (coords: [number, number]) => 
  `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function OrderCard({ order, index }: OrderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="group"
    >
      <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-glow/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <h3 className="font-mono text-sm font-medium text-foreground">
                Order #{order.id}
              </h3>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{order.customerId}</span>
              </div>
            </div>
            <Badge variant={order.status}>
              {order.status.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-muted-foreground">Pickup:</span>
                    <span className="ml-1 font-mono text-foreground">
                      {formatCoords(order.pickupCoords)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dropoff:</span>
                    <span className="ml-1 font-mono text-foreground">
                      {formatCoords(order.dropoffCoords)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatTime(order.createdAt)}</span>
              </div>
              
              {order.estimatedTime && (
                <span className="text-muted-foreground">
                  ETA: {order.estimatedTime}min
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}