#!/bin/bash
# Quick Cloud Run deployment script for sims-backend
# Usage: bash deploy.sh

set -e

PROJECT_ID="sims-41ff9"
SERVICE_NAME="sims-backend"
REGION="asia-southeast1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 SIMS Backend Cloud Run Deployment"
echo "======================================"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region:  $REGION"
echo ""

# Step 1: Set project
echo "📌 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 2: Enable APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Step 3: Build image
echo "🔨 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME}:latest .

# Step 4: Deploy
echo "📤 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 3600

# Step 5: Get service URL
echo ""
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Update VITE_API_BASE in .env.production to: $SERVICE_URL"
echo "   Then run: npm run build && firebase deploy --only hosting"
