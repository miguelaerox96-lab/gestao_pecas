import os
import json
from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user, check_admin

router = APIRouter(tags=["config"])

BRANDING_FILE = "branding.json"
DEFAULT_BRANDING = {"name": "Auto Parts Stock", "subtitle": "Peças Automóveis Usadas", "logo_url": None}

def read_branding() -> dict:
    if os.path.exists(BRANDING_FILE):
        with open(BRANDING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_BRANDING.copy()

def write_branding(data: dict):
    with open(BRANDING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# --- BRANDS ---
@router.get("/brands", response_model=List[schemas.BrandResp])
def get_brands(db: Session = Depends(get_db)):
    return db.query(models.Brand).order_by(models.Brand.name).all()

@router.post("/brands", response_model=schemas.BrandResp)
def create_brand(brand_in: schemas.BrandCreate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_brand = models.Brand(name=brand_in.name)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

@router.delete("/brands/{brand_id}")
def delete_brand(brand_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_brand)
    db.commit()
    return {"ok": True}

@router.put("/brands/{brand_id}", response_model=schemas.BrandResp)
def update_brand(brand_id: int, brand_in: schemas.BrandUpdate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand: raise HTTPException(status_code=404, detail="Not found")
    
    old_name = db_brand.name
    new_name = brand_in.name.strip()
    
    db_brand.name = new_name
    db.query(models.Part).filter(models.Part.brand == old_name).update({"brand": new_name})
    
    db.commit()
    db.refresh(db_brand)
    return db_brand

# --- LOCATIONS ---
@router.get("/locations", response_model=List[schemas.LocationResp])
def get_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).order_by(models.Location.name).all()

@router.post("/locations", response_model=schemas.LocationResp)
def create_location(loc_in: schemas.LocationCreate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_loc = models.Location(name=loc_in.name)
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    return db_loc

@router.delete("/locations/{loc_id}")
def delete_location(loc_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not db_loc: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_loc)
    db.commit()
    return {"ok": True}

@router.put("/locations/{loc_id}", response_model=schemas.LocationResp)
def update_location(loc_id: int, loc_in: schemas.LocationUpdate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_loc = db.query(models.Location).filter(models.Location.id == loc_id).first()
    if not db_loc: raise HTTPException(status_code=404, detail="Not found")
    
    old_name = db_loc.name
    new_name = loc_in.name.strip()
    
    # 1. Update the location name itself
    db_loc.name = new_name
    
    # 2. Update all parts that were using the old name
    # Since we use String association, we must update all entries manually
    db.query(models.Part).filter(models.Part.location == old_name).update({"location": new_name})
    
    db.commit()
    db.refresh(db_loc)
    return db_loc

# --- PART TYPES ---
@router.get("/types", response_model=List[schemas.PartTypeResp])
def get_types(db: Session = Depends(get_db)):
    return db.query(models.PartType).order_by(models.PartType.name).all()

@router.post("/types", response_model=schemas.PartTypeResp)
def create_type(type_in: schemas.PartTypeCreate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_type = models.PartType(name=type_in.name)
    db.add(db_type)
    db.flush()
    for f in type_in.fields:
        db_field = models.TypeField(
            part_type_id=db_type.id, 
            name=f.name, 
            field_type=f.field_type, 
            options=f.options, 
            keep_on_baixa=f.keep_on_baixa,
            required_field=f.required_field
        )
        db.add(db_field)
    db.commit()
    db.refresh(db_type)
    return db_type

@router.delete("/types/{type_id}")
def delete_type(type_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_type = db.query(models.PartType).filter(models.PartType.id == type_id).first()
    if not db_type: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_type)
    db.commit()
    return {"ok": True}

@router.put("/types/{type_id}", response_model=schemas.PartTypeResp)
def update_type(type_id: int, type_in: schemas.PartTypeCreate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    db_type = db.query(models.PartType).filter(models.PartType.id == type_id).first()
    if not db_type: raise HTTPException(status_code=404, detail="Not found")
    db_type.name = type_in.name
    for f in db_type.fields:
        db.delete(f)
    db.flush()
    for f in type_in.fields:
        db_field = models.TypeField(
            part_type_id=db_type.id, 
            name=f.name, 
            field_type=f.field_type, 
            options=f.options, 
            keep_on_baixa=f.keep_on_baixa,
            required_field=f.required_field
        )
        db.add(db_field)
    db.commit()
    db.refresh(db_type)
    return db_type

# --- BRANDING ---
@router.get("/branding")
def get_branding():
    return read_branding()

@router.put("/branding")
def update_branding(name: str = Form(...), subtitle: str = Form(""), admin: models.User = Depends(check_admin)):
    data = read_branding()
    data["name"] = name.strip()
    data["subtitle"] = subtitle.strip()
    write_branding(data)
    return data

@router.delete("/branding/logo")
def delete_logo(admin: models.User = Depends(check_admin)):
    data = read_branding()
    if data.get("logo_url"):
        logo_path = data["logo_url"].lstrip("/")
        if os.path.exists(logo_path):
            os.remove(logo_path)
    data["logo_url"] = None
    write_branding(data)
    return {"ok": True}
