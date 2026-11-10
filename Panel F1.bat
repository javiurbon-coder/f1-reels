@echo off
REM Doble clic: abre el panel de CONTRASTADO F1 (borradores, recomendación del día, publicar). Cierra esta ventana para apagarlo.
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:4173
call npm run review
pause
