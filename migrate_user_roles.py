import sqlite3
import os

db_path = "autoparts.db"

if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Adding 'role' column to 'users' table...")
    cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'")
    conn.commit()
    print("Column added successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column 'role' already exists.")
    else:
        print(f"Error: {e}")
finally:
    conn.close()
