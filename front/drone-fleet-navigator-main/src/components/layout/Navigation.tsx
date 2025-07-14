import { Map, Package, FileText } from "lucide-react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Orders",
    href: "/",
    icon: Package,
    description: "Delivery dashboard"
  },
  {
    title: "Map",
    href: "/map",
    icon: Map,
    description: "Live tracking"
  },
  {
    title: "Logs",
    href: "/logs",
    icon: FileText,
    description: "System logs"
  }
];

export function Navigation() {
  return (
    <nav className="border-b border-border bg-card/50">
      <div className="container px-6">
        <div className="flex space-x-6">
          {navItems.map((item, index) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors hover:text-foreground relative",
                    isActive
                      ? "text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </div>
      </div>
    </nav>
  );
}