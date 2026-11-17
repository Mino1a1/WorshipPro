@echo off
cd /d "%~dp0"
echo Installazione dipendenze...
npm install
if errorlevel 1 (
  echo Installazione non riuscita. Verifica Node.js, npm e la connessione Internet.
  pause
  exit /b 1
)
npm start
if errorlevel 1 pause
