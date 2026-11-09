@echo off
REM Tarea diaria: noticias -> reels con voz -> aviso al móvil (Telegram) -> limpieza de espacio.
cd /d "%~dp0"
if not exist logs mkdir logs
echo ===== %date% %time% ===== >> logs\daily.log
call npm run agents >> logs\daily.log 2>&1
call npm run notify >> logs\daily.log 2>&1
call npm run clean >> logs\daily.log 2>&1
