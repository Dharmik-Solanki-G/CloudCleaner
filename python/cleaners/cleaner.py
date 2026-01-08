"""
CloudCleaner - Cleaner Module
Handles actual file deletion operations with safety checks.
"""

from typing import List, Dict
from pathlib import Path
import os
import shutil
import json
import time
from dataclasses import dataclass, asdict

try:
    from send2trash import send2trash
    HAS_SEND2TRASH = True
except ImportError:
    HAS_SEND2TRASH = False


@dataclass
class CleanupResult:
    """Result of a cleanup operation."""
    success: bool
    items_deleted: int
    items_failed: int
    freed_bytes: int
    errors: List[str]
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


class Cleaner:
    """Handles actual file/directory deletion operations."""

    def __init__(self, use_trash: bool = True):
        """
        Initialize cleaner.
        
        Args:
            use_trash: If True, move files to trash instead of permanent delete
        """
        self.use_trash = use_trash and HAS_SEND2TRASH
        self.backup_log: List[Dict] = []

    def preview(self, paths: List[str]) -> Dict:
        """
        Generate deletion plan without executing.
        
        Args:
            paths: List of paths to potentially delete
            
        Returns:
            Dict with estimated space recovery and item counts
        """
        total_size = 0
        valid_paths = []
        warnings = []

        for path in paths:
            if not os.path.exists(path):
                continue
                
            try:
                if os.path.isdir(path):
                    size = self._get_dir_size(path)
                else:
                    size = os.path.getsize(path)
                
                total_size += size
                valid_paths.append({
                    'path': path,
                    'size': size,
                    'type': 'directory' if os.path.isdir(path) else 'file'
                })
            except (PermissionError, OSError) as e:
                warnings.append(f"Cannot access {path}: {str(e)}")

        return {
            'items_to_delete': len(valid_paths),
            'estimated_size_bytes': total_size,
            'paths': valid_paths,
            'warnings': warnings,
            'use_trash': self.use_trash
        }

    def execute(self, paths: List[str], create_backup_log: bool = True) -> CleanupResult:
        """
        Perform actual cleanup.
        
        Args:
            paths: List of paths to delete
            create_backup_log: Whether to log deleted items for reference
            
        Returns:
            CleanupResult with success/failure counts
        """
        items_deleted = 0
        items_failed = 0
        freed_bytes = 0
        errors = []

        for path in paths:
            if not os.path.exists(path):
                continue
            
            try:
                # Get size before deletion
                if os.path.isdir(path):
                    size = self._get_dir_size(path)
                else:
                    size = os.path.getsize(path)

                # Log for backup/reference
                if create_backup_log:
                    self.backup_log.append({
                        'path': path,
                        'size_bytes': size,
                        'deleted_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
                        'type': 'directory' if os.path.isdir(path) else 'file'
                    })

                # Perform deletion
                if self.use_trash:
                    send2trash(path)
                else:
                    if os.path.isdir(path):
                        shutil.rmtree(path, ignore_errors=True)
                    else:
                        os.remove(path)

                items_deleted += 1
                freed_bytes += size

            except PermissionError as e:
                items_failed += 1
                errors.append(f"Permission denied: {path}")
            except OSError as e:
                items_failed += 1
                errors.append(f"Error deleting {path}: {str(e)}")
            except Exception as e:
                items_failed += 1
                errors.append(f"Unexpected error with {path}: {str(e)}")

        return CleanupResult(
            success=items_failed == 0,
            items_deleted=items_deleted,
            items_failed=items_failed,
            freed_bytes=freed_bytes,
            errors=errors,
            timestamp=time.strftime('%Y-%m-%dT%H:%M:%S')
        )

    def get_backup_log(self) -> List[Dict]:
        """Return the backup log of deleted items."""
        return self.backup_log

    def save_backup_log(self, filepath: str) -> bool:
        """Save backup log to a JSON file."""
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.backup_log, f, indent=2)
            return True
        except Exception:
            return False

    def _get_dir_size(self, path: str) -> int:
        """Calculate total size of a directory."""
        total = 0
        try:
            for entry in os.scandir(path):
                try:
                    if entry.is_file(follow_symlinks=False):
                        total += entry.stat().st_size
                    elif entry.is_dir(follow_symlinks=False):
                        total += self._get_dir_size(entry.path)
                except (PermissionError, OSError):
                    continue
        except (PermissionError, OSError):
            pass
        return total


if __name__ == '__main__':
    # Quick test (dry run)
    cleaner = Cleaner(use_trash=True)
    preview = cleaner.preview(['/tmp/test'])
    print(json.dumps(preview, indent=2))
