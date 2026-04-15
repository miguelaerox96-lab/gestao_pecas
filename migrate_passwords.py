"""
Migração de passwords: SHA256 → Bcrypt
Execute com: python migrate_passwords.py
"""
import hashlib
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def sha256_hash(password):
    return hashlib.sha256(password.encode()).hexdigest()

db = SessionLocal()
users = db.query(models.User).all()
migrated = 0

print(f"Encontrados {len(users)} utilizadores.")

for user in users:
    h = user.hashed_password
    # Detect if it's an old SHA256 hash (64 hex chars, not a bcrypt hash)
    if len(h) == 64 and not h.startswith("$2b$"):
        # We can't reverse SHA256, but we know the default dev password
        # Try to match "admin123" and re-hash with bcrypt
        if h == sha256_hash("admin123"):
            user.hashed_password = pwd_context.hash("admin123")
            db.commit()
            print(f"  ✅ '{user.username}': password migrada para bcrypt (password: admin123)")
            migrated += 1
        else:
            print(f"  ⚠️  '{user.username}': hash SHA256 não reconhecido. Redefina a password manualmente.")
    else:
        print(f"  ✓  '{user.username}': já usa bcrypt. Sem alterações.")

db.close()
print(f"\nMigração concluída. {migrated} utilizador(es) atualizado(s).")
