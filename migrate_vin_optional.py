"""
Migration: make vehicles.vin optional (remove UNIQUE, allow NULL)
SQLite does not support ALTER COLUMN so we recreate the table.
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "auto_parts.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.executescript("""
PRAGMA foreign_keys = OFF;

-- Create new table without UNIQUE on vin
CREATE TABLE IF NOT EXISTS vehicles_new (
    id INTEGER PRIMARY KEY,
    vin VARCHAR,
    make VARCHAR,
    model VARCHAR,
    year VARCHAR,
    vehicle_type VARCHAR,
    price VARCHAR,
    show_price BOOLEAN DEFAULT 1,
    description VARCHAR,
    engine VARCHAR,
    mileage VARCHAR,
    images JSON,
    status VARCHAR DEFAULT 'Available',
    search_index VARCHAR
);

-- Copy all data
INSERT INTO vehicles_new SELECT id, vin, make, model, year, vehicle_type, price,
    show_price, description, engine, mileage, images, status, search_index
FROM vehicles;

-- Swap tables
DROP TABLE vehicles;
ALTER TABLE vehicles_new RENAME TO vehicles;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS ix_vehicles_id ON vehicles(id);
CREATE INDEX IF NOT EXISTS ix_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS ix_vehicles_model ON vehicles(model);
CREATE INDEX IF NOT EXISTS ix_vehicles_vehicle_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS ix_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS ix_vehicles_search_index ON vehicles(search_index);

PRAGMA foreign_keys = ON;
""")

conn.commit()
conn.close()
print("✅ Migração concluída: vin é agora opcional (sem UNIQUE).")
