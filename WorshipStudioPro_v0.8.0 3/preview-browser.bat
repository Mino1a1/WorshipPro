@echo off
cd /d "%~dp0"
start "Worship Studio Pro Preview Server" /min cmd /c "py -m http.server 8765 --directory app"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8765/
echo Il server di anteprima resta aperto nella finestra minimizzata. Chiudila per terminarlo.
