from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_password_hash, check_admin

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=schemas.UserPaginated)
def list_users(page: int = 1, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    limit = 20
    offset = (page - 1) * limit
    total = db.query(models.User).count()
    items = db.query(models.User).offset(offset).limit(limit).all()
    return {"total": total, "items": items}

@router.post("", response_model=schemas.UserResp)
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    if db.query(models.User).filter(models.User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Utilizador já existe")
    
    new_user = models.User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=schemas.UserResp)
def update_user(user_id: int, user_in: schemas.UserUpdate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    if user_in.role: user.role = user_in.role
    if user_in.password: user.hashed_password = get_password_hash(user_in.password)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Não pode apagar-se a si próprio")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    db.delete(user)
    db.commit()
    return {"detail": "Utilizador removido"}
