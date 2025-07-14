import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Package, Clock, Calculator } from "lucide-react";
import { useCreateOrder } from "@/hooks/useBackendAPI";
import { useToast } from "@/hooks/use-toast";

const orderSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required").regex(/^USR-\d+$/, "Customer ID must be in format USR-XXXX"),
  pickupLat: z.number().min(-90).max(90),
  pickupLon: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLon: z.number().min(-180).max(180),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface CreateOrderDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateOrderDialog({ trigger, onSuccess }: CreateOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);

  const { toast } = useToast();
  const createOrderMutation = useCreateOrder();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: "",
      pickupLat: 37.7749,
      pickupLon: -122.4194,
      dropoffLat: 37.7849,
      dropoffLon: -122.4094,
    },
  });

  const watchedValues = form.watch();

  // Calculate estimated distance and time
  const calculateEstimates = (pickup: [number, number], dropoff: [number, number]) => {
    const [lat1, lon1] = pickup;
    const [lat2, lon2] = dropoff;
    
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Estimate flight time (30 km/h average + 5 min for takeoff/landing)
    const flightTime = (distance / 30) * 60 + 5;
    
    setEstimatedDistance(distance);
    setEstimatedTime(Math.max(10, flightTime));
  };

  // Update estimates when coordinates change
  React.useEffect(() => {
    if (watchedValues.pickupLat && watchedValues.pickupLon && 
        watchedValues.dropoffLat && watchedValues.dropoffLon) {
      calculateEstimates(
        [watchedValues.pickupLat, watchedValues.pickupLon],
        [watchedValues.dropoffLat, watchedValues.dropoffLon]
      );
    }
  }, [watchedValues.pickupLat, watchedValues.pickupLon, watchedValues.dropoffLat, watchedValues.dropoffLon]);

  const onSubmit = async (data: OrderFormData) => {
    try {
      await createOrderMutation.mutateAsync({
        customer_id: data.customerId,
        pickup_coords: [data.pickupLat, data.pickupLon],
        dropoff_coords: [data.dropoffLat, data.dropoffLon],
      });

      toast({
        title: "Order Created Successfully",
        description: `Order for customer ${data.customerId} has been submitted for processing.`,
      });

      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Failed to Create Order",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const CoordinateInput = ({ 
    label, 
    latField, 
    lonField, 
    icon: Icon,
    description 
  }: {
    label: string;
    latField: "pickupLat" | "dropoffLat";
    lonField: "pickupLon" | "dropoffLon";
    icon: any;
    description: string;
  }) => (
    <Card className="p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="font-medium">{label}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={latField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Latitude</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="37.7749"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={lonField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Longitude</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="-122.4194"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{description}</p>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Create New Order</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Delivery Order</DialogTitle>
          <DialogDescription>
            Set up a new drone delivery mission by specifying pickup and dropoff coordinates.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Customer Information</h3>
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer ID</FormLabel>
                    <FormControl>
                      <Input placeholder="USR-1234" {...field} />
                    </FormControl>
                    <FormDescription>
                      Customer identifier in format USR-XXXX
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Delivery Locations</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CoordinateInput
                  label="Pickup Location"
                  latField="pickupLat"
                  lonField="pickupLon"
                  icon={MapPin}
                  description="Where the drone will collect the package"
                />
                <CoordinateInput
                  label="Dropoff Location"
                  latField="dropoffLat"
                  lonField="dropoffLon"
                  icon={Package}
                  description="Where the drone will deliver the package"
                />
              </div>
            </div>

            {/* Mission Estimates */}
            {estimatedDistance !== null && estimatedTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Separator />
                <h3 className="text-lg font-medium flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Mission Estimates</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Distance</span>
                    </div>
                    <div className="text-2xl font-bold">{estimatedDistance.toFixed(2)} km</div>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Est. Flight Time</span>
                    </div>
                    <div className="text-2xl font-bold">{Math.round(estimatedTime)} min</div>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Package className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Priority</span>
                    </div>
                    <Badge variant="secondary">Standard</Badge>
                  </Card>
                </div>
              </motion.div>
            )}

            <DialogFooter className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createOrderMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrderMutation.isPending}
                className="flex items-center space-x-2"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    <span>Create Order</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}