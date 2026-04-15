# ── Base image ────────────────────────────────────────────────────────────────
FROM python:3.10-slim

# Evita ficheiros .pyc e garante logs imediatos (sem buffering)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Diretório de trabalho dentro do contentor
WORKDIR /app

# Instala as dependências do sistema mínimas (curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Instala as dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

# Garante que a pasta de armazenamento existe (será sobreescrita pelo volume)
RUN mkdir -p storage

# Expõe a porta
EXPOSE 8000

# Variáveis de ambiente padrão (substituir com .env ou variáveis de deploy)
ENV DATABASE_URL=sqlite:///./storage/autoparts.db \
    ENV=production

# Healthcheck — verifica que a app responde
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# ── IMPORTANTE: --workers 1 para garantir consistência com SQLite ────────────
# Se migrar para PostgreSQL, pode aumentar os workers
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
