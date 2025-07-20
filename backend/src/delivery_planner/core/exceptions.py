from fastapi import HTTPException, status
from typing import Optional, Dict, Any

class DroneException(Exception):
    """Base exception for drone-related errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

class MissionExecutionError(DroneException):
    """Error during mission execution"""
    pass

class ConnectionError(DroneException):
    """Drone connection error"""
    pass

class ValidationError(DroneException):
    """Data validation error"""
    pass

class AuthenticationError(HTTPException):
    """Authentication error"""
    
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )

class AuthorizationError(HTTPException):
    """Authorization error"""
    
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )

class OrderNotFoundError(HTTPException):
    """Order not found error"""
    
    def __init__(self, order_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found"
        )

class MissionNotFoundError(HTTPException):
    """Mission not found error"""
    
    def __init__(self, mission_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

class InvalidStatusTransitionError(HTTPException):
    """Invalid status transition error"""
    
    def __init__(self, current_status: str, new_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from {current_status} to {new_status}"
        )

class ServiceUnavailableError(HTTPException):
    """Service unavailable error"""
    
    def __init__(self, service: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service {service} is currently unavailable"
        )

class RateLimitExceededError(HTTPException):
    """Rate limit exceeded error"""
    
    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)}
        )