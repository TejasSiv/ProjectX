import { motion } from "framer-motion";

export default function Logs() {
  return (
    <div className="container px-6 py-6 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground">
            Real-time system events and debugging information
          </p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="text-muted-foreground">
            System logs will be implemented here
          </div>
        </div>
      </motion.div>
    </div>
  );
}