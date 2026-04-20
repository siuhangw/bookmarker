"""Shared pytest config — adds scripts/ to sys.path so tests can import sync_bookmarks."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
