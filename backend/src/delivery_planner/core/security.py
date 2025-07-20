from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings
from .exceptions import AuthenticationError, AuthorizationError

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def verify_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise AuthenticationError("Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current user from JWT token"""
    try:
        payload = verify_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Invalid token payload")
        
        # In a real app, you'd fetch user details from database
        # For now, return basic user info from token
        return {
            "id": user_id,
            "email": payload.get("email"),
            "roles": payload.get("roles", [])
        }
    except JWTError:
        raise AuthenticationError("Could not validate credentials")

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise AuthenticationError("Inactive user")
    return current_user

def require_roles(required_roles: list):
    """Decorator to require specific roles"""
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_active_user)):
        user_roles = current_user.get("roles", [])
        if not any(role in user_roles for role in required_roles):
            raise AuthorizationError(f"Required roles: {required_roles}")
        return current_user
    return role_checker

# Pre-defined role checkers
require_admin = require_roles(["admin"])
require_operator = require_roles(["admin", "operator"])
require_viewer = require_roles(["admin", "operator", "viewer"])

class APIKeyAuth:
    """API Key authentication for service-to-service communication"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def __call__(self, api_key: str = Depends(lambda: None)) -> bool:
        if api_key != self.api_key:
            raise AuthenticationError("Invalid API key")
        return True

def create_api_key_auth(api_key: str):
    """Create API key authentication dependency"""
    return APIKeyAuth(api_key)

# CORS security helper
def get_cors_origins() -> list:
    """Get allowed CORS origins based on environment"""
    if settings.debug_mode:
        return settings.allowed_origins + ["http://localhost:3000", "http://localhost:8080"]
    return settings.allowed_origins

# Rate limiting helper (basic implementation)
class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = {}
    
    def is_allowed(self, identifier: str, max_requests: int = 100, window_minutes: int = 1) -> bool:
        """Check if request is allowed within rate limit"""
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=window_minutes)
        
        # Clean old requests
        if identifier in self.requests:
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier] 
                if req_time > window_start
            ]
        else:
            self.requests[identifier] = []
        
        # Check rate limit
        if len(self.requests[identifier]) >= max_requests:
            return False
        
        # Add current request
        self.requests[identifier].append(now)
        return True

# Global rate limiter instance
rate_limiter = RateLimiter()

def check_rate_limit(identifier: str, max_requests: int = 100):
    """Check rate limit for identifier"""
    if not rate_limiter.is_allowed(identifier, max_requests):
        from .exceptions import RateLimitExceededError
        raise RateLimitExceededError()

# Security headers helper
def get_security_headers() -> Dict[str, str]:
    """Get recommended security headers"""
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }