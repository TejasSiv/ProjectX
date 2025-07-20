import asyncio
import socket
from typing import Dict, List, Set, Optional
from dataclasses import dataclass

from ..core.config import settings
from ..core.logger import mission_logger


@dataclass
class PortConfig:
    """Configuration for a MAVLink port."""
    port: int
    is_available: bool = True
    assigned_drone_id: Optional[str] = None
    connection_type: str = "udp"  # udp, tcp, serial


class MAVLinkPortManager:
    """Manages MAVLink port allocation for multiple drones."""
    
    def __init__(self):
        self.ports: Dict[int, PortConfig] = {}
        self.drone_port_mapping: Dict[str, int] = {}  # drone_id -> port
        self.reserved_ports: Set[int] = set()
        
    def initialize_port_pool(self, base_port: int = None, count: int = None):
        """Initialize the pool of available MAVLink ports."""
        if base_port is None:
            base_port = settings.mavlink_base_port
        if count is None:
            count = settings.fleet_size
            
        mission_logger.info(f"Initializing MAVLink port pool with {count} ports starting from {base_port}")
        
        for i in range(count):
            port = base_port + i
            if self._is_port_available(port):
                self.ports[port] = PortConfig(port=port)
                mission_logger.info(f"Added port {port} to available pool")
            else:
                mission_logger.warning(f"Port {port} is not available, skipping")
                
        mission_logger.info(f"Initialized {len(self.ports)} ports for MAVLink communication")
        
    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available for binding."""
        try:
            # Try to bind to the port to check availability
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.bind(('localhost', port))
                return True
        except OSError:
            return False
            
    def allocate_port(self, drone_id: str) -> Optional[int]:
        """Allocate a port for a specific drone."""
        # Check if drone already has a port
        if drone_id in self.drone_port_mapping:
            port = self.drone_port_mapping[drone_id]
            mission_logger.info(f"Drone {drone_id} already has port {port}")
            return port
            
        # Find an available port
        for port, config in self.ports.items():
            if config.is_available and port not in self.reserved_ports:
                config.is_available = False
                config.assigned_drone_id = drone_id
                self.drone_port_mapping[drone_id] = port
                
                mission_logger.info(f"Allocated port {port} to drone {drone_id}")
                return port
                
        mission_logger.error(f"No available ports for drone {drone_id}")
        return None
        
    def release_port(self, drone_id: str) -> bool:
        """Release a port from a drone."""
        if drone_id not in self.drone_port_mapping:
            mission_logger.warning(f"Drone {drone_id} does not have an allocated port")
            return False
            
        port = self.drone_port_mapping[drone_id]
        config = self.ports.get(port)
        
        if config:
            config.is_available = True
            config.assigned_drone_id = None
            del self.drone_port_mapping[drone_id]
            
            mission_logger.info(f"Released port {port} from drone {drone_id}")
            return True
        else:
            mission_logger.error(f"Port configuration not found for port {port}")
            return False
            
    def get_port_for_drone(self, drone_id: str) -> Optional[int]:
        """Get the port allocated to a specific drone."""
        return self.drone_port_mapping.get(drone_id)
        
    def reserve_port(self, port: int) -> bool:
        """Reserve a port to prevent allocation."""
        if port in self.ports:
            self.reserved_ports.add(port)
            mission_logger.info(f"Reserved port {port}")
            return True
        else:
            mission_logger.warning(f"Cannot reserve port {port} - not in port pool")
            return False
            
    def unreserve_port(self, port: int) -> bool:
        """Remove port reservation."""
        if port in self.reserved_ports:
            self.reserved_ports.remove(port)
            mission_logger.info(f"Unreserved port {port}")
            return True
        else:
            mission_logger.warning(f"Port {port} was not reserved")
            return False
            
    def get_available_ports(self) -> List[int]:
        """Get list of available ports."""
        return [
            port for port, config in self.ports.items()
            if config.is_available and port not in self.reserved_ports
        ]
        
    def get_allocated_ports(self) -> Dict[str, int]:
        """Get mapping of drone IDs to allocated ports."""
        return self.drone_port_mapping.copy()
        
    def get_port_status(self) -> Dict[int, Dict]:
        """Get status of all ports."""
        status = {}
        for port, config in self.ports.items():
            status[port] = {
                "is_available": config.is_available,
                "assigned_drone_id": config.assigned_drone_id,
                "is_reserved": port in self.reserved_ports,
                "connection_type": config.connection_type
            }
        return status
        
    def create_system_address(self, port: int, connection_type: str = "udp") -> str:
        """Create a system address string for MAVSDK connection."""
        if connection_type.lower() == "udp":
            return f"udp://:{port}"
        elif connection_type.lower() == "tcp":
            return f"tcp://:{port}"
        else:
            mission_logger.warning(f"Unknown connection type: {connection_type}, defaulting to UDP")
            return f"udp://:{port}"
            
    def validate_port_assignments(self) -> List[str]:
        """Validate all port assignments and return any issues."""
        issues = []
        
        # Check for duplicate assignments
        assigned_ports = {}
        for drone_id, port in self.drone_port_mapping.items():
            if port in assigned_ports:
                issues.append(f"Port {port} is assigned to multiple drones: {drone_id} and {assigned_ports[port]}")
            else:
                assigned_ports[port] = drone_id
                
        # Check if assigned ports are marked as unavailable
        for drone_id, port in self.drone_port_mapping.items():
            config = self.ports.get(port)
            if config and config.is_available:
                issues.append(f"Port {port} assigned to drone {drone_id} is marked as available")
                
        # Check if unavailable ports have proper drone assignments
        for port, config in self.ports.items():
            if not config.is_available and config.assigned_drone_id not in self.drone_port_mapping:
                issues.append(f"Port {port} is marked unavailable but not properly assigned")
                
        return issues
        
    def auto_fix_port_assignments(self):
        """Automatically fix any port assignment issues."""
        issues = self.validate_port_assignments()
        if not issues:
            mission_logger.info("No port assignment issues found")
            return
            
        mission_logger.warning(f"Found {len(issues)} port assignment issues, attempting to fix...")
        
        # Reset all assignments and reallocate
        self._reset_all_assignments()
        
        # Reallocate ports for drones that had them
        drones_to_reallocate = list(self.drone_port_mapping.keys())
        self.drone_port_mapping.clear()
        
        for drone_id in drones_to_reallocate:
            new_port = self.allocate_port(drone_id)
            if new_port:
                mission_logger.info(f"Reallocated port {new_port} to drone {drone_id}")
            else:
                mission_logger.error(f"Failed to reallocate port for drone {drone_id}")
                
    def _reset_all_assignments(self):
        """Reset all port assignments."""
        for config in self.ports.values():
            config.is_available = True
            config.assigned_drone_id = None
            
        mission_logger.info("Reset all port assignments")
        
    def get_next_available_port_sequence(self, count: int) -> List[int]:
        """Get a sequence of consecutive available ports."""
        available_ports = self.get_available_ports()
        available_ports.sort()
        
        # Find consecutive sequence
        for i in range(len(available_ports) - count + 1):
            sequence = available_ports[i:i+count]
            if len(sequence) == count:
                # Check if they are consecutive
                if sequence[-1] - sequence[0] == count - 1:
                    return sequence
                    
        return []
        
    def bulk_allocate_ports(self, drone_ids: List[str]) -> Dict[str, Optional[int]]:
        """Allocate ports for multiple drones at once."""
        allocation_result = {}
        
        for drone_id in drone_ids:
            port = self.allocate_port(drone_id)
            allocation_result[drone_id] = port
            
        return allocation_result
        
    def get_statistics(self) -> Dict:
        """Get port manager statistics."""
        total_ports = len(self.ports)
        available_ports = len(self.get_available_ports())
        allocated_ports = len(self.drone_port_mapping)
        reserved_ports = len(self.reserved_ports)
        
        return {
            "total_ports": total_ports,
            "available_ports": available_ports,
            "allocated_ports": allocated_ports,
            "reserved_ports": reserved_ports,
            "utilization_percentage": (allocated_ports / total_ports * 100) if total_ports > 0 else 0
        }


# Global port manager instance
port_manager = MAVLinkPortManager()