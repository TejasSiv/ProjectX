import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Navigation } from "@/components/layout/Navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Orders from "./pages/Orders";
import SimpleOrders from "./pages/SimpleOrders";
import SimpleOrdersDisplay from "./pages/SimpleOrdersDisplay";
import SafeOrders from "./pages/SafeOrders";
import MinimalTest from "./pages/MinimalTest";
import Map from "./pages/Map";
import Logs from "./pages/Logs";
import NotFound from "./pages/NotFound";
import Debug from "./pages/Debug";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <Navigation />
            <main className="min-h-[calc(100vh-8rem)]">
              <Routes>
                <Route path="/" element={<Orders />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/safe" element={<SafeOrders />} />
                <Route path="/minimal" element={<MinimalTest />} />
                <Route path="/simple" element={<SimpleOrders />} />
                <Route path="/debug" element={<Debug />} />
                <Route path="/map" element={<Map />} />
                <Route path="/logs" element={<Logs />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
