@echo off
setlocal

echo ========================================================
echo      Google Cloud Platform Deployment Script
echo ========================================================
echo.

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Google Cloud SDK is not installed or not in your PATH.
    echo Please install it from: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

REM Ask for Project ID
set /p PROJECT_ID="Enter your Google Cloud Project ID: "

if "%PROJECT_ID%"=="" (
    echo Error: Project ID cannot be empty.
    pause
    exit /b 1
)

echo.
echo Setting project to %PROJECT_ID%...
call gcloud config set project %PROJECT_ID%

echo.
echo Enabling required APIs (Cloud Build, Cloud Run, Container Registry)...
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

echo.
echo Submitting build to Cloud Build...
echo This may take a few minutes...
call gcloud builds submit --config cloudbuild.yaml .

echo.
echo ========================================================
echo Deployment Build Submitted!
echo ========================================================
echo.
echo Next Steps:
echo 1. Go to the Cloud Run Console: https://console.cloud.google.com/run
echo 2. Select your service (ai-conversation-canvas).
echo 3. Click "Edit & Deploy New Revision".
echo 4. Go to the "Variables & Secrets" tab.
echo 5. Add your Environment Variables (MONGODB_URI, API Keys, etc.).
echo 6. Click "Deploy".
echo.
pause
