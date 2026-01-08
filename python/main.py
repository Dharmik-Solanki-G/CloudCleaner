#!/usr/bin/env python3
"""
CloudCleaner - Main CLI Entry Point
Provides command-line interface for scanning and cleaning operations.
Integrates with database for persistent history.
"""

import argparse
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psutil
from cleaners import CacheScanner, Cleaner
from database import get_database
from security import SecurityScanner
from performance import PerformanceDiagnoser


def main():
    parser = argparse.ArgumentParser(
        description='CloudCleaner - AI-powered PC optimization tool',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Commands
    parser.add_argument('--scan', action='store_true', help='Run cache/junk scan')
    parser.add_argument('--clean', action='store_true', help='Execute cleanup')
    parser.add_argument('--quick', action='store_true', help='Quick scan mode')
    parser.add_argument('--history', action='store_true', help='Show scan/cleanup history')
    parser.add_argument('--stats', action='store_true', help='Show aggregate statistics')
    
    # Security and performance commands
    parser.add_argument('--security-scan', action='store_true', help='Run security vulnerability scan')
    parser.add_argument('--performance-scan', action='store_true', help='Run performance diagnosis')
    parser.add_argument('--disk-usage', action='store_true', help='Get disk usage statistics')
    
    # Preference commands
    parser.add_argument('--get-prefs', action='store_true', help='Get all preferences')
    parser.add_argument('--set-pref', nargs=2, metavar=('KEY', 'VALUE'), help='Set a preference')
    parser.add_argument('--get-exclusions', action='store_true', help='Get exclusion paths')
    parser.add_argument('--add-exclusion', type=str, help='Add an exclusion path')
    parser.add_argument('--remove-exclusion', type=str, help='Remove an exclusion path')
    
    # Options
    parser.add_argument('--items', type=str, help='JSON list of paths to clean (for --clean)')
    parser.add_argument('--output', choices=['json', 'text'], default='text', help='Output format')
    parser.add_argument('--use-trash', action='store_true', default=True, help='Move to trash instead of delete')
    parser.add_argument('--scan-id', type=int, help='Associated scan ID for cleanup')
    
    args = parser.parse_args()
    
    if args.scan:
        run_scan(args)
    elif args.clean:
        run_clean(args)
    elif args.history:
        show_history(args)
    elif args.stats:
        show_stats(args)
    elif args.security_scan:
        run_security_scan(args)
    elif args.performance_scan:
        run_performance_scan(args)
    elif args.disk_usage:
        get_disk_usage(args)
    elif args.get_prefs:
        get_preferences(args)
    elif args.set_pref:
        set_preference(args)
    elif args.get_exclusions:
        get_exclusions(args)
    elif args.add_exclusion:
        add_exclusion(args)
    elif args.remove_exclusion:
        remove_exclusion(args)
    else:
        parser.print_help()
        sys.exit(1)


def run_scan(args):
    """Execute a system scan and save to database."""
    scanner = CacheScanner()
    result = scanner.scan(quick_scan=args.quick)
    
    # Save scan to database
    db = get_database()
    scan_id = db.add_scan(
        scan_type='quick' if args.quick else 'full',
        total_items=result.total_items,
        total_size_bytes=result.total_size_bytes,
        duration_seconds=result.scan_duration_seconds,
        scan_data={'categories': result.categories}
    )
    
    if args.output == 'json':
        output = result.to_dict()
        output['scan_id'] = scan_id  # Include DB scan ID
        print(json.dumps(output, indent=2))
    else:
        print("\n" + "=" * 50)
        print("CloudCleaner Scan Results")
        print("=" * 50)
        print(f"\nScan ID: {scan_id}")
        print(f"Total items found: {result.total_items}")
        print(f"Total size: {format_bytes(result.total_size_bytes)}")
        print(f"Scan duration: {result.scan_duration_seconds}s")
        print("\nCategories:")
        for cat, size in result.categories.items():
            print(f"  - {cat}: {format_bytes(size)}")
        print("\nTop 5 largest items:")
        for item in result.items[:5]:
            print(f"  - {item.path}")
            print(f"    Size: {format_bytes(item.size_bytes)}, Risk: {item.risk_level}")
        print()


def run_clean(args):
    """Execute cleanup of specified items and save to database."""
    if not args.items:
        print("Error: --items required for cleanup", file=sys.stderr)
        sys.exit(1)
    
    try:
        paths = json.loads(args.items)
    except json.JSONDecodeError:
        print("Error: Invalid JSON for --items", file=sys.stderr)
        sys.exit(1)
    
    cleaner = Cleaner(use_trash=args.use_trash)
    result = cleaner.execute(paths)
    
    # Save cleanup to database
    db = get_database()
    cleanup_id = db.add_cleanup(
        scan_id=args.scan_id,
        items_deleted=result.items_deleted,
        items_failed=result.items_failed,
        bytes_freed=result.freed_bytes,
        deleted_paths=paths if result.success else None
    )
    
    if args.output == 'json':
        output = result.to_dict()
        output['cleanup_id'] = cleanup_id
        print(json.dumps(output, indent=2))
    else:
        print("\n" + "=" * 50)
        print("CloudCleaner Cleanup Results")
        print("=" * 50)
        print(f"\nCleanup ID: {cleanup_id}")
        print(f"Items deleted: {result.items_deleted}")
        print(f"Items failed: {result.items_failed}")
        print(f"Space freed: {format_bytes(result.freed_bytes)}")
        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  - {error}")
        print()


def show_history(args):
    """Show scan and cleanup history."""
    db = get_database()
    
    if args.output == 'json':
        history = {
            'scans': db.get_scan_history(limit=20),
            'cleanups': db.get_cleanup_history(limit=20)
        }
        print(json.dumps(history, indent=2))
    else:
        print("\n" + "=" * 50)
        print("Scan History (Last 10)")
        print("=" * 50)
        for scan in db.get_scan_history(limit=10):
            print(f"  [{scan['id']}] {scan['timestamp']} - {scan['scan_type']}")
            print(f"      Items: {scan['total_items']}, Size: {format_bytes(scan['total_size_bytes'])}")
        
        print("\n" + "=" * 50)
        print("Cleanup History (Last 10)")
        print("=" * 50)
        for cleanup in db.get_cleanup_history(limit=10):
            print(f"  [{cleanup['id']}] {cleanup['timestamp']}")
            print(f"      Deleted: {cleanup['items_deleted']}, Freed: {format_bytes(cleanup['bytes_freed'])}")
        print()


def show_stats(args):
    """Show aggregate statistics."""
    db = get_database()
    stats = db.get_stats()
    
    if args.output == 'json':
        print(json.dumps(stats, indent=2))
    else:
        print("\n" + "=" * 50)
        print("CloudCleaner Statistics")
        print("=" * 50)
        print(f"\nTotal scans performed: {stats['total_scans']}")
        print(f"Total cleanups performed: {stats['total_cleanups']}")
        print(f"Total space freed: {format_bytes(stats['total_bytes_freed'])}")
        print(f"Total items cleaned: {stats['total_items_cleaned']}")
        print()


def get_preferences(args):
    """Get all user preferences."""
    db = get_database()
    prefs = db.get_all_preferences()
    
    if args.output == 'json':
        print(json.dumps(prefs, indent=2))
    else:
        print("\n" + "=" * 50)
        print("User Preferences")
        print("=" * 50)
        for key, value in prefs.items():
            print(f"  {key}: {value}")
        print()


def set_preference(args):
    """Set a user preference."""
    db = get_database()
    key, value = args.set_pref
    
    # Try to parse value as JSON (for booleans, numbers, etc.)
    try:
        parsed_value = json.loads(value.lower() if value.lower() in ['true', 'false'] else value)
    except json.JSONDecodeError:
        parsed_value = value
    
    db.set_preference(key, parsed_value)
    
    if args.output == 'json':
        print(json.dumps({'success': True, 'key': key, 'value': parsed_value}))
    else:
        print(f"Preference '{key}' set to: {parsed_value}")


def get_exclusions(args):
    """Get all exclusion paths."""
    db = get_database()
    exclusions = db.get_exclusions()
    
    if args.output == 'json':
        print(json.dumps({'exclusions': exclusions}))
    else:
        print("\n" + "=" * 50)
        print("Exclusion Paths")
        print("=" * 50)
        for path in exclusions:
            print(f"  - {path}")
        print()


def add_exclusion(args):
    """Add an exclusion path."""
    db = get_database()
    success = db.add_exclusion(args.add_exclusion)
    
    if args.output == 'json':
        print(json.dumps({'success': success, 'path': args.add_exclusion}))
    else:
        if success:
            print(f"Added exclusion: {args.add_exclusion}")
        else:
            print(f"Exclusion already exists: {args.add_exclusion}")


def remove_exclusion(args):
    """Remove an exclusion path."""
    db = get_database()
    success = db.remove_exclusion(args.remove_exclusion)
    
    if args.output == 'json':
        print(json.dumps({'success': success, 'path': args.remove_exclusion}))
    else:
        if success:
            print(f"Removed exclusion: {args.remove_exclusion}")
        else:
            print(f"Exclusion not found: {args.remove_exclusion}")


def run_security_scan(args):
    """Run a security vulnerability scan."""
    scanner = SecurityScanner(max_files=500)
    result = scanner.scan()
    
    if args.output == 'json':
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print("\n" + "=" * 50)
        print("CloudCleaner Security Scan Results")
        print("=" * 50)
        print(f"\nTotal findings: {result.total_findings}")
        print(f"Scan duration: {result.scan_duration_seconds}s")
        
        if result.severity_counts:
            print("\nBy Severity:")
            for severity, count in result.severity_counts.items():
                if count > 0:
                    print(f"  - {severity.upper()}: {count}")
        
        if result.findings:
            print("\nFindings:")
            for finding in result.findings[:10]:
                icon = "🔴" if finding.severity in ['critical', 'high'] else "🟡" if finding.severity == 'medium' else "🔵"
                print(f"\n  {icon} [{finding.severity.upper()}] {finding.title}")
                print(f"     {finding.description}")
                print(f"     Path: {finding.path}")
                if finding.recommendation:
                    print(f"     Fix: {finding.recommendation}")
        print()


def run_performance_scan(args):
    """Run a performance diagnosis scan."""
    diagnoser = PerformanceDiagnoser()
    report = diagnoser.diagnose()
    
    if args.output == 'json':
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print("\n" + "=" * 50)
        print("CloudCleaner Performance Report")
        print("=" * 50)
        print(f"\nPerformance Score: {report.performance_score}/100")
        print(f"\nSystem Metrics:")
        print(f"  CPU: {report.cpu_percent}% ({report.cpu_count} cores)")
        print(f"  Memory: {report.memory_used_gb}GB / {report.memory_total_gb}GB ({report.memory_percent}%)")
        print(f"  Disk: {report.disk_used_gb}GB / {report.disk_total_gb}GB ({report.disk_percent}%)")
        
        if report.startup_programs:
            print(f"\nStartup Programs: {len(report.startup_programs)}")
            for prog in report.startup_programs[:5]:
                print(f"  - {prog}")
        
        if report.issues:
            print("\nIssues Found:")
            for issue in report.issues:
                icon = "🔴" if issue.severity == 'critical' else "🟡" if issue.severity == 'warning' else "🔵"
                print(f"\n  {icon} [{issue.severity.upper()}] {issue.title}")
                print(f"     {issue.description}")
                print(f"     Recommendation: {issue.recommendation}")
        
        if report.top_memory_processes:
            print("\nTop Memory Consumers:")
            for proc in report.top_memory_processes[:3]:
                print(f"  - {proc.name}: {proc.memory_mb:.0f} MB")
        print()


def format_bytes(bytes_val: int) -> str:
    """Format bytes to human-readable string."""
    if bytes_val == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    size = float(bytes_val)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.1f} {units[unit_index]}"



def get_disk_usage(args):
    """Get disk usage statistics."""
    try:
        # Get usage for the drive where the script is running
        usage = psutil.disk_usage(os.path.abspath(os.sep))
        result = {
            'total': usage.total,
            'used': usage.used,
            'free': usage.free,
            'percent': usage.percent
        }
    except Exception as e:
        result = {
            'error': str(e),
            'total': 0,
            'used': 0,
            'free': 0
        }
    
    if args.output == 'json':
        print(json.dumps(result))
    else:
        print(f"Total: {result['total']}")
        print(f"Used: {result['used']}")
        print(f"Free: {result['free']}")


if __name__ == '__main__':
    main()


