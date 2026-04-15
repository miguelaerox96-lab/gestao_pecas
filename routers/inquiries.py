from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
import models, schemas
import os, time
from database import get_db
from routers.auth import get_current_user

router = APIRouter(tags=["inquiries"])

# ── Rate limiting simples (sem dependências externas) ─────────────────────────
# Guarda timestamps de pedidos por IP. Limpa automaticamente entradas antigas.
_inquiry_log: dict[str, list[float]] = {}
_RATE_LIMIT = int(os.getenv("INQUIRY_RATE_LIMIT", "5"))   # pedidos máximos
_RATE_WINDOW = 60                                           # segundos

def _check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - _RATE_WINDOW

    # Limpa entradas fora da janela
    _inquiry_log[ip] = [t for t in _inquiry_log.get(ip, []) if t > window_start]

    if len(_inquiry_log[ip]) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados pedidos. Por favor aguarde antes de tentar novamente."
        )
    _inquiry_log[ip].append(now)

@router.post("/public/inquiry", response_model=schemas.InquiryResp)
def create_inquiry(request: Request, inq_in: schemas.InquiryCreate, db: Session = Depends(get_db)):
    _check_rate_limit(request)
    db_inq = models.Inquiry(**inq_in.dict())
    db.add(db_inq)
    db.commit()
    db.refresh(db_inq)
    return db_inq


@router.get("/inquiries", response_model=List[schemas.InquiryResp])
def get_inquiries(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Inquiry).order_by(models.Inquiry.created_at.desc()).all()

@router.put("/inquiries/{inq_id}", response_model=schemas.InquiryResp)
def update_inquiry(inq_id: int, inq_in: schemas.InquiryUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_inq = db.query(models.Inquiry).filter(models.Inquiry.id == inq_id).first()
    if not db_inq: raise HTTPException(status_code=404, detail="Not found")
    db_inq.status = inq_in.status
    db.commit()
    db.refresh(db_inq)
    return db_inq

@router.delete("/inquiries/{inq_id}")
def delete_inquiry(inq_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_inq = db.query(models.Inquiry).filter(models.Inquiry.id == inq_id).first()
    if not db_inq: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_inq)
    db.commit()
    return {"ok": True}
