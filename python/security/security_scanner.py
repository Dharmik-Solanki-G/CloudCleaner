"""
CloudCleaner - Security Scanner Module
Scans for common security issues, exposed secrets, and vulnerabilities.
"""

import os
import re
import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from pathlib import Path
import time


@dataclass
class SecurityFinding:
    """A security issue found during scanning."""
    severity: str  # 'critical', 'high', 'medium', 'low', 'info'
    category: str  # 'exposed_secret', 'weak_permission', 'suspicious_file', 'privacy_risk'
    title: str
    description: str
    path: str
    line_number: Optional[int] = None
    recommendation: str = ""
    

@dataclass
class SecurityScanResult:
    """Results of a security scan."""
    total_findings: int = 0
    findings: List[SecurityFinding] = field(default_factory=list)
    scan_duration_seconds: float = 0
    timestamp: str = ""
    categories: Dict[str, int] = field(default_factory=dict)
    severity_counts: Dict[str, int] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            'total_findings': self.total_findings,
            'findings': [asdict(f) for f in self.findings],
            'scan_duration_seconds': self.scan_duration_seconds,
            'timestamp': self.timestamp,
            'categories': self.categories,
            'severity_counts': self.severity_counts
        }


class SecurityScanner:
    """
    Scans for security vulnerabilities and privacy risks.
    Uses pattern matching for secret detection (rule-based, no external tools).
    """
    
    # Regex patterns for secret detection
    SECRET_PATTERNS = {
        'AWS Access Key': r'AKIA[0-9A-Z]{16}',
        'AWS Secret Key': r'(?i)aws(.{0,20})?(?<![\w])[\'"][0-9a-zA-Z/+]{40}[\'"]',
        'GitHub Token': r'ghp_[a-zA-Z0-9]{36}',
        'GitHub OAuth': r'gho_[a-zA-Z0-9]{36}',
        'Google API Key': r'AIza[0-9A-Za-z\-_]{35}',
        'Slack Token': r'xox[baprs]-([0-9a-zA-Z]{10,48})',
        'Stripe API Key': r'sk_live_[0-9a-zA-Z]{24}',
        'Private Key': r'-----BEGIN (?:RSA|DSA|EC|OPENSSH)? ?PRIVATE KEY-----',
        'Generic Password': r'(?i)(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{8,}["\']',
        'Generic API Key': r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\'][a-zA-Z0-9]{16,}["\']',
        'Generic Secret': r'(?i)(?:secret|token)\s*[=:]\s*["\'][a-zA-Z0-9]{16,}["\']',
        'Database URL': r'(?i)(?:mysql|postgres|mongodb|redis):\/\/[^\s]+:[^\s]+@',
    }
    
    # Files to scan for secrets
    CODE_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml', 
                       '.env', '.ini', '.cfg', '.conf', '.xml', '.sh', '.bat', '.ps1'}
    
    # Sensitive file patterns
    SENSITIVE_FILES = {
        'SSH Private Key': ['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519'],
        'AWS Credentials': ['.aws/credentials', 'credentials.csv'],
        'Environment File': ['.env', '.env.local', '.env.production'],
        'Database File': ['*.sqlite', '*.db', 'database.yml'],
        'Password File': ['passwords.txt', 'password.txt', 'passwd'],
    }
    
    # Common directories to scan
    SCAN_DIRS = [
        os.path.expanduser('~'),
        os.path.expanduser('~/Documents'),
        os.path.expanduser('~/Desktop'),
        os.path.expanduser('~/Downloads'),
    ]
    
    # Directories to skip
    SKIP_DIRS = {
        'node_modules', '.git', '__pycache__', 'venv', '.venv', 'env',
        'dist', 'build', '.cache', 'Library', 'AppData', 'Application Data',
        'WindowsApps', 'Program Files', 'Windows'
    }
    
    def __init__(self, max_file_size_mb: int = 5, max_files: int = 1000):
        self.max_file_size = max_file_size_mb * 1024 * 1024
        self.max_files = max_files
        self.files_scanned = 0
    
    def scan(self, directories: Optional[List[str]] = None) -> SecurityScanResult:
        """
        Run a security scan on specified directories.
        
        Args:
            directories: List of directories to scan. Defaults to common user directories.
        
        Returns:
            SecurityScanResult with findings.
        """
        start_time = time.time()
        findings = []
        
        scan_dirs = directories or self.SCAN_DIRS
        
        # Scan for secrets in code files
        for directory in scan_dirs:
            if os.path.exists(directory):
                findings.extend(self._scan_directory(directory))
                
                if self.files_scanned >= self.max_files:
                    break
        
        # Check for sensitive files
        findings.extend(self._check_sensitive_files())
        
        # Check browser for saved passwords indicator
        findings.extend(self._check_browser_security())
        
        # Calculate statistics
        categories = {}
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        
        for finding in findings:
            categories[finding.category] = categories.get(finding.category, 0) + 1
            severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1
        
        return SecurityScanResult(
            total_findings=len(findings),
            findings=findings,
            scan_duration_seconds=round(time.time() - start_time, 2),
            timestamp=time.strftime('%Y-%m-%dT%H:%M:%S'),
            categories=categories,
            severity_counts=severity_counts
        )
    
    def _scan_directory(self, directory: str) -> List[SecurityFinding]:
        """Scan a directory for secrets in code files."""
        findings = []
        
        try:
            for root, dirs, files in os.walk(directory):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
                
                for filename in files:
                    if self.files_scanned >= self.max_files:
                        return findings
                    
                    file_path = os.path.join(root, filename)
                    ext = os.path.splitext(filename)[1].lower()
                    
                    # Only scan code files
                    if ext not in self.CODE_EXTENSIONS and filename not in ['.env', '.gitignore']:
                        continue
                    
                    try:
                        # Skip large files
                        if os.path.getsize(file_path) > self.max_file_size:
                            continue
                        
                        self.files_scanned += 1
                        findings.extend(self._scan_file(file_path))
                        
                    except (PermissionError, OSError):
                        continue
                        
        except (PermissionError, OSError):
            pass
        
        return findings
    
    def _scan_file(self, file_path: str) -> List[SecurityFinding]:
        """Scan a single file for secrets."""
        findings = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
                
                for pattern_name, pattern in self.SECRET_PATTERNS.items():
                    matches = re.finditer(pattern, content)
                    
                    for match in matches:
                        # Find line number
                        line_num = content[:match.start()].count('\n') + 1
                        
                        # Skip if in a comment or test file
                        if self._is_likely_false_positive(file_path, lines[line_num - 1] if line_num <= len(lines) else ''):
                            continue
                        
                        findings.append(SecurityFinding(
                            severity='high' if 'key' in pattern_name.lower() or 'secret' in pattern_name.lower() else 'medium',
                            category='exposed_secret',
                            title=f'Possible {pattern_name} Exposed',
                            description=f'Found pattern matching {pattern_name} in file',
                            path=file_path,
                            line_number=line_num,
                            recommendation=f'Remove or encrypt the {pattern_name}. Consider using environment variables or a secrets manager.'
                        ))
                        
        except Exception:
            pass
        
        return findings
    
    def _is_likely_false_positive(self, file_path: str, line: str) -> bool:
        """Check if a match is likely a false positive."""
        # Skip test files
        if 'test' in file_path.lower() or 'spec' in file_path.lower() or 'mock' in file_path.lower():
            return True
        
        # Skip comments
        line_stripped = line.strip()
        if line_stripped.startswith('#') or line_stripped.startswith('//') or line_stripped.startswith('*'):
            return True
        
        # Skip example/placeholder values
        if any(x in line.lower() for x in ['example', 'placeholder', 'your_', 'xxx', 'dummy', 'sample']):
            return True
        
        return False
    
    def _check_sensitive_files(self) -> List[SecurityFinding]:
        """Check for sensitive files in common locations."""
        findings = []
        home = os.path.expanduser('~')
        
        # Check for SSH keys without passphrase protection
        ssh_dir = os.path.join(home, '.ssh')
        if os.path.exists(ssh_dir):
            for key_file in ['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519']:
                key_path = os.path.join(ssh_dir, key_file)
                if os.path.exists(key_path):
                    findings.append(SecurityFinding(
                        severity='info',
                        category='privacy_risk',
                        title='SSH Private Key Found',
                        description='SSH private key exists. Ensure it is password-protected.',
                        path=key_path,
                        recommendation='Verify your SSH key has a strong passphrase. Run: ssh-keygen -p -f <keyfile>'
                    ))
        
        # Check for .env files in home directory
        env_files = ['.env', '.env.local', '.env.production']
        for env_file in env_files:
            env_path = os.path.join(home, env_file)
            if os.path.exists(env_path):
                findings.append(SecurityFinding(
                    severity='medium',
                    category='exposed_secret',
                    title='Environment File in Home Directory',
                    description='Environment file with potential secrets found in home directory.',
                    path=env_path,
                    recommendation='Move environment files to project directories and ensure they are in .gitignore.'
                ))
        
        return findings
    
    def _check_browser_security(self) -> List[SecurityFinding]:
        """Check browser-related security settings."""
        findings = []
        home = os.path.expanduser('~')
        
        # Check Chrome Login Data (indicates saved passwords)
        chrome_paths = [
            os.path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Login Data'),
            os.path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Login Data'),
        ]
        
        for chrome_path in chrome_paths:
            if os.path.exists(chrome_path):
                findings.append(SecurityFinding(
                    severity='info',
                    category='privacy_risk',
                    title='Browser Has Saved Passwords',
                    description='Chrome has a Login Data file, indicating saved passwords.',
                    path=chrome_path,
                    recommendation='Consider using a dedicated password manager instead of browser-saved passwords.'
                ))
                break
        
        return findings


if __name__ == '__main__':
    scanner = SecurityScanner(max_files=100)
    result = scanner.scan()
    print(json.dumps(result.to_dict(), indent=2))
