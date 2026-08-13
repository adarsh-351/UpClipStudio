import logging
from pathlib import Path
import config

LOG_FILE = Path(config.LOG_DIR) / "application.log"

logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("ShortsAI")