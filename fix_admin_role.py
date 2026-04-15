import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def fix_admin():
    conn = sqlite3.connect("storage/autoparts.db")
    cursor = conn.cursor()
    
    # Check current users
    cursor.execute("SELECT id, username, role FROM users")
    users = cursor.fetchall()
    print("Current users in DB:", users)
    
    # Ensure 'admin' exists with role 'admin' and password 'admin'
    admin_exists = any(u[1] == 'admin' for u in users)
    hashed_password = pwd_context.hash("admin")
    
    if admin_exists:
        print("Updating existing admin user...")
        cursor.execute("UPDATE users SET role='admin', hashed_password=? WHERE username='admin'", (hashed_password,))
    else:
        print("Creating new admin user...")
        cursor.execute("INSERT INTO users (username, hashed_password, role) VALUES (?, ?, ?)", ("admin", hashed_password, "admin"))
    
    conn.commit()
    conn.close()
    print("Admin user fixed/created successfully.")

if __name__ == "__main__":
    fix_admin()
