@echo off
chcp 65001 >nul
echo ==========================================
echo    正在啟動網站預覽伺服器...
echo ==========================================
cd /d "%~dp0"

echo.
echo 準備打開瀏覽器前往 http://localhost:8000
start http://localhost:8000

echo.
echo 嘗試使用 Python 啟動伺服器...
python -m http.server 8000

if %errorlevel% neq 0 (
    echo.
    echo Python 伺服器啟動失敗，嘗試使用 Node.js (npx serve)...
    npx serve -l 8000
)

echo.
echo 如果伺服器仍未啟動，請確認您是否有安裝 Python 或 Node.js。
pause
