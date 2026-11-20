@echo off
rem Lance l'Atelier Charte IA en local (double-cliquer). Fermer cette fenetre arrete le serveur.
cd /d "%~dp0"
if not exist node_modules (
  echo Installation des dependances...
  call npm.cmd install
)
echo.
echo  Espace formateur : http://localhost:3210/#/formateur
echo  Laissez cette fenetre ouverte pendant toute la seance.
echo.
start "" "http://localhost:3210/#/formateur"
node server.js
pause
