"""
CloudCleaner - Database Module
SQLite database for scan history and user preferences.
"""

import sqlite3
import json
import os
from typing import List, Dict, Optional
from dataclasses import asdict
from pathlib import Path


class Database:
    """SQLite database manager for CloudCleaner."""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize database connection.
        
        Args:
            db_path: Path to database file. Defaults to user's app data directory.
        """
        if db_path is None:
            # Default to user's app data directory
            if os.name == 'nt':  # Windows
                app_data = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
                db_dir = os.path.join(app_data, 'CloudCleaner')
            else:  # macOS/Linux
                db_dir = os.path.expanduser('~/.cloudcleaner')
            
            os.makedirs(db_dir, exist_ok=True)
            db_path = os.path.join(db_dir, 'cloudcleaner.db')
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        """Create database tables if they don't exist."""
        cursor = self.conn.cursor()
        
        # Scan history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                scan_type TEXT NOT NULL,
                total_items INTEGER DEFAULT 0,
                total_size_bytes INTEGER DEFAULT 0,
                duration_seconds REAL DEFAULT 0,
                status TEXT DEFAULT 'completed',
                scan_data TEXT
            )
        ''')
        
        # Cleanup history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cleanup_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER,
                timestamp TEXT NOT NULL,
                items_deleted INTEGER DEFAULT 0,
                items_failed INTEGER DEFAULT 0,
                bytes_freed INTEGER DEFAULT 0,
                deleted_paths TEXT,
                FOREIGN KEY (scan_id) REFERENCES scan_history(id)
            )
        ''')
        
        # User preferences table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Exclusion paths table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exclusions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                added_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.conn.commit()

    def add_scan(self, 
                 scan_type: str,
                 total_items: int,
                 total_size_bytes: int,
                 duration_seconds: float,
                 scan_data: Optional[Dict] = None,
                 status: str = 'completed') -> int:
        """
        Add a scan record to history.
        
        Returns:
            The ID of the inserted scan record.
        """
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO scan_history 
            (timestamp, scan_type, total_items, total_size_bytes, duration_seconds, status, scan_data)
            VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)
        ''', (
            scan_type,
            total_items,
            total_size_bytes,
            duration_seconds,
            status,
            json.dumps(scan_data) if scan_data else None
        ))
        self.conn.commit()
        return cursor.lastrowid

    def add_cleanup(self,
                    scan_id: Optional[int],
                    items_deleted: int,
                    items_failed: int,
                    bytes_freed: int,
                    deleted_paths: Optional[List[str]] = None) -> int:
        """
        Add a cleanup record to history.
        
        Returns:
            The ID of the inserted cleanup record.
        """
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO cleanup_history
            (scan_id, timestamp, items_deleted, items_failed, bytes_freed, deleted_paths)
            VALUES (?, datetime('now'), ?, ?, ?, ?)
        ''', (
            scan_id,
            items_deleted,
            items_failed,
            bytes_freed,
            json.dumps(deleted_paths) if deleted_paths else None
        ))
        self.conn.commit()
        return cursor.lastrowid

    def get_scan_history(self, limit: int = 50) -> List[Dict]:
        """Get recent scan history."""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, timestamp, scan_type, total_items, total_size_bytes, 
                   duration_seconds, status
            FROM scan_history
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]

    def get_cleanup_history(self, limit: int = 50) -> List[Dict]:
        """Get recent cleanup history."""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, scan_id, timestamp, items_deleted, items_failed, bytes_freed
            FROM cleanup_history
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]

    def get_stats(self) -> Dict:
        """Get aggregate statistics."""
        cursor = self.conn.cursor()
        
        # Total scans
        cursor.execute('SELECT COUNT(*) FROM scan_history')
        total_scans = cursor.fetchone()[0]
        
        # Total cleanups and bytes freed
        cursor.execute('''
            SELECT COUNT(*), COALESCE(SUM(bytes_freed), 0), COALESCE(SUM(items_deleted), 0)
            FROM cleanup_history
        ''')
        row = cursor.fetchone()
        total_cleanups = row[0]
        total_bytes_freed = row[1]
        total_items_cleaned = row[2]
        
        return {
            'total_scans': total_scans,
            'total_cleanups': total_cleanups,
            'total_bytes_freed': total_bytes_freed,
            'total_items_cleaned': total_items_cleaned
        }

    def set_preference(self, key: str, value: any):
        """Set a user preference."""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO preferences (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
        ''', (key, json.dumps(value)))
        self.conn.commit()

    def get_preference(self, key: str, default: any = None) -> any:
        """Get a user preference."""
        cursor = self.conn.cursor()
        cursor.execute('SELECT value FROM preferences WHERE key = ?', (key,))
        row = cursor.fetchone()
        if row:
            return json.loads(row[0])
        return default

    def get_all_preferences(self) -> Dict:
        """Get all user preferences."""
        cursor = self.conn.cursor()
        cursor.execute('SELECT key, value FROM preferences')
        return {row[0]: json.loads(row[1]) for row in cursor.fetchall()}

    def add_exclusion(self, path: str) -> bool:
        """Add an exclusion path."""
        try:
            cursor = self.conn.cursor()
            cursor.execute('INSERT INTO exclusions (path) VALUES (?)', (path,))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Already exists

    def remove_exclusion(self, path: str) -> bool:
        """Remove an exclusion path."""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM exclusions WHERE path = ?', (path,))
        self.conn.commit()
        return cursor.rowcount > 0

    def get_exclusions(self) -> List[str]:
        """Get all exclusion paths."""
        cursor = self.conn.cursor()
        cursor.execute('SELECT path FROM exclusions ORDER BY added_at')
        return [row[0] for row in cursor.fetchall()]

    def close(self):
        """Close database connection."""
        self.conn.close()


# Singleton instance
_db_instance: Optional[Database] = None

def get_database() -> Database:
    """Get or create the database singleton."""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance


if __name__ == '__main__':
    # Quick test
    db = get_database()
    print(f"Database path: {db.db_path}")
    
    # Test adding a scan
    scan_id = db.add_scan(
        scan_type='full',
        total_items=100,
        total_size_bytes=1024 * 1024 * 500,
        duration_seconds=5.5
    )
    print(f"Added scan with ID: {scan_id}")
    
    # Test adding a cleanup
    cleanup_id = db.add_cleanup(
        scan_id=scan_id,
        items_deleted=50,
        items_failed=0,
        bytes_freed=1024 * 1024 * 250
    )
    print(f"Added cleanup with ID: {cleanup_id}")
    
    # Get stats
    stats = db.get_stats()
    print(f"Stats: {json.dumps(stats, indent=2)}")
    
    # Get history
    history = db.get_scan_history()
    print(f"Scan history: {json.dumps(history, indent=2)}")
