import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'budget.db')

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT,
            description TEXT,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()

# ── USER əməliyyatları ──────────────────────────────────────────────────────

def create_user(username, hashed_password):
    conn = get_connection()
    try:
        conn.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            (username, hashed_password)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_connection()
    user = conn.execute(
        'SELECT * FROM users WHERE username = ?', (username,)
    ).fetchone()
    conn.close()
    return user

# ── TRANSACTION əməliyyatları ───────────────────────────────────────────────

def add_transaction(user_id, type_, amount, category, description, date):
    conn = get_connection()
    conn.execute(
        '''INSERT INTO transactions (user_id, type, amount, category, description, date)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (user_id, type_, amount, category, description, date)
    )
    conn.commit()
    conn.close()

def get_transactions(user_id):
    conn = get_connection()
    rows = conn.execute(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC',
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_transaction(transaction_id, user_id):
    conn = get_connection()
    conn.execute(
        'DELETE FROM transactions WHERE id = ? AND user_id = ?',
        (transaction_id, user_id)
    )
    conn.commit()
    conn.close()

def get_balance(user_id):
    conn = get_connection()
    row = conn.execute(
        '''SELECT
               COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS total_income,
               COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS total_expense
           FROM transactions WHERE user_id = ?''',
        (user_id,)
    ).fetchone()
    conn.close()
    income  = row['total_income']
    expense = row['total_expense']
    return {'income': income, 'expense': expense, 'balance': income - expense}

def get_monthly_report(user_id):
    conn = get_connection()
    rows = conn.execute(
        '''SELECT strftime('%Y-%m', date) AS month,
               SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
           FROM transactions WHERE user_id = ?
           GROUP BY month ORDER BY month DESC''',
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
