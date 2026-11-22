"""Development entry point: `python backend/run.py`."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

import uvicorn  # noqa: E402

from app.config import get_settings  # noqa: E402

if __name__ == "__main__":
    # Run from backend/ so uvicorn's reloader can import `app.main` in its child.
    os.chdir(BACKEND_DIR)
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
