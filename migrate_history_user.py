import sqlite3
import os

def migrate():
    db_path = "storage/autoparts.db"
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Add 'user' column to 'history' table
        cursor.execute("ALTER TABLE history ADD COLUMN user TEXT")
        print("Column 'user' added to table 'history'.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'user' already exists.")
        else:
            print(f"Error: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
