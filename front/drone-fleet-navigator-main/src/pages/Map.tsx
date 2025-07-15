import { motion } from "framer-motion";
import SimpleMap from "@/components/map/SimpleMap";

export default function Map() {
  return (
    <div className="container px-6 py-6 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Map</h1>
          <p className="text-muted-foreground">
            Real-time tracking of drone positions and delivery routes
          </p>
        </div>

        <SimpleMap />
      </motion.div>
    </div>
  );
}