from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import models
from database import get_db

from routers.auth import check_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_analytics_dashboard(days: int = 30, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # 1. Total Sales and Revenue in period
    sold_records = db.query(models.HistoryRecord).filter(
        models.HistoryRecord.action == "Sold",
        models.HistoryRecord.timestamp >= cutoff
    ).all()
    
    # 2. Daily Sales Trend
    daily_sales = {}
    for i in range(days + 1):
        d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_sales[d] = 0

    brand_counts = {}
    brand_revenue = {}
    category_counts = {}
    sales_by_type = {"Peças": 0, "Veículos": 0}
    total_revenue = 0.0
    
    for r in sold_records:
        date_str = r.timestamp.strftime("%Y-%m-%d")
        daily_sales[date_str] = daily_sales.get(date_str, 0) + 1
        
        # Type tracking
        stype = "Peças" if r.part_id else "Veículos"
        sales_by_type[stype] += 1
        
        try:
            val = float(r.price_at_action) if r.price_at_action else 0.0
            total_revenue += val
            
            if r.details:
                det = json.loads(r.details)
                b = det.get("brand") or "Sem Marca"
                c = det.get("type_name") or "Desconhecido"
                
                brand_counts[b] = brand_counts.get(b, 0) + 1
                brand_revenue[b] = brand_revenue.get(b, 0.0) + val
                category_counts[c] = category_counts.get(c, 0) + 1
        except: pass
        
    sorted_days = sorted(daily_sales.keys())
    chart_data = [{"date": d, "count": daily_sales[d]} for d in sorted_days]
    
    top_brands = sorted(brand_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Top Brands by Revenue
    top_revenue_brands = sorted(brand_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
    
    recent_sales = []
    for r in sold_records:
        recent_sales.append({
            "timestamp": r.timestamp.isoformat(),
            "id": r.part_id or r.vehicle_id,
            "type": "Peça" if r.part_id else "Veículo",
            "price": r.price_at_action,
            "user": r.user or "Sistema"
        })

    return {
        "days_interval": days,
        "total_sales": len(sold_records),
        "total_revenue": total_revenue,
        "daily_sales": chart_data,
        "sales_by_type": [{"name": k, "value": v} for k, v in sales_by_type.items()],
        "top_brands": [{"name": k, "count": v} for k, v in top_brands],
        "top_revenue_brands": [{"name": k, "revenue": v} for k, v in top_revenue_brands],
        "top_categories": [{"name": k, "count": v} for k, v in top_categories],
        "recent_sales": recent_sales
    }

@router.get("/sales")
def get_sales_paginated(
    skip: int = 0, 
    limit: int = 20, 
    q: str = None, 
    start_date: str = None, 
    end_date: str = None,
    db: Session = Depends(get_db), 
    admin: models.User = Depends(check_admin)
):
    query = db.query(models.HistoryRecord).filter(models.HistoryRecord.action == "Sold")
    
    if q:
        query = query.filter(models.HistoryRecord.details.contains(q))
        
    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date)
            query = query.filter(models.HistoryRecord.timestamp >= dt_start)
        except: pass

    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date)
            # If it's just a date YYYY-MM-DD, we want to include that whole day
            if len(end_date) == 10:
                dt_end = dt_end.replace(hour=23, minute=59, second=59)
            query = query.filter(models.HistoryRecord.timestamp <= dt_end)
        except: pass
        
    total = query.count()
    records = query.order_by(models.HistoryRecord.timestamp.desc()).offset(skip).limit(limit).all()
    
    items = []
    for r in records:
        details = {}
        try:
            if r.details: details = json.loads(r.details)
        except: pass
        
        items.append({
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "item_id": r.part_id or r.vehicle_id,
            "type": "Peça" if r.part_id else "Veículo",
            "price": r.price_at_action,
            "user": r.user or "Sistema",
            "brand": details.get("brand") or "",
            "model": details.get("model") or "",
            "year": details.get("year") or "",
            "cat": details.get("type_name") or ""
        })
        
    return {"total": total, "items": items}

@router.delete("/history/{record_id}")
def delete_history_record(record_id: int, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    from fastapi import HTTPException
    rec = db.query(models.HistoryRecord).filter(models.HistoryRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    db.delete(rec)
    db.commit()
    return {"detail": "Registo removido"}

@router.delete("/history/range/delete")
def delete_history_range(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    from fastapi import HTTPException
    try:
        dt_start = datetime.fromisoformat(start_date)
        dt_end   = datetime.fromisoformat(end_date)
        if len(end_date) == 10:
            dt_end = dt_end.replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido (use YYYY-MM-DD)")
    if dt_start > dt_end:
        raise HTTPException(status_code=400, detail="Data de início deve ser anterior à data de fim")
    deleted = db.query(models.HistoryRecord).filter(
        models.HistoryRecord.timestamp >= dt_start,
        models.HistoryRecord.timestamp <= dt_end
    ).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted, "detail": f"{deleted} registo(s) eliminado(s)"}

@router.get("/history")
def get_audit_trail(
    skip: int = 0,
    limit: int = 20,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    query = db.query(models.HistoryRecord)

    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date)
            query = query.filter(models.HistoryRecord.timestamp >= dt_start)
        except: pass

    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date)
            if len(end_date) == 10:
                dt_end = dt_end.replace(hour=23, minute=59, second=59)
            query = query.filter(models.HistoryRecord.timestamp <= dt_end)
        except: pass

    total = query.count()
    records = query.order_by(models.HistoryRecord.timestamp.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": records}
