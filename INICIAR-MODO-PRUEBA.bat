@echo off
echo Iniciando Nexus Finances en Modo Pruebas...
echo Esto permite probar cambios sin instalar la aplicacion.
echo.
echo Presiona Ctrl+C para detener.
echo.

cd /d "%~dp0"
npm run electron:dev
pause
