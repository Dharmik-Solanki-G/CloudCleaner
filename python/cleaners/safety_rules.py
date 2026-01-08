"""
CloudCleaner - Safety Rules Module
Defines protected paths and validates deletion safety.
"""

from pathlib import Path
import os
import platform


# Safety rules by OS
SAFETY_RULES = {
    'windows': {
        'never_delete': [
            'C:\\Windows\\System32',
            'C:\\Windows\\SysWOW64',
            'C:\\Windows\\WinSxS',
            'C:\\Program Files',
            'C:\\Program Files (x86)',
            'C:\\ProgramData\\Microsoft',
            '%USERPROFILE%\\Documents',
            '%USERPROFILE%\\Desktop',
            '%USERPROFILE%\\Pictures',
            '%USERPROFILE%\\Videos',
            '%USERPROFILE%\\Music',
            '%USERPROFILE%\\Downloads',
            '%USERPROFILE%\\.ssh',
            '%APPDATA%\\Microsoft\\Windows\\Start Menu',
        ],
        'require_confirmation': [
            'C:\\Windows\\SoftwareDistribution',
            'C:\\Windows\\Logs',
            '%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer',
        ]
    },
    'darwin': {
        'never_delete': [
            '/System',
            '/Library',
            '/usr/bin',
            '/usr/sbin',
            '/bin',
            '/sbin',
            '~/Documents',
            '~/Desktop',
            '~/Pictures',
            '~/Downloads',
            '~/.ssh',
        ],
        'require_confirmation': [
            '~/Library/Caches',
            '/Library/Logs',
        ]
    },
    'linux': {
        'never_delete': [
            '/bin',
            '/sbin',
            '/usr/bin',
            '/usr/sbin',
            '/etc',
            '/lib',
            '/lib64',
            '/boot',
            '/root',
            '~/.ssh',
            '~/.gnupg',
            '~/Documents',
            '~/Desktop',
            '~/Downloads',
        ],
        'require_confirmation': [
            '/var/log',
            '/tmp',
            '~/.cache',
        ]
    }
}


def _expand_path(path: str) -> str:
    """Expand environment variables and user home."""
    return os.path.expandvars(os.path.expanduser(path))


def _normalize_path(path: str) -> str:
    """Normalize path for comparison."""
    return os.path.normpath(os.path.abspath(_expand_path(path))).lower()


def is_path_protected(path: str, os_type: str = None) -> tuple:
    """
    Check if a path is protected from deletion.
    
    Args:
        path: Path to check
        os_type: Operating system type (windows, darwin, linux)
        
    Returns:
        Tuple of (is_protected: bool, reason: str)
    """
    if os_type is None:
        os_type = platform.system().lower()
    
    if os_type not in SAFETY_RULES:
        os_type = 'linux'  # Default fallback
    
    rules = SAFETY_RULES[os_type]
    normalized_path = _normalize_path(path)
    
    # Check never_delete paths
    for protected in rules['never_delete']:
        protected_normalized = _normalize_path(protected)
        if normalized_path.startswith(protected_normalized) or protected_normalized.startswith(normalized_path):
            return (True, f"Protected system path: {protected}")
    
    return (False, "Path is safe to delete")


def requires_confirmation(path: str, os_type: str = None) -> tuple:
    """
    Check if a path requires user confirmation before deletion.
    
    Args:
        path: Path to check
        os_type: Operating system type
        
    Returns:
        Tuple of (requires_confirmation: bool, reason: str)
    """
    if os_type is None:
        os_type = platform.system().lower()
    
    if os_type not in SAFETY_RULES:
        os_type = 'linux'
    
    rules = SAFETY_RULES[os_type]
    normalized_path = _normalize_path(path)
    
    # Check require_confirmation paths
    for sensitive in rules['require_confirmation']:
        sensitive_normalized = _normalize_path(sensitive)
        if normalized_path.startswith(sensitive_normalized):
            return (True, f"Sensitive location: {sensitive}")
    
    return (False, "No confirmation required")


def is_file_locked(path: str) -> bool:
    """
    Check if a file is currently in use by another process.
    
    Args:
        path: File path to check
        
    Returns:
        True if file is locked, False otherwise
    """
    if not os.path.isfile(path):
        return False
    
    try:
        # Try to open file for writing
        with open(path, 'r+b'):
            pass
        return False
    except (PermissionError, OSError):
        return True


def validate_deletion_safety(path: str, os_type: str = None) -> tuple:
    """
    Full validation of whether a path is safe to delete.
    
    Args:
        path: Path to validate
        os_type: Operating system type
        
    Returns:
        Tuple of (is_safe: bool, reason: str, requires_confirmation: bool)
    """
    if os_type is None:
        os_type = platform.system().lower()
    
    # Check if protected
    is_protected, protected_reason = is_path_protected(path, os_type)
    if is_protected:
        return (False, protected_reason, False)
    
    # Check if file is locked
    if os.path.isfile(path) and is_file_locked(path):
        return (False, "File is currently in use by another process", False)
    
    # Check if confirmation required
    needs_confirm, confirm_reason = requires_confirmation(path, os_type)
    if needs_confirm:
        return (True, confirm_reason, True)
    
    return (True, "Safe to delete", False)


if __name__ == '__main__':
    # Quick test
    test_paths = [
        'C:\\Windows\\System32\\test.dll',
        'C:\\Users\\Test\\Documents\\file.txt',
        'C:\\Users\\Test\\AppData\\Local\\Temp\\cache.tmp',
        '/usr/bin/python',
        '/home/user/.cache/app_cache',
    ]
    
    for path in test_paths:
        is_safe, reason, needs_confirm = validate_deletion_safety(path)
        print(f"{path}")
        print(f"  Safe: {is_safe}, Reason: {reason}, Confirm: {needs_confirm}")
        print()
