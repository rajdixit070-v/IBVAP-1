@echo off
title IBVAP Platform Launcher
echo.
echo  ==========================================
echo   IBVAP - Intelligent Border Video Analytics
echo   Platform v2.0 — Phase 1-21 Production Build
echo  ==========================================
echo.

REM --- Step 1: Ensure venv exists and packages are installed ---
if not exist "venv\Scripts\activate.bat" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv venv
    echo [SETUP] Installing backend dependencies...
    call venv\Scripts\pip.exe install -r backend\requirements.txt
    echo [SETUP] Backend dependencies installed.
) else (
    REM Check if core AI packages are installed in venv, install if missing
    venv\Scripts\python.exe -c "import fastapi, torch, ultralytics" 2>nul
    if errorlevel 1 (
        echo [SETUP] Installing backend dependencies into existing venv...
        call venv\Scripts\pip.exe install -r backend\requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
    )

)

echo [1/2] Starting Backend on port 8000...
start "IBVAP Backend" cmd /k "call venv\Scripts\activate.bat && cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 4 /nobreak >nul

echo [2/2] Starting Frontend on port 5173...
start "IBVAP Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo  ==========================================
echo   IBVAP is starting up...
echo   Browser:  http://localhost:5173
echo   API Docs: http://localhost:8000/docs
echo   Login:    admin / Admin@IBVAP2026
echo  ==========================================
echo.

timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
pause
