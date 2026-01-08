"""
CloudCleaner - Cache Scanner Module
Scans system for junk files, caches, and temporary data.
"""

from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import platform
import os
import time
import json

@dataclass
class FileItem:
    """Represents a scannable file or directory."""
    path: str
    size_bytes: int
    category: str
    last_modified: float
    risk_level: str  # 'low', 'medium', 'high'
    safe_to_delete: bool
    reason: str

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class ScanResult:
    """Complete scan output."""
    total_items: int
    total_size_bytes: int
    items: List[FileItem]
    categories: Dict[str, int]
    scan_duration_seconds: float
    timestamp: str

    def to_dict(self) -> dict:
        return {
            'total_items': self.total_items,
            'total_size_bytes': self.total_size_bytes,
            'items': [item.to_dict() for item in self.items],
            'categories': self.categories,
            'scan_duration_seconds': self.scan_duration_seconds,
            'timestamp': self.timestamp
        }


class CacheScanner:
    """Main scanner engine for discovering junk files."""

    def __init__(self, os_type: Optional[str] = None):
        self.os_type = os_type or platform.system().lower()
        self.whitelist = self._load_whitelist()
        self.scan_paths = self._get_scan_paths()

    def _load_whitelist(self) -> List[str]:
        """Load critical paths that should never be touched."""
        if self.os_type == 'windows':
            return [
                os.path.expandvars(r'%USERPROFILE%\Documents'),
                os.path.expandvars(r'%USERPROFILE%\Desktop'),
                os.path.expandvars(r'%USERPROFILE%\Pictures'),
                os.path.expandvars(r'%USERPROFILE%\Videos'),
                os.path.expandvars(r'%USERPROFILE%\Music'),
                os.path.expandvars(r'%USERPROFILE%\Downloads'),
                r'C:\Windows\System32',
                r'C:\Windows\SysWOW64',
                r'C:\Program Files',
                r'C:\Program Files (x86)',
                r'C:\ProgramData\Microsoft',
            ]
        elif self.os_type == 'darwin':
            home = os.path.expanduser('~')
            return [
                f'{home}/Documents',
                f'{home}/Desktop',
                f'{home}/Pictures',
                f'{home}/Downloads',
                '/System',
                '/Library',
            ]
        else:  # Linux
            home = os.path.expanduser('~')
            return [
                f'{home}/Documents',
                f'{home}/Desktop',
                f'{home}/Pictures',
                f'{home}/Downloads',
                f'{home}/.ssh',
                f'{home}/.gnupg',
                '/bin', '/sbin', '/usr/bin', '/usr/sbin',
                '/etc', '/lib', '/lib64',
            ]

    def _get_scan_paths(self) -> Dict[str, Dict]:
        """Get OS-specific scan paths with metadata."""
        if self.os_type == 'windows':
            temp = os.path.expandvars('%TEMP%')
            local_app = os.path.expandvars('%LOCALAPPDATA%')
            return {
                'temp_files': {
                    'paths': [temp, r'C:\Windows\Temp'],
                    'category': 'temp_files',
                    'risk_level': 'low',
                    'reason': 'Temporary files - safe to delete'
                },
                'chrome_cache': {
                    'paths': [f'{local_app}\\Google\\Chrome\\User Data\\Default\\Cache',
                              f'{local_app}\\Google\\Chrome\\User Data\\Default\\Code Cache'],
                    'category': 'browser_cache',
                    'risk_level': 'low',
                    'reason': 'Chrome browser cache'
                },
                'edge_cache': {
                    'paths': [f'{local_app}\\Microsoft\\Edge\\User Data\\Default\\Cache'],
                    'category': 'browser_cache',
                    'risk_level': 'low',
                    'reason': 'Edge browser cache'
                },
                'firefox_cache': {
                    'paths': [f'{local_app}\\Mozilla\\Firefox\\Profiles'],
                    'category': 'browser_cache',
                    'risk_level': 'low',
                    'reason': 'Firefox browser cache'
                },
                'thumbnails': {
                    'paths': [f'{local_app}\\Microsoft\\Windows\\Explorer'],
                    'category': 'thumbnails',
                    'risk_level': 'low',
                    'reason': 'Windows thumbnail cache'
                },
                'crash_dumps': {
                    'paths': [f'{local_app}\\CrashDumps',
                              os.path.expandvars(r'%USERPROFILE%\AppData\Local\CrashDumps')],
                    'category': 'crash_dumps',
                    'risk_level': 'low',
                    'reason': 'Application crash dumps'
                },
                'windows_logs': {
                    'paths': [r'C:\Windows\Logs'],
                    'category': 'logs',
                    'risk_level': 'medium',
                    'reason': 'Windows log files - may be useful for debugging'
                },
            }
        elif self.os_type == 'darwin':
            home = os.path.expanduser('~')
            return {
                'user_cache': {
                    'paths': [f'{home}/Library/Caches'],
                    'category': 'app_cache',
                    'risk_level': 'low',
                    'reason': 'Application caches'
                },
                'chrome_cache': {
                    'paths': [f'{home}/Library/Caches/Google/Chrome'],
                    'category': 'browser_cache',
                    'risk_level': 'low',
                    'reason': 'Chrome browser cache'
                },
            }
        else:  # Linux
            home = os.path.expanduser('~')
            return {
                'temp_files': {
                    'paths': ['/tmp', f'{home}/.cache'],
                    'category': 'temp_files',
                    'risk_level': 'low',
                    'reason': 'Temporary files'
                },
                'chrome_cache': {
                    'paths': [f'{home}/.cache/google-chrome'],
                    'category': 'browser_cache',
                    'risk_level': 'low',
                    'reason': 'Chrome browser cache'
                },
            }

    def _is_path_protected(self, path: str) -> bool:
        """Check if path is in whitelist."""
        path_lower = path.lower()
        for protected in self.whitelist:
            if path_lower.startswith(protected.lower()):
                return True
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

    def _is_file_locked(self, path: str) -> bool:
        """Check if a file is currently in use."""
        if not os.path.isfile(path):
            return False
        try:
            with open(path, 'rb') as f:
                pass
            return False
        except (PermissionError, OSError):
            return True

    def scan(self, quick_scan: bool = False) -> ScanResult:
        """Execute system scan."""
        start_time = time.time()
        items: List[FileItem] = []
        categories: Dict[str, int] = {}

        for scan_name, scan_config in self.scan_paths.items():
            for path_template in scan_config['paths']:
                path = os.path.expandvars(path_template)
                
                if not os.path.exists(path):
                    continue
                
                if self._is_path_protected(path):
                    continue

                try:
                    if os.path.isdir(path):
                        size = self._get_dir_size(path)
                        if size > 0:
                            item = FileItem(
                                path=path,
                                size_bytes=size,
                                category=scan_config['category'],
                                last_modified=os.path.getmtime(path),
                                risk_level=scan_config['risk_level'],
                                safe_to_delete=True,
                                reason=scan_config['reason']
                            )
                            items.append(item)
                            
                            # Update category totals
                            cat = scan_config['category']
                            categories[cat] = categories.get(cat, 0) + size
                    
                    elif os.path.isfile(path) and not self._is_file_locked(path):
                        size = os.path.getsize(path)
                        if size > 0:
                            item = FileItem(
                                path=path,
                                size_bytes=size,
                                category=scan_config['category'],
                                last_modified=os.path.getmtime(path),
                                risk_level=scan_config['risk_level'],
                                safe_to_delete=True,
                                reason=scan_config['reason']
                            )
                            items.append(item)
                            
                            cat = scan_config['category']
                            categories[cat] = categories.get(cat, 0) + size
                
                except (PermissionError, OSError) as e:
                    continue

        # Sort items by size (largest first)
        items.sort(key=lambda x: x.size_bytes, reverse=True)

        # Calculate totals
        total_size = sum(item.size_bytes for item in items)
        duration = time.time() - start_time

        return ScanResult(
            total_items=len(items),
            total_size_bytes=total_size,
            items=items,
            categories=categories,
            scan_duration_seconds=round(duration, 2),
            timestamp=time.strftime('%Y-%m-%dT%H:%M:%S')
        )


if __name__ == '__main__':
    # Quick test
    scanner = CacheScanner()
    result = scanner.scan()
    print(json.dumps(result.to_dict(), indent=2))
