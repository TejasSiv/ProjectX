import logging
import sys
from datetime import datetime
from typing import Optional

from .config import settings


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for different log levels."""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Set up a logger with consistent formatting."""
    
    logger = logging.getLogger(name)
    
    # Don't add handlers if they already exist
    if logger.handlers:
        return logger
    
    log_level = level or settings.log_level
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    
    # Formatter
    formatter = ColoredFormatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    logger.propagate = False
    
    return logger


# Create default loggers
main_logger = setup_logger("delivery_planner")
api_logger = setup_logger("delivery_planner.api")
mission_logger = setup_logger("delivery_planner.mission")
scheduler_logger = setup_logger("delivery_planner.scheduler")