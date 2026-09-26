@echo off
title Sign2Voice App Launcher
echo ============================================================
echo   Starting Sign2Voice: ASL to Speech Web Platform
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Node.js Backend Server on port 5000...
start "Sign2Voice Backend" cmd /k "cd app\Server && npm start"

timeout /t 2 /nobreak >nul

echo [2/2] Starting React Vite Frontend on port 5173...
start "Sign2Voice Frontend" cmd /k "cd app\Client && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening Sign2Voice in your default browser...
start http://localhost:5173

echo.
echo ============================================================
echo   Sign2Voice is now running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo.
echo   Log in and click "Start Camera" on the Dashboard.
echo   Press 'S' in your browser to speak the sentence!
echo ============================================================
pause
