"""
CloudCleaner - Performance Diagnosis Module
Analyzes system performance including CPU, memory, disk, and boot time.
"""

import os
import time
import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from datetime import datetime

try:
    import psutil
except ImportError:
    psutil = None


@dataclass
class PerformanceIssue:
    """A performance issue or recommendation."""
    severity: str  # 'critical', 'warning', 'info'
    category: str  # 'cpu', 'memory', 'disk', 'startup', 'process'
    title: str
    description: str
    current_value: str
    recommendation: str
    impact: str = ""  # Expected improvement


@dataclass
class ProcessInfo:
    """Information about a running process."""
    pid: int
    name: str
    cpu_percent: float
    memory_mb: float
    status: str


@dataclass 
class PerformanceReport:
    """Complete performance diagnosis report."""
    # System info
    cpu_count: int = 0
    cpu_percent: float = 0
    memory_total_gb: float = 0
    memory_used_gb: float = 0
    memory_percent: float = 0
    disk_total_gb: float = 0
    disk_used_gb: float = 0
    disk_percent: float = 0
    
    # Performance score (0-100)
    performance_score: int = 100
    
    # Issues and recommendations
    issues: List[PerformanceIssue] = field(default_factory=list)
    
    # Top resource consumers
    top_cpu_processes: List[ProcessInfo] = field(default_factory=list)
    top_memory_processes: List[ProcessInfo] = field(default_factory=list)
    
    # Startup programs (Windows)
    startup_programs: List[str] = field(default_factory=list)
    
    # Scan metadata
    scan_duration_seconds: float = 0
    timestamp: str = ""
    
    def to_dict(self) -> dict:
        return {
            'cpu_count': self.cpu_count,
            'cpu_percent': self.cpu_percent,
            'memory_total_gb': self.memory_total_gb,
            'memory_used_gb': self.memory_used_gb,
            'memory_percent': self.memory_percent,
            'disk_total_gb': self.disk_total_gb,
            'disk_used_gb': self.disk_used_gb,
            'disk_percent': self.disk_percent,
            'performance_score': self.performance_score,
            'issues': [asdict(i) for i in self.issues],
            'top_cpu_processes': [asdict(p) for p in self.top_cpu_processes],
            'top_memory_processes': [asdict(p) for p in self.top_memory_processes],
            'startup_programs': self.startup_programs,
            'scan_duration_seconds': self.scan_duration_seconds,
            'timestamp': self.timestamp
        }


class PerformanceDiagnoser:
    """
    Analyzes system performance and provides optimization recommendations.
    Uses psutil for cross-platform system metrics.
    """
    
    # Thresholds for issues
    CPU_HIGH_THRESHOLD = 80  # percent
    CPU_CRITICAL_THRESHOLD = 95
    MEMORY_HIGH_THRESHOLD = 80  # percent
    MEMORY_CRITICAL_THRESHOLD = 95
    DISK_HIGH_THRESHOLD = 85  # percent
    DISK_CRITICAL_THRESHOLD = 95
    
    # Process thresholds
    PROCESS_HIGH_CPU = 25  # percent of single core
    PROCESS_HIGH_MEMORY_MB = 500
    
    def __init__(self):
        if psutil is None:
            raise RuntimeError("psutil is required. Install with: pip install psutil")
    
    def diagnose(self) -> PerformanceReport:
        """
        Run a complete performance diagnosis.
        
        Returns:
            PerformanceReport with system metrics and recommendations.
        """
        start_time = time.time()
        report = PerformanceReport()
        
        # Gather system metrics
        self._gather_cpu_metrics(report)
        self._gather_memory_metrics(report)
        self._gather_disk_metrics(report)
        self._gather_process_info(report)
        self._check_startup_programs(report)
        
        # Analyze and generate issues
        self._analyze_issues(report)
        
        # Calculate overall score
        self._calculate_score(report)
        
        report.scan_duration_seconds = round(time.time() - start_time, 2)
        report.timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
        
        return report
    
    def _gather_cpu_metrics(self, report: PerformanceReport):
        """Gather CPU usage metrics."""
        report.cpu_count = psutil.cpu_count()
        # Get CPU percent over a short interval for accuracy
        report.cpu_percent = psutil.cpu_percent(interval=1)
    
    def _gather_memory_metrics(self, report: PerformanceReport):
        """Gather memory usage metrics."""
        mem = psutil.virtual_memory()
        report.memory_total_gb = round(mem.total / (1024**3), 2)
        report.memory_used_gb = round(mem.used / (1024**3), 2)
        report.memory_percent = mem.percent
    
    def _gather_disk_metrics(self, report: PerformanceReport):
        """Gather disk usage metrics for system drive."""
        # Get system drive (C: on Windows, / on Unix)
        if os.name == 'nt':
            disk_path = 'C:\\'
        else:
            disk_path = '/'
        
        try:
            disk = psutil.disk_usage(disk_path)
            report.disk_total_gb = round(disk.total / (1024**3), 2)
            report.disk_used_gb = round(disk.used / (1024**3), 2)
            report.disk_percent = disk.percent
        except Exception:
            pass
    
    def _gather_process_info(self, report: PerformanceReport):
        """Gather information about top resource-consuming processes."""
        processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
            try:
                info = proc.info
                memory_mb = info['memory_info'].rss / (1024**2) if info.get('memory_info') else 0
                
                processes.append(ProcessInfo(
                    pid=info['pid'],
                    name=info['name'] or 'Unknown',
                    cpu_percent=info.get('cpu_percent', 0) or 0,
                    memory_mb=round(memory_mb, 1),
                    status=info.get('status', 'unknown')
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # Sort and get top 5 by CPU and memory
        report.top_cpu_processes = sorted(
            processes, 
            key=lambda p: p.cpu_percent, 
            reverse=True
        )[:5]
        
        report.top_memory_processes = sorted(
            processes, 
            key=lambda p: p.memory_mb, 
            reverse=True
        )[:5]
    
    def _check_startup_programs(self, report: PerformanceReport):
        """Check startup programs (Windows only)."""
        if os.name != 'nt':
            return
        
        startup_paths = [
            os.path.join(os.environ.get('APPDATA', ''), 
                        'Microsoft\\Windows\\Start Menu\\Programs\\Startup'),
            os.path.join(os.environ.get('ProgramData', ''),
                        'Microsoft\\Windows\\Start Menu\\Programs\\Startup'),
        ]
        
        startup_programs = []
        
        for path in startup_paths:
            if os.path.exists(path):
                try:
                    for item in os.listdir(path):
                        if item.endswith(('.lnk', '.exe', '.bat', '.cmd')):
                            startup_programs.append(item)
                except PermissionError:
                    continue
        
        # Also check registry (simplified - just note it exists)
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                              r'Software\Microsoft\Windows\CurrentVersion\Run') as key:
                i = 0
                while True:
                    try:
                        name, _, _ = winreg.EnumValue(key, i)
                        startup_programs.append(name)
                        i += 1
                    except OSError:
                        break
        except Exception:
            pass
        
        report.startup_programs = startup_programs[:20]  # Limit to 20
    
    def _analyze_issues(self, report: PerformanceReport):
        """Analyze metrics and generate performance issues."""
        issues = []
        
        # CPU issues
        if report.cpu_percent >= self.CPU_CRITICAL_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='critical',
                category='cpu',
                title='CPU Usage Critical',
                description=f'CPU usage is at {report.cpu_percent}%, which may cause system slowdown.',
                current_value=f'{report.cpu_percent}%',
                recommendation='Close unnecessary applications or check for runaway processes.',
                impact='Significant performance improvement'
            ))
        elif report.cpu_percent >= self.CPU_HIGH_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='warning',
                category='cpu',
                title='High CPU Usage',
                description=f'CPU usage is elevated at {report.cpu_percent}%.',
                current_value=f'{report.cpu_percent}%',
                recommendation='Consider closing resource-heavy applications.',
                impact='Moderate performance improvement'
            ))
        
        # Memory issues
        if report.memory_percent >= self.MEMORY_CRITICAL_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='critical',
                category='memory',
                title='Memory Usage Critical',
                description=f'Memory is {report.memory_percent}% full ({report.memory_used_gb}GB/{report.memory_total_gb}GB).',
                current_value=f'{report.memory_percent}%',
                recommendation='Close applications or consider upgrading RAM.',
                impact='System stability improvement'
            ))
        elif report.memory_percent >= self.MEMORY_HIGH_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='warning',
                category='memory',
                title='High Memory Usage',
                description=f'Memory usage is high at {report.memory_percent}%.',
                current_value=f'{report.memory_percent}%',
                recommendation='Close unused browser tabs and applications.',
                impact='Better responsiveness'
            ))
        
        # Disk issues
        if report.disk_percent >= self.DISK_CRITICAL_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='critical',
                category='disk',
                title='Disk Space Critical',
                description=f'System disk is {report.disk_percent}% full. Only {report.disk_total_gb - report.disk_used_gb:.1f}GB free.',
                current_value=f'{report.disk_percent}%',
                recommendation='Delete unnecessary files or move data to external storage.',
                impact='Prevent system crashes and enable updates'
            ))
        elif report.disk_percent >= self.DISK_HIGH_THRESHOLD:
            issues.append(PerformanceIssue(
                severity='warning',
                category='disk',
                title='Low Disk Space',
                description=f'System disk is {report.disk_percent}% full.',
                current_value=f'{report.disk_percent}%',
                recommendation='Run CloudCleaner cache cleanup to free space.',
                impact='Better system performance'
            ))
        
        # Startup program issues
        if len(report.startup_programs) > 10:
            issues.append(PerformanceIssue(
                severity='warning',
                category='startup',
                title='Too Many Startup Programs',
                description=f'{len(report.startup_programs)} programs run at startup, slowing boot time.',
                current_value=f'{len(report.startup_programs)} programs',
                recommendation='Disable unnecessary startup programs in Task Manager.',
                impact='Faster boot time'
            ))
        elif len(report.startup_programs) > 5:
            issues.append(PerformanceIssue(
                severity='info',
                category='startup',
                title='Multiple Startup Programs',
                description=f'{len(report.startup_programs)} programs run at startup.',
                current_value=f'{len(report.startup_programs)} programs',
                recommendation='Review startup programs and disable ones you don\'t need.',
                impact='Slightly faster boot'
            ))
        
        # High resource processes
        for proc in report.top_cpu_processes:
            if proc.cpu_percent > self.PROCESS_HIGH_CPU:
                issues.append(PerformanceIssue(
                    severity='info',
                    category='process',
                    title=f'High CPU Process: {proc.name}',
                    description=f'{proc.name} is using {proc.cpu_percent}% CPU.',
                    current_value=f'{proc.cpu_percent}% CPU',
                    recommendation=f'Check if {proc.name} is needed or has an issue.',
                    impact='Reduced CPU load'
                ))
                break  # Only show one process issue
        
        report.issues = issues
    
    def _calculate_score(self, report: PerformanceReport):
        """Calculate overall performance score (0-100)."""
        score = 100
        
        # CPU penalty (max -25)
        if report.cpu_percent > 50:
            score -= min(25, (report.cpu_percent - 50) * 0.5)
        
        # Memory penalty (max -30)
        if report.memory_percent > 60:
            score -= min(30, (report.memory_percent - 60) * 0.75)
        
        # Disk penalty (max -25)
        if report.disk_percent > 70:
            score -= min(25, (report.disk_percent - 70) * 0.83)
        
        # Startup programs penalty (max -10)
        if len(report.startup_programs) > 5:
            score -= min(10, len(report.startup_programs) - 5)
        
        # Issue penalties
        for issue in report.issues:
            if issue.severity == 'critical':
                score -= 10
            elif issue.severity == 'warning':
                score -= 5
        
        report.performance_score = max(0, min(100, int(score)))


if __name__ == '__main__':
    diagnoser = PerformanceDiagnoser()
    report = diagnoser.diagnose()
    print(json.dumps(report.to_dict(), indent=2))
