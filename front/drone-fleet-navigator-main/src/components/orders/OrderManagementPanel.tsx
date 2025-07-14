import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  MoreHorizontal, 
  Search, 
  Filter,
  Play,
  Pause,
  Square,
  Trash2,
  Edit,
  Eye,
  MapPin,
  Clock,
  User
} from "lucide-react";
import { useBackendOrders, useUpdateOrderStatus } from "@/hooks/useBackendAPI";
import { useToast } from "@/hooks/use-toast";
import { CreateOrderDialog } from "./CreateOrderDialog";

interface OrderAction {
  orderId: string;
  action: "start" | "pause" | "abort" | "delete";
}

export function OrderManagementPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null);

  const { data: ordersData, isLoading, refetch } = useBackendOrders();
  const updateStatusMutation = useUpdateOrderStatus();
  const { toast } = useToast();

  const orders = ordersData?.orders || [];

  // Filter orders based on search and status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === "" || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleOrderAction = async (orderId: string, action: string) => {
    try {
      let newStatus = "";
      let actionDescription = "";

      switch (action) {
        case "start":
          newStatus = "scheduled";
          actionDescription = "started";
          break;
        case "pause":
          newStatus = "pending";
          actionDescription = "paused";
          break;
        case "abort":
          newStatus = "failed";
          actionDescription = "aborted";
          break;
        default:
          return;
      }

      await updateStatusMutation.mutateAsync({ orderId, status: newStatus });
      
      toast({
        title: "Order Updated",
        description: `Order ${orderId} has been ${actionDescription}.`,
      });

      setPendingAction(null);
    } catch (error) {
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Failed to update order status.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "scheduled": return "default";
      case "in_flight": return "default";
      case "completed": return "default";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  const getAvailableActions = (status: string) => {
    switch (status) {
      case "pending":
        return [{ action: "start", label: "Start Mission", icon: Play }];
      case "scheduled":
      case "in_flight":
        return [
          { action: "pause", label: "Pause Mission", icon: Pause },
          { action: "abort", label: "Abort Mission", icon: Square }
        ];
      default:
        return [];
    }
  };

  const formatCoordinates = (coords: number[]) => {
    if (!coords || coords.length !== 2) return "Invalid coordinates";
    return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const OrderCard = ({ order, index }: { order: any; index: number }) => {
    const availableActions = getAvailableActions(order.status);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-mono text-sm font-medium">{order.id}</h3>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{order.customer_id}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Order
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableActions.map(({ action, label, icon: Icon }) => (
                    <DropdownMenuItem
                      key={action}
                      onClick={() => setPendingAction({ orderId: order.id, action: action as any })}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                  {availableActions.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setPendingAction({ orderId: order.id, action: "delete" })}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-3">
              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  <div>
                    <div className="text-muted-foreground">Pickup:</div>
                    <div className="font-mono">{formatCoordinates(order.pickup_coords)}</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                  <div>
                    <div className="text-muted-foreground">Dropoff:</div>
                    <div className="font-mono">{formatCoordinates(order.dropoff_coords)}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(order.created_at)}</span>
                </div>
                {order.estimated_time && (
                  <span>ETA: {order.estimated_time}min</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Management</CardTitle>
            <CreateOrderDialog onSuccess={() => refetch()} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Status: {statusFilter === "all" ? "All" : statusFilter}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("scheduled")}>Scheduled</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("in_flight")}>In Flight</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("completed")}>Completed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("failed")}>Failed</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredOrders.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium mb-2">No orders found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {searchTerm || statusFilter !== "all" 
                ? "No orders match your current filters. Try adjusting your search criteria."
                : "No orders have been created yet. Create your first delivery order to get started."
              }
            </p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <OrderCard key={order.id} order={order} index={index} />
          ))
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={!!pendingAction} 
        onOpenChange={() => setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {pendingAction?.action === "delete" ? "Delete" : "Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "delete" 
                ? `Are you sure you want to delete order ${pendingAction.orderId}? This action cannot be undone.`
                : `Are you sure you want to ${pendingAction?.action} order ${pendingAction?.orderId}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAction) {
                  handleOrderAction(pendingAction.orderId, pendingAction.action);
                }
              }}
              className={pendingAction?.action === "delete" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}