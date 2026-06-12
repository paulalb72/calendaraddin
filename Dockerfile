# --- Stufe 1: React-Frontend bauen ---------------------------------------- #
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stufe 2: Python-Backend ---------------------------------------------- #
FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/data \
    FRONTEND_DIST=/app/frontend_dist

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /frontend/dist ./frontend_dist

# SQLite-Volume (in Coolify zusätzlich als "Persistent Storage" auf /data mappen!)
VOLUME ["/data"]
EXPOSE 8000

# Healthcheck (ohne curl/wget – nutzt Python). Coolify wertet den Status aus.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)"

# Backend liegt unter ./backend; App-Modul ist backend.app.main:app
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
