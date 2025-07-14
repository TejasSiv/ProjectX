-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'scheduled', 'in_flight', 'completed', 'failed');

-- Create orders table
CREATE TABLE public.orders (
  id TEXT NOT NULL PRIMARY KEY,
  customer_id TEXT NOT NULL,
  pickup_coords NUMERIC[] NOT NULL,
  dropoff_coords NUMERIC[] NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  estimated_time INTEGER
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read orders
CREATE POLICY "Anyone can view orders" 
ON public.orders 
FOR SELECT 
USING (true);

-- Create policy to allow authenticated users to insert orders
CREATE POLICY "Authenticated users can create orders" 
ON public.orders 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create policy to allow authenticated users to update orders
CREATE POLICY "Authenticated users can update orders" 
ON public.orders 
FOR UPDATE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.orders (id, customer_id, pickup_coords, dropoff_coords, status, created_at, estimated_time) VALUES
('DRN-2024-001', 'USR-4521', '{37.7749, -122.4194}', '{37.7849, -122.4094}', 'in_flight', now() - interval '15 minutes', 8),
('DRN-2024-002', 'USR-7832', '{37.7649, -122.4294}', '{37.7949, -122.3994}', 'scheduled', now() - interval '5 minutes', 12),
('DRN-2024-003', 'USR-2341', '{37.7549, -122.4394}', '{37.7749, -122.4194}', 'pending', now() - interval '2 minutes', null),
('DRN-2024-004', 'USR-9876', '{37.7749, -122.4194}', '{37.7849, -122.4094}', 'completed', now() - interval '45 minutes', null),
('DRN-2024-005', 'USR-5555', '{37.7449, -122.4494}', '{37.7649, -122.4294}', 'failed', now() - interval '30 minutes', null);