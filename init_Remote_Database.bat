@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================
echo   Initialisation de la base de donnees
echo ========================================
echo.

::-------------------------------------------------------
:: Verification du fichier .env
::-------------------------------------------------------
if not exist ".env" (
    echo [ERREUR] Le fichier .env est introuvable.
    pause
    exit /b 1
)

::-------------------------------------------------------
:: Chargement des variables d'environnement
::-------------------------------------------------------
echo Chargement des variables...

for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" (
        set "%%A=%%B"
    )
)

::-------------------------------------------------------
:: Verification des variables
::-------------------------------------------------------
if "%DB_HOST%"=="" (
    echo [ERREUR] DB_HOST manquant.
    pause
    exit /b 1
)

if "%DB_PORT%"=="" (
    echo [ERREUR] DB_PORT manquant.
    pause
    exit /b 1
)

if "%DB_USER%"=="" (
    echo [ERREUR] DB_USER manquant.
    pause
    exit /b 1
)

if "%DB_PASSWORD%"=="" (
    echo [ERREUR] DB_PASSWORD manquant.
    pause
    exit /b 1
)

if "%DB_NAME%"=="" (
    echo [ERREUR] DB_NAME manquant.
    pause
    exit /b 1
)

::-------------------------------------------------------
:: Verification du certificat SSL
::-------------------------------------------------------
if not exist ".\certs\ca.pem" (
    echo [ERREUR] Certificat SSL introuvable :
    echo          .\certs\ca.pem
    pause
    exit /b 1
)

::-------------------------------------------------------
:: Verification du script SQL
::-------------------------------------------------------
if not exist ".\src\db\script.sql" (
    echo [ERREUR] Le fichier script.sql est introuvable.
    pause
    exit /b 1
)

::-------------------------------------------------------
:: Verification du client MySQL
::-------------------------------------------------------
where mysql >nul 2>&1

if errorlevel 1 (
    echo [ERREUR] mysql.exe n'est pas installe ou absent du PATH.
    pause
    exit /b 1
)

echo.
echo Connexion a %DB_HOST%:%DB_PORT%
echo Base de donnees : %DB_NAME%
echo.

::-------------------------------------------------------
:: Execution du script SQL
::-------------------------------------------------------
mysql ^
  --host=%DB_HOST% ^
  --port=%DB_PORT% ^
  --user=%DB_USER% ^
  --password=%DB_PASSWORD% ^
  --ssl-mode=REQUIRED ^
  --ssl-ca=.\certs\ca.pem ^
  %DB_NAME% < .\src\db\script.sql

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ECHEC
    echo ========================================
    echo La base de donnees n'a pas pu etre initialisee.
    echo Verifiez :
    echo   - vos identifiants
    echo   - votre connexion Internet
    echo   - le certificat SSL
    echo   - le contenu de script.sql
) else (
    echo.
    echo ========================================
    echo   SUCCES
    echo ========================================
    echo La base de donnees a ete initialisee avec succes.
)

echo.
pause






mysql ^
  --host=mysql-38b3139d-saoul018-25a1.g.aivencloud.com ^
  --port=22191 ^
  --user=avnadmin ^
  --password ^
  --ssl-mode=VERIFY_CA ^
  --ssl-ca=certs\ca.pem ^
  defaultdb