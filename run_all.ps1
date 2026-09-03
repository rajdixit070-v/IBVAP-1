Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   STARTING IBVAP PLATFORM (BACKEND + FRONTEND)" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend
Write-Host "[1/2] Launching Backend Server (FastAPI on http://127.0.0.1:8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; & '$rootDir\venv\Scripts\Activate.ps1'; python -m uvicorn app.main:app --app-dir backend --reload-dir backend/app --host 0.0.0.0 --port 8000"


# Start Frontend
Write-Host "[2/2] Launching Frontend Server (React Vite on http://localhost:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; npm run dev"

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " IBVAP IS NOW RUNNING!" -ForegroundColor Green
Write-Host " - Frontend UI:        http://localhost:5173" -ForegroundColor White
Write-Host " - Backend API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host " - Login: admin / Admin@IBVAP2026" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Cyan

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"
