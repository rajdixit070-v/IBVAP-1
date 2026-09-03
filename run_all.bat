@echo off
TITLE IBVAP - Intelligent Border Video Analytics Platform
echo =====================================================================
echo    STARTING IBVAP PLATFORM (BACKEND + FRONTEND)
echo =====================================================================
echo.

echo [1/2] Launching Backend Server (FastAPI on http://127.0.0.1:8000)...
start "IBVAP Backend" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --app-dir backend --reload-dir backend/app --host 0.0.0.0 --port 8000"


echo [2/2] Launching Frontend Server (React Vite on http://localhost:5173)...
start "IBVAP Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================================
echo  IBVAP IS NOW RUNNING!
echo.
echo  - Frontend UI Dashboard: http://localhost:5173
echo  - Backend REST API Docs: http://localhost:8000/docs
echo  - Health Probe:          http://localhost:8000/health
echo.
echo  Default Login:
echo  - Username: admin
echo  - Password: Admin@IBVAP2026
echo =====================================================================
timeout /t 5 >nul
start http://localhost:5173
