from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from enum import Enum
import uuid

from .config import settings

engine = create_engine(settings.db_url, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class OrderStatus(str, Enum):
    """Order status enumeration."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_FLIGHT = "in_flight"
    COMPLETED = "completed"
    FAILED = "failed"


class DeliveryOrder(Base):
    """SQLAlchemy model for delivery orders."""
    __tablename__ = "orders"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lon = Column(Float, nullable=False)
    dropoff_lat = Column(Float, nullable=False)
    dropoff_lon = Column(Float, nullable=False)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    estimated_time = Column(Integer, nullable=True)  # minutes
    
    def __repr__(self):
        return f"<DeliveryOrder(id={self.id}, status={self.status})>"


def get_db() -> Session:
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create database tables."""
    Base.metadata.create_all(bind=engine)


def drop_tables():
    """Drop all database tables."""
    Base.metadata.drop_all(bind=engine)