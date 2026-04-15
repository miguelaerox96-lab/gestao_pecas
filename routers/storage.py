import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime
import models
from PIL import Image, ImageOps
import io
from routers.auth import get_current_user, check_admin
from routers.config import read_branding, write_branding

router = APIRouter(tags=["storage"])

STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

@router.post("/images/upload")
async def upload_image(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Formato de ficheiro não permitido.")

    timestamp = int(datetime.now().timestamp())
    # Standardize to .webp for best compression/quality balance
    base_name = "".join(x for x in os.path.splitext(file.filename)[0] if x.isalnum() or x in "._- ")
    fname = f"{timestamp}_{base_name}.webp"
    path = os.path.join(STORAGE_DIR, fname)

    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents))
        
        # Fix orientation from EXIF data
        img = ImageOps.exif_transpose(img)
        
        # Convert to RGB (WebP supports transparency but RGB is more standard for catalog photos)
        # If photo has transparency, put it on a white background
        if img.mode in ("RGBA", "P"):
            fill_color = (255, 255, 255)
            background = Image.new("RGB", img.size, fill_color)
            if img.mode == "RGBA":
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
            img = background
        else:
            img = img.convert("RGB")

        # Resize if too large (max 1600px)
        img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        
        # Save compressed WebP
        img.save(path, "WEBP", quality=75, method=6)
        
    except Exception as e:
        print(f"Erro no processamento da imagem: {e}")
        # Fallback for unexpected image formats or PIL errors
        fname = f"{timestamp}_{file.filename}"
        path = os.path.join(STORAGE_DIR, fname)
        # Avoid double read if possible, but here we already have contents
        with open(path, "wb") as buffer:
            buffer.write(contents)
            
    return {"url": f"/storage/{fname}"}

@router.post("/branding/logo")
async def upload_logo(file: UploadFile = File(...), admin: models.User = Depends(check_admin)):
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    logo_path = os.path.join(STORAGE_DIR, f"logo{ext}")
    
    # Remove old logo files with any extension
    for old_ext in allowed:
        old_path = os.path.join(STORAGE_DIR, f"logo{old_ext}")
        if os.path.exists(old_path):
            os.remove(old_path)
            
    with open(logo_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    logo_url = f"/storage/logo{ext}"
    data = read_branding()
    data["logo_url"] = logo_url
    write_branding(data)
    return {"logo_url": logo_url}
