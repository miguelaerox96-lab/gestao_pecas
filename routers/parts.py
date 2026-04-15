from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import models, schemas
from database import get_db
from routers.auth import get_current_user, check_admin
from utils import generate_part_search_index

router = APIRouter(prefix="/parts", tags=["parts"])

@router.get("", response_model=schemas.PartPaginated)
def get_parts(
    status: Optional[str] = None, 
    brand: Optional[str] = None,
    type_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0, 
    limit: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(models.Part)
    if status:
        query = query.filter(models.Part.status == status)
    if brand:
        query = query.filter(models.Part.brand == brand)
    if type_id:
        query = query.filter(models.Part.type_id == type_id)
    if search:
        search_filter = f"%{search}%"
        # OPTIMIZATION: Use the unified search_index column instead of casting JSON and chaining ORs
        query = query.filter(models.Part.search_index.ilike(search_filter))
    
    total = query.count()
    items = query.order_by(models.Part.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

@router.get("/stats")
def get_parts_stats(db: Session = Depends(get_db)):
    total = db.query(models.Part).count()
    available = db.query(models.Part).filter(models.Part.status == "Available").count()
    empty = db.query(models.Part).filter(models.Part.status == "EmptySlot").count()
    sold = db.query(models.Part).filter(models.Part.status == "Sold").count()
    return {
        "total": total,
        "available": available,
        "empty": empty,
        "sold": sold
    }

@router.get("/{part_id}", response_model=schemas.PartResp)
def get_part_public(part_id: int, db: Session = Depends(get_db)):
    """Public endpoint to fetch a single available part by ID (used for share links)."""
    part = db.query(models.Part).filter(
        models.Part.id == part_id,
        models.Part.status == "Available"
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Peça não encontrada ou indisponível")
    return part

@router.post("", response_model=schemas.PartResp)
def create_part(part_in: schemas.PartCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check composite unique key (part_number + type_id)
    existing = db.query(models.Part).filter(
        models.Part.part_number == part_in.part_number,
        models.Part.type_id == part_in.type_id
    ).first()

    if existing:
        if existing.status == "EmptySlot":
            # REUSE SLOT (RESTOCK)
            update_data = part_in.dict()
            for k, v in update_data.items():
                setattr(existing, k, v)
            existing.status = "Available"
            existing.search_index = generate_part_search_index(existing)
            
            history = models.HistoryRecord(part_id=existing.id, action="Restocked", price_at_action=part_in.price, user=current_user.username)
            db.add(history)
            db.commit()
            db.refresh(existing)
            return existing
        else:
            raise HTTPException(status_code=400, detail=f"O número de peça '{part_in.part_number}' já existe e está disponível em stock.")

    db_part = models.Part(**part_in.dict(), status="Available")
    db_part.search_index = generate_part_search_index(db_part)
    db.add(db_part)
    db.flush()
    
    # History
    history = models.HistoryRecord(part_id=db_part.id, action="Created", price_at_action=part_in.price, user=current_user.username)
    db.add(history)
    db.commit()
    db.refresh(db_part)
    return db_part

@router.put("/{part_id}", response_model=schemas.PartResp)
def update_part(part_id: int, part_in: schemas.PartUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part: raise HTTPException(status_code=404, detail="Not found")
    
    update_data = part_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_part, k, v)
    
    db_part.search_index = generate_part_search_index(db_part)
    
    db.commit()
    db.refresh(db_part)
    return db_part

@router.post("/{part_id}/baixa", response_model=schemas.PartResp)
def baixa_part(part_id: int, baja_in: schemas.PartBaixa, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import json
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part: raise HTTPException(status_code=404, detail="Not found")
    if db_part.status != "Available": raise HTTPException(status_code=400, detail="Only Available parts can be checked out")

    # History with snapshot metadata
    details_data = {
        "brand": db_part.brand,
        "model": db_part.model,
        "type_id": db_part.type_id,
        "type_name": db_part.part_type.name if db_part.part_type else "Desconhecido",
        "baixa_reason": baja_in.action
    }
    
    # Use sale_price if provided, else use current price if it's a sale
    recorded_price = baja_in.sale_price if baja_in.sale_price is not None else db_part.price
    
    history_action = "Sold" if baja_in.action == "venda" else "Removed"
    
    history = models.HistoryRecord(
        part_id=db_part.id, 
        action=history_action, 
        price_at_action=recorded_price if history_action == "Sold" else None,
        details=json.dumps(details_data),
        user=current_user.username
    )
    db.add(history)

    # Empty specific fields, keep 'keep_on_baixa' dynamic fields
    db_part.brand = None
    db_part.model = None
    db_part.year = None
    db_part.price = None
    db_part.description = None
    # Physical deletion of images
    if db_part.images:
        import os
        for img_path in db_part.images:
            full_path = f"storage/{os.path.basename(img_path)}"
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception as e:
                    print(f"Error deleting image {full_path}: {e}")

    db_part.images = []
    db_part.status = "EmptySlot"
    
    # Filter dynamic_data based on type_fields keep_on_baixa
    new_dynamic_data = {}
    type_fields = db.query(models.TypeField).filter(models.TypeField.part_type_id == db_part.type_id).all()
    for f in type_fields:
        if f.keep_on_baixa and f.name in db_part.dynamic_data:
            new_dynamic_data[f.name] = db_part.dynamic_data[f.name]
    db_part.dynamic_data = new_dynamic_data
    db_part.search_index = generate_part_search_index(db_part)

    db.commit()
    db.refresh(db_part)
    return db_part

@router.delete("/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    current_user = admin # for history consistency
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_part)
    history = models.HistoryRecord(part_id=part_id, action="Deleted", user=current_user.username)
    db.add(history)
    db.commit()
    return {"ok": True}
