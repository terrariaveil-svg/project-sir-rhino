@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PYTHON=%PROJECT_DIR%backend\venv\Scripts\python.exe"
set "APP=%PROJECT_DIR%backend\app.py"

if not exist "%PYTHON%" (
    echo Python environment not found at "%PYTHON%".
    echo Create or restore the backend virtual environment first.
    pause
    exit /b 1
)

start "Inventory Management API" /D "%PROJECT_DIR%backend" "%PYTHON%" "%APP%"

for /L %%I in (1,1,30) do (
    curl.exe --silent --fail http://127.0.0.1:5000/api/products >nul
    if not errorlevel 1 (
        start "" "http://127.0.0.1:5000/"
        exit /b 0
    )
    timeout /t 1 /nobreak >nul
)

echo The API or database did not respond at http://127.0.0.1:5000/api/products.
echo Check the Inventory Management API window for startup errors.
pause
exit /b 1
