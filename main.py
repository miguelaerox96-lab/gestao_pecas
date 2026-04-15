import os
import sys
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

import models
from database import engine, get_db
from routers import auth, parts, vehicles, config, analytics, inquiries, storage, users, bulk
from routers.bulk import ClearSystemRequest
from routers.auth import check_admin

def get_base_path():
    """Get the absolute path to the resource directory, works for dev and PyInstaller."""
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent

BASE_DIR = get_base_path()
app = FastAPI(title="AutoParts Management API")

@app.post("/maintenance/clear")
def clear_system_direct(req: ClearSystemRequest, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    mode = req.mode
    try:
        db.query(models.Inquiry).delete()
        db.query(models.HistoryRecord).delete()
        db.query(models.Part).delete()
        db.query(models.Vehicle).delete()
        if mode == "full":
            db.query(models.TypeField).delete()
            db.query(models.PartType).delete()
            db.query(models.Location).delete()
            db.query(models.Brand).delete()
        db.commit()
        if os.path.exists("storage"):
            for root, dirs, files in os.walk("storage"):
                for file in files:
                    if file.endswith((".jpg", ".png", ".webp", ".jpeg")) and not file.startswith("branding_"):
                        try: os.remove(os.path.join(root, file))
                        except: pass
        return {"msg": f"Sistema limpo com sucesso (Modo: {mode})"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

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
JS_DIR = BASE_DIR / "public" / "js"
if JS_DIR.exists():
    app.mount("/js", StaticFiles(directory=str(JS_DIR)), name="js")

STORAGE_DIR = Path("storage")
if not STORAGE_DIR.exists():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# Serve main pages explicitly
@app.get("/")
@app.get("/index.html")
async def get_index():
    return FileResponse(BASE_DIR / "public" / "index.html")

@app.get("/admin.html")
async def get_admin():
    return FileResponse(BASE_DIR / "public" / "admin.html")

@app.get("/style.css")
async def get_css():
    return FileResponse(BASE_DIR / "public" / "style.css")

@app.get("/favicon.ico")
async def get_favicon():
    fav = BASE_DIR / "public" / "favicon.ico"
    if fav.exists():
        return FileResponse(fav)
    return ""

if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    multiprocessing.freeze_support()
    
    # Use environment variables if present, otherwise defaults for local work
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    print(f"--- Servidor AutoParts Ligado ---")
    print(f"Aceda localmente em: http://localhost:{port}")
    print(f"Aceda na rede em: http://IP_DESTE_PC:{port}")
    print(f"---------------------------------")
    
    uvicorn.run(app, host=host, port=port)
