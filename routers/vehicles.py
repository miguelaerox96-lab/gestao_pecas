from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import json
import models, schemas
from database import get_db
from routers.auth import get_current_user, check_admin
from utils import generate_vehicle_search_index

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

@router.get("", response_model=schemas.VehiclePaginated)
def get_vehicles(
    status: Optional[str] = None, 
    vehicle_type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, 
    limit: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(models.Vehicle)
    if status:
        query = query.filter(models.Vehicle.status == status)
    if vehicle_type:
        query = query.filter(models.Vehicle.vehicle_type == vehicle_type)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(models.Vehicle.search_index.ilike(search_filter))
    
    total = query.count()
    items = query.order_by(models.Vehicle.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

@router.get("/stats")
def get_vehicles_stats(db: Session = Depends(get_db)):
    total = db.query(models.Vehicle).count()
    para_pecas = db.query(models.Vehicle).filter(models.Vehicle.vehicle_type == "Para Peças").count()
    salvados = db.query(models.Vehicle).filter(models.Vehicle.vehicle_type == "Salvado").count()
    return {
        "total": total,
        "para_pecas": para_pecas,
        "salvados": salvados
    }

@router.post("", response_model=schemas.VehicleResp)
def create_vehicle(vehicle_in: schemas.VehicleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_vehicle = models.Vehicle(**vehicle_in.dict(), status="Available")
    db_vehicle.search_index = generate_vehicle_search_index(db_vehicle)
    db.add(db_vehicle)
    db.flush()
    history = models.HistoryRecord(vehicle_id=db_vehicle.id, action="Created", price_at_action=vehicle_in.price, user=current_user.username)
    db.add(history)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@router.put("/{vehicle_id}", response_model=schemas.VehicleResp)
def update_vehicle(vehicle_id: int, vehicle_in: schemas.VehicleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not db_vehicle: raise HTTPException(status_code=404, detail="Not found")
    update_data = vehicle_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(db_vehicle, k, v)
    db_vehicle.search_index = generate_vehicle_search_index(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@router.post("/{vehicle_id}/baixa", response_model=schemas.VehicleResp)
def baixa_vehicle(vehicle_id: int, baja_in: schemas.PartBaixa, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not db_vehicle: raise HTTPException(status_code=404, detail="Not found")
    if db_vehicle.status != "Available": raise HTTPException(status_code=400, detail="Only Available vehicles can be checked out")

    details_data = {
        "make": db_vehicle.make,
        "model": db_vehicle.model,
        "vin": db_vehicle.vin,
        "vehicle_type": db_vehicle.vehicle_type,
        "baixa_reason": baja_in.action
    }
    recorded_price = baja_in.sale_price if baja_in.sale_price is not None else db_vehicle.price
    history_action = "Sold" if baja_in.action == "venda" else "Removed"

    history = models.HistoryRecord(
        vehicle_id=db_vehicle.id, 
        action=history_action, 
        price_at_action=recorded_price if history_action == "Sold" else None,
        details=json.dumps(details_data),
        user=current_user.username
    )
    db.add(history)
    db_vehicle.status = "Sold" if baja_in.action == "venda" else "Removed"
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    current_user = admin # for history consistency
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not db_vehicle: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_vehicle)
    history = models.HistoryRecord(vehicle_id=vehicle_id, action="Deleted", user=current_user.username)
    db.add(history)
    db.commit()
    return {"ok": True}
