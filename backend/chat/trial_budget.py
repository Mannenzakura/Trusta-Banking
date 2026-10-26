"""Conservative, persistent reservation BEFORE a DeepSeek trial request. Never auto-refills.

2026-10-26 Flash peak price: $0.30/M input, $1.20/M output. Reserve at
20 CNY/USD, count each UTF-8 request byte as an input token plus overhead.
Reservations are never refunded on timeout. This is a safety estimate, not a bill.
"""
import sqlite3
from contextlib import closing
import time
from pathlib import Path


def reserve(path, input_bytes, output_tokens, limit=1_000_000, now=None):
    now = time.time() if now is None else now
    if not 0 < limit <= 1_000_000:
        raise ValueError('Invalid trial ceiling')
    cost = (input_bytes + 2048) * 6 + output_tokens * 24
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=5)) as db, db:
        db.execute('CREATE TABLE IF NOT EXISTS budget(id INTEGER PRIMARY KEY, reserved INTEGER, ceiling INTEGER, expires REAL)')
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR IGNORE INTO budget VALUES(1,0,?,?)', (limit, now + 86400))
        used, ceiling, expires = db.execute('SELECT reserved,ceiling,expires FROM budget WHERE id=1').fetchone()
        if now >= expires or used + cost > min(ceiling, limit):
            return False
        db.execute('UPDATE budget SET reserved=reserved+? WHERE id=1', (cost,))
    return True
