#!/bin/bash

echo "========================================================"
echo "     Google Cloud Platform Deployment Script (macOS/Linux)"
echo "========================================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: Google Cloud SDK is not installed or not in your PATH."
    echo "Please install it using: brew install --cask google-cloud-sdk"
    exit 1
fi

# Ask for Project ID
read -p "Enter your Google Cloud Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project ID cannot be empty."
    exit 1
fi

echo ""
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

echo ""
echo "Enabling required APIs (Cloud Build, Cloud Run, Container Registry)..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

echo ""
echo "Submitting build to Cloud Build..."
echo "This may take a few minutes..."
gcloud builds submit --config cloudbuild.yaml .

echo ""
echo "========================================================"
echo "Deployment Build Submitted!"
echo "========================================================"
echo ""
echo "Next Steps:"
echo "1. Go to the Cloud Run Console: https://console.cloud.google.com/run"
echo "2. Select your service (ai-conversation-canvas)."
echo "3. Click \"Edit & Deploy New Revision\"."
echo "4. Go to the \"Variables & Secrets\" tab."
echo "5. Add your Environment Variables (MONGODB_URI, API Keys, etc.)."
echo "6. Click \"Deploy\"."
echo ""
