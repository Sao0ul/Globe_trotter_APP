@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo   PostgreSQL - Connexion interactive
echo ========================================
echo.


if not exist ".env" (
    echo [ERREUR] .env introuvable.
    pause
    exit /b 1
)


for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
)


:: -------------------------------------------------------
:: Verifie les variables obligatoires
:: -------------------------------------------------------
if "%DB_HOST%"=="" goto missing
if "%DB_PORT%"=="" goto missing
if "%DB_USER%"=="" goto missing
if "%DB_PASSWORD%"=="" goto missing
if "%DB_NAME%"=="" goto missing

:: Verifie psql
where psql >nul 2>&1

if errorlevel 1 (
    echo [ERREUR] psql.exe est introuvable.
    echo Installe PostgreSQL ou ajoute son dossier bin au PATH.
    pause
    exit /b 1
)

:: Verifie le certificat
if not exist ".\certs\ca.pem" (
    echo [ERREUR] Certificat Aiven introuvable :
    echo .\certs\ca.pem
    pause
    exit /b 1
)


echo.
echo Serveur : %DB_HOST%:%DB_PORT%
echo Base    : %DB_NAME%
echo User    : %DB_USER%
echo.


:: Mot de passe PostgreSQL
set "PGPASSWORD=%DB_PASSWORD%"


:: SSL Aiven
set "PGSSLMODE=verify-ca"
set "PGSSLROOTCERT=%CD%\certs\ca.pem"

echo ========================================
echo   Connexion PostgreSQL (session ouverte)
echo ========================================
echo.
echo Tape tes requetes SQL. Utilise \q pour quitter.
echo.

:: SESSION INTERACTIVE - pas de -f, pas de script execute automatiquement
psql ^
    -h "%DB_HOST%" ^
    -p "%DB_PORT%" ^
    -U "%DB_USER%" ^
    -d "%DB_NAME%"


:: Nettoyage (execute apres avoir quitte psql avec \q)
set "PGPASSWORD="

echo.
echo Session fermee.
pause
exit /b


:: Variables manquantes
:missing

echo.
echo [ERREUR] Une variable DB est manquante dans .env
echo.
echo Variables requises :
echo   DB_HOST
echo   DB_PORT
echo   DB_USER
echo   DB_PASSWORD
echo   DB_NAME
echo.

pause
exit /b 1