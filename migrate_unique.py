import sqlite3
import os

DB_NAME = 'autoparts.db'

print(f"Starting migration for {DB_NAME}...")

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

try:
    # 1. Start Transaction
    cursor.execute("BEGIN TRANSACTION")

    # 2. Rename existing table to a backup name
    # Note: This will also rename associated indexes in some SQLite versions,
    # but to be safe we will just create the new one and drop the old one.
    cursor.execute("ALTER TABLE parts RENAME TO parts_old")

    # 3. Create the new table with the UniqueConstraint
    cursor.execute("""
    CREATE TABLE parts (
        id INTEGER NOT NULL, 
        part_number VARCHAR, 
        location VARCHAR, 
        type_id INTEGER, 
        brand VARCHAR, 
        model VARCHAR, 
        year VARCHAR, 
        price VARCHAR, 
        show_price BOOLEAN, 
        description VARCHAR, 
        images JSON, 
        status VARCHAR, 
        dynamic_data JSON, 
        PRIMARY KEY (id), 
        FOREIGN KEY(type_id) REFERENCES part_types (id),
        CONSTRAINT _part_number_type_uc UNIQUE (part_number, type_id)
    )
    """)

    # 4. Copy data from the old table to the new one
    cursor.execute("""
    INSERT INTO parts (id, part_number, location, type_id, brand, model, year, price, show_price, description, images, status, dynamic_data)
    SELECT id, part_number, location, type_id, brand, model, year, price, show_price, description, images, status, dynamic_data
    FROM parts_old
    """)

    # 5. Drop the old table (this also drops the old indexes)
    cursor.execute("DROP TABLE parts_old")

    # 6. Recreate indexes for the new table
    cursor.execute("CREATE INDEX ix_parts_id ON parts (id)")
    cursor.execute("CREATE INDEX ix_parts_part_number ON parts (part_number)")

    cursor.execute("COMMIT")
    print("Migration completed successfully. Unique constraint (part_number, type_id) added.")

except Exception as e:
    cursor.execute("ROLLBACK")
    print(f"Migration failed: {e}")
finally:
    conn.close()
