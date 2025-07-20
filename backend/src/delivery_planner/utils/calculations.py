import math
from typing import Tuple
from ..models.orders import Coordinates

def calculate_distance(coord1: Coordinates, coord2: Coordinates) -> float:
    """Calculate distance between two coordinates using Haversine formula
    
    Args:
        coord1: First coordinate
        coord2: Second coordinate
        
    Returns:
        Distance in kilometers
    """
    # Convert latitude and longitude from degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [coord1.lat, coord1.lng, coord2.lat, coord2.lng])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    return c * r

def calculate_bearing(coord1: Coordinates, coord2: Coordinates) -> float:
    """Calculate bearing from coord1 to coord2
    
    Args:
        coord1: Starting coordinate
        coord2: Destination coordinate
        
    Returns:
        Bearing in degrees (0-360)
    """
    lat1, lon1, lat2, lon2 = map(math.radians, [coord1.lat, coord1.lng, coord2.lat, coord2.lng])
    
    dlon = lon2 - lon1
    
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    
    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    
    # Normalize to 0-360 degrees
    return (bearing_deg + 360) % 360

def estimate_flight_time(distance_km: float, speed_mps: float = 15.0, buffer_minutes: float = 2.0) -> int:
    """Estimate flight time based on distance and speed
    
    Args:
        distance_km: Distance in kilometers
        speed_mps: Speed in meters per second
        buffer_minutes: Additional buffer time in minutes
        
    Returns:
        Estimated time in minutes
    """
    distance_m = distance_km * 1000
    time_seconds = distance_m / speed_mps
    time_minutes = time_seconds / 60
    
    # Add buffer time for takeoff, landing, and maneuvering
    total_time = time_minutes + buffer_minutes
    
    return max(1, int(total_time))

def calculate_waypoint_eta(
    current_coord: Coordinates,
    target_coord: Coordinates, 
    speed_mps: float = 15.0
) -> float:
    """Calculate ETA to reach a waypoint
    
    Args:
        current_coord: Current position
        target_coord: Target waypoint
        speed_mps: Travel speed in m/s
        
    Returns:
        ETA in minutes
    """
    distance_km = calculate_distance(current_coord, target_coord)
    return estimate_flight_time(distance_km, speed_mps, buffer_minutes=0.0)

def calculate_service_area_bounds(
    center: Coordinates,
    radius_km: float
) -> Tuple[Coordinates, Coordinates]:
    """Calculate bounding box for service area
    
    Args:
        center: Center coordinate
        radius_km: Radius in kilometers
        
    Returns:
        Tuple of (southwest_bound, northeast_bound)
    """
    # Rough conversion: 1 degree ≈ 111 km
    lat_offset = radius_km / 111.0
    lng_offset = radius_km / (111.0 * math.cos(math.radians(center.lat)))
    
    southwest = Coordinates(
        lat=center.lat - lat_offset,
        lng=center.lng - lng_offset
    )
    
    northeast = Coordinates(
        lat=center.lat + lat_offset,
        lng=center.lng + lng_offset
    )
    
    return southwest, northeast

def is_coordinate_in_service_area(
    coord: Coordinates,
    center: Coordinates,
    radius_km: float
) -> bool:
    """Check if coordinate is within service area
    
    Args:
        coord: Coordinate to check
        center: Service area center
        radius_km: Service area radius in km
        
    Returns:
        True if coordinate is within service area
    """
    distance = calculate_distance(coord, center)
    return distance <= radius_km

def calculate_battery_consumption(
    distance_km: float,
    altitude_m: float = 20.0,
    speed_mps: float = 15.0,
    wind_speed_mps: float = 0.0
) -> float:
    """Estimate battery consumption for a flight
    
    Args:
        distance_km: Flight distance
        altitude_m: Flight altitude
        speed_mps: Flight speed
        wind_speed_mps: Head/tail wind speed
        
    Returns:
        Estimated battery consumption percentage
    """
    # Base consumption rate (%/km)
    base_consumption_rate = 2.0
    
    # Altitude factor (higher altitude = more power)
    altitude_factor = 1.0 + (altitude_m - 20) * 0.01
    
    # Speed factor (non-optimal speeds consume more power)
    optimal_speed = 15.0
    speed_factor = 1.0 + abs(speed_mps - optimal_speed) * 0.05
    
    # Wind factor (headwind increases consumption)
    wind_factor = 1.0 + max(0, wind_speed_mps) * 0.1
    
    # Calculate total consumption
    consumption = (
        distance_km * 
        base_consumption_rate * 
        altitude_factor * 
        speed_factor * 
        wind_factor
    )
    
    return min(100.0, consumption)

def calculate_mission_complexity_score(waypoints: list) -> float:
    """Calculate complexity score for a mission
    
    Args:
        waypoints: List of waypoint coordinates
        
    Returns:
        Complexity score (0-100)
    """
    if len(waypoints) < 2:
        return 0.0
    
    # Base score from number of waypoints
    waypoint_score = min(50, len(waypoints) * 5)
    
    # Distance score
    total_distance = 0.0
    for i in range(len(waypoints) - 1):
        total_distance += calculate_distance(waypoints[i], waypoints[i + 1])
    
    distance_score = min(30, total_distance * 2)
    
    # Direction change score (more turns = higher complexity)
    direction_changes = 0
    if len(waypoints) >= 3:
        for i in range(len(waypoints) - 2):
            bearing1 = calculate_bearing(waypoints[i], waypoints[i + 1])
            bearing2 = calculate_bearing(waypoints[i + 1], waypoints[i + 2])
            
            angle_diff = abs(bearing2 - bearing1)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
                
            if angle_diff > 30:  # Significant direction change
                direction_changes += 1
    
    direction_score = min(20, direction_changes * 5)
    
    return waypoint_score + distance_score + direction_score