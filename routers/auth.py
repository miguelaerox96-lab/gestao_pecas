from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
import hashlib
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models, schemas
from database import get_db

# ── Security config ──────────────────────────────────────────────────────────
_SECRET_KEY_ENV = os.getenv("JWT_SECRET_KEY", "")
_INSECURE_DEFAULTS = {"", "supersecretkey_for_autoparts_dev", "SUBSTITUIR_POR_CHAVE_FORTE_DE_64_CARACTERES_HEX"}

if _SECRET_KEY_ENV in _INSECURE_DEFAULTS:
    _env = os.getenv("ENV", "development").lower()
    if _env == "production":
        print("[FATAL] JWT_SECRET_KEY não está definida ou usa o valor padrão inseguro. "
              "Defina a variável de ambiente JWT_SECRET_KEY antes de iniciar em produção.", file=sys.stderr)
        sys.exit(1)
    else:
        print("[AVISO] JWT_SECRET_KEY não definida — a usar chave temporária. "
              "NUNCA usar assim em produção!", file=sys.stderr)
        _SECRET_KEY_ENV = "dev_only_insecure_key_change_in_production"

SECRET_KEY = _SECRET_KEY_ENV
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # 24h padrão

router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password, hashed_password):
    # Support legacy SHA256 hashes (auto-migrated on login)
    if len(hashed_password) == 64 and not hashed_password.startswith("$2b$"):
        return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None: raise credentials_exception
    return user

async def check_admin(user: models.User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return user

async def get_download_admin(
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Auth for file download endpoints: accepts JWT via ?token= query param
    so the browser can open the URL directly and trigger a native download."""
    if not token:
        raise HTTPException(status_code=401, detail="Token em falta")
    exc = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise exc
    except JWTError:
        raise exc
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise exc
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user

@router.get("/me", response_model=schemas.UserMe)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
