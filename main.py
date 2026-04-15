import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
from database import engine, get_db
import bulk
from routers import auth, parts, vehicles, config, analytics, inquiries, storage, users

app = FastAPI(title="AutoParts Management API")
os.makedirs("storage", exist_ok=True)

# Create tables
models.Base.metadata.create_all(bind=engine)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=ALLOWED_ORIGINS, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# INIT DB helper
def init_db(db: Session):
    import sys
    from routers.auth import get_password_hash
    if not db.query(models.User).first():
        _admin_pass = os.getenv("ADMIN_DEFAULT_PASSWORD", "")
        if not _admin_pass:
            _admin_pass = "admin123"
            print("[AVISO] ADMIN_DEFAULT_PASSWORD não definida — a usar 'admin123'. "
                  "Mude a password IMEDIATAMENTE após o primeiro login!", file=sys.stderr)
        admin = models.User(
            username="admin",
            hashed_password=get_password_hash(_admin_pass),
            role="admin"
        )
        db.add(admin)
        
        brands = [
            "Alfa Romeo", "Audi", "BMW", "Chevrolet", "Chrysler", "Citroen", "Dacia", "Daewoo",
            "Dodge", "Fiat", "Ford", "Honda", "Hyundai", "Isuzu", "Jaguar", "Jeep", "Kia", "Lancia",
            "Land Rover", "Lexus", "Mazda", "Mercedes-Benz", "MG", "Mini", "Mitsubishi", "Nissan",
            "Opel", "Peugeot", "Porsche", "Renault", "Rover", "Saab", "Seat", "Skoda", "Smart",
            "Subaru", "Suzuki", "Toyota", "Volvo", "VW"
        ]
        for b in brands:
            db.add(models.Brand(name=b))
            
        for l in ["Prateleira A1", "Prateleira A2", "Armazém B"]:
            db.add(models.Location(name=l))
            
        db.flush()

        # Initial Part Types and Fields
        pt_motor = models.PartType(name="Motor")
        db.add(pt_motor)
        db.flush()
        db.add(models.TypeField(part_type_id=pt_motor.id, name="Cilindrada", field_type="number", keep_on_baixa=True))
        db.add(models.TypeField(part_type_id=pt_motor.id, name="Combustível", field_type="options", options=["Gasóleo", "Gasolina", "Elétrico", "Híbrido"], keep_on_baixa=True))
        db.add(models.TypeField(part_type_id=pt_motor.id, name="Quilometragem", field_type="number", keep_on_baixa=False))

        pt_caixa = models.PartType(name="Caixa de Velocidades")
        db.add(pt_caixa)
        db.flush()
        db.add(models.TypeField(part_type_id=pt_caixa.id, name="Tipo", field_type="options", options=["Manual", "Automática"], keep_on_baixa=True))
        db.add(models.TypeField(part_type_id=pt_caixa.id, name="Nº Velocidades", field_type="number", keep_on_baixa=True))

        db.commit()

# Run DB initialization
with Session(bind=engine) as session:
    init_db(session)

from fastapi.responses import FileResponse

# API Routers
app.include_router(auth.router)
app.include_router(parts.router)
app.include_router(vehicles.router)
app.include_router(config.router)
app.include_router(analytics.router)
app.include_router(inquiries.router)
app.include_router(storage.router)
app.include_router(users.router)
app.include_router(bulk.router)

# Mount specific static subdirectories and files
if os.path.exists("public/js"):
    app.mount("/js", StaticFiles(directory="public/js"), name="js")
if os.path.exists("storage"):
    app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# Serve main pages explicitly
@app.get("/")
async def read_index():
    return FileResponse("public/index.html")

@app.get("/admin.html")
async def read_admin():
    return FileResponse("public/admin.html")

@app.get("/style.css")
async def read_style():
    return FileResponse("public/style.css")

# Fallback for any other .html files in public
@app.get("/{page}.html")
async def read_page(page: str):
    path = f"public/{page}.html"
    if os.path.exists(path):
        return FileResponse(path)
    return {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
