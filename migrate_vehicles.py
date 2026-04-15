import sqlite3

def run_migration():
    conn = sqlite3.connect("autoparts.db")
    cursor = conn.cursor()
    
    # Check if vehicle_id exists in inquiries
    cursor.execute("PRAGMA table_info(inquiries)")
    cols = [c[1] for c in cursor.fetchall()]
    
    if "vehicle_id" not in cols:
        print("Adding vehicle_id to inquiries")
        cursor.execute("ALTER TABLE inquiries ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id)")
    
    # Make part_id nullable? SQLite doesn't support ALTER COLUMN, but if it was created without NOT NULL it might be fine.
    
    # Check if vehicle_id exists in history
    cursor.execute("PRAGMA table_info(history)")
    cols = [c[1] for c in cursor.fetchall()]
    
    if "vehicle_id" not in cols:
        print("Adding vehicle_id to history")
        cursor.execute("ALTER TABLE history ADD COLUMN vehicle_id INTEGER")
        
    conn.commit()
    conn.close()
    print("Migration done.")

if __name__ == "__main__":
    run_migration()
