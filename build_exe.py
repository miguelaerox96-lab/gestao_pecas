import os
import subprocess
import sys
import shutil

def build():
    print("--- Iniciar Processo de Build (AutoParts EXE) ---")
    
    # 1. Verificar/Instalar PyInstaller
    try:
        import PyInstaller
        print("[OK] PyInstaller detetado.")
    except ImportError:
        print("[INFO] PyInstaller não encontrado. A instalar...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # 2. Limpar pastas de build antigas
    for folder in ["build", "dist"]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"[CLEAN] Pasta {folder} removida.")

    # 3. Executar PyInstaller
    # --onedir: Cria uma pasta com o exe e dependências (mais rápido a abrir)
    # --add-data: Inclui a pasta public (HTML/CSS/JS)
    # --hidden-import: Garante que o uvicorn e sub-módulos são incluídos
    # --noconfirm: Sobrescreve sem perguntar
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "AutoParts",
        "--onedir",
        "--add-data", "public;public",
        "--noconfirm",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "main.py"
    ]

    print(f"[BUILD] A executar: {' '.join(cmd)}")
    try:
        subprocess.check_call(cmd)
        print("\n" + "="*40)
        print("CONCLUÍDO COM SUCESSO!")
        print(f"O seu executável está em: {os.path.abspath('dist/AutoParts/AutoParts.exe')}")
        print("Pode copiar a pasta 'dist/AutoParts' para qualquer PC Windows.")
        print("="*40)
    except subprocess.CalledProcessError as e:
        print(f"[ERRO] Falha no PyInstaller: {e}")
        sys.exit(1)

if __name__ == "__main__":
    build()
