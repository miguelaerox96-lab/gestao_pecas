import sqlite3
import models
from database import SessionLocal
from utils import generate_part_search_index, generate_vehicle_search_index

def run_migration():
    # 1. Ensure columns exist in SQLite (Manual ALTER TABLE)
    conn = sqlite3.connect('storage/autoparts.db')
    cursor = conn.cursor()
    
    print("Checking database schema...")
    try:
        cursor.execute("ALTER TABLE parts ADD COLUMN search_index TEXT")
        print("Column 'search_index' added to 'parts' table.")
    except sqlite3.OperationalError:
        print("Column 'search_index' already exists in 'parts' table.")

    try:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN search_index TEXT")
        print("Column 'search_index' added to 'vehicles' table.")
    except sqlite3.OperationalError:
        print("Column 'search_index' already exists in 'vehicles' table.")
    
    conn.commit()
    conn.close()

    # 2. Populate data using SQLAlchemy
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import database

    # Re-initialize engine to refresh metadata view
    # We use the URL from database.py but if we're running in root, we might need to adjust
    db_url = database.DATABASE_URL
    if db_url.startswith("sqlite:///./storage/"):
        # If we are running from root and the URL is relative to ./storage/
        pass 

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocalMigration = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocalMigration()
    try:
        print("Populating search_index for parts...")
        parts = db.query(models.Part).all()
        for p in parts:
            p.search_index = generate_part_search_index(p)
        
        print(f"Updated {len(parts)} parts.")

        print("Populating search_index for vehicles...")
        vehicles = db.query(models.Vehicle).all()
        for v in vehicles:
            v.search_index = generate_vehicle_search_index(v)
        
        print(f"Updated {len(vehicles)} vehicles.")

        db.commit()
        print("Migration completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during data population: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
