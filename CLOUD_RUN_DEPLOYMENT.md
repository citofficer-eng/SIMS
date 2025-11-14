# SIMS Backend Deployment Guide (Cloud Run)

This guide will deploy the PHP backend to Google Cloud Run for use with Firebase Hosting frontend.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Docker** installed (for local building, optional)
4. Project ID: `sims-41ff9`

## Step 1: Authenticate with Google Cloud

```powershell
gcloud auth login
gcloud config set project sims-41ff9
```

## Step 2: Enable Required APIs

```powershell
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

## Step 3: Build and Push Container Image

From the repository root (where `Dockerfile` is located):

```powershell
gcloud builds submit --tag gcr.io/sims-41ff9/sims-backend .
```

This will:
- Build the Docker image
- Push to Google Container Registry (gcr.io)
- Take 3-5 minutes on first run

**Troubleshooting:**
- If build fails, check `Dockerfile` is in the root directory and has valid syntax.
- Ensure `composer.json` and `composer.lock` exist.
- Check that Cloud Build has permissions: `gcloud projects get-iam-policy sims-41ff9`

## Step 4: Deploy to Cloud Run

```powershell
gcloud run deploy sims-backend `
  --image gcr.io/sims-41ff9/sims-backend `
  --platform managed `
  --region asia-southeast1 `
  --allow-unauthenticated `
  --memory 512Mi `
  --timeout 3600
```

**Region choices:**
- `asia-southeast1` — Southeast Asia (recommended for Philippines)
- `asia-northeast1` — Tokyo
- `us-central1` — US Central
- See all: `gcloud run locations list`

**Output example:**
```
Service [sims-backend] revision [sims-backend-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://sims-backend-xxxxx-uc.a.run.app
```

**Copy the Service URL** — you'll need it for the frontend.

## Step 5: Configure Environment Variables (if needed)

If your API needs database credentials, JWT secrets, etc.:

```powershell
gcloud run services update sims-backend `
  --update-env-vars DATABASE_URL=your_db_url,JWT_SECRET=your_secret `
  --region asia-southeast1
```

## Step 6: Update Frontend with Backend URL

Set `VITE_API_BASE` to your Cloud Run service URL:

**In `.env.production`:**
```
VITE_API_BASE=https://sims-backend-xxxxx-uc.a.run.app
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=sims-41ff9.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sims-41ff9
VITE_FIREBASE_STORAGE_BUCKET=sims-41ff9.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://sims-41ff9-default-rtdb.firebaseio.com
```

## Step 7: Build and Deploy Frontend

```powershell
npm install
npm run build
firebase deploy --only hosting
```

## Step 8: Test the Integration

- Open your Firebase Hosting URL: `https://sims-41ff9.web.app`
- Test an API call (e.g., login) to ensure requests reach Cloud Run backend
- Check Cloud Run logs:
```powershell
gcloud run logs read sims-backend --region asia-southeast1 --limit 50
```

## Subsequent Deployments (Backend Updates)

After making changes to the PHP API:

```powershell
# Rebuild and push image
gcloud builds submit --tag gcr.io/sims-41ff9/sims-backend .

# Redeploy to Cloud Run (auto-pulls new image)
gcloud run deploy sims-backend `
  --image gcr.io/sims-41ff9/sims-backend `
  --platform managed `
  --region asia-southeast1 `
  --allow-unauthenticated
```

## Cost Estimation

- **Cloud Run:** ~$0.24/million requests + compute time (usually free tier covers small use).
- **Container Registry:** ~$0.026/GB/month storage.
- **Firebase Hosting:** Free tier includes 10GB/month storage + 360MB/day bandwidth.

See https://cloud.google.com/run/pricing for details.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails with permission error | Run `gcloud auth configure-docker` and retry |
| Container won't start (502 error) | Check logs: `gcloud run logs read sims-backend --region asia-southeast1` |
| API calls return 404 | Verify `VITE_API_BASE` is set correctly in frontend `.env.production` |
| Database connection fails | Ensure database is accessible from Cloud Run; check firewall rules |
| Timeout errors | Increase timeout in `gcloud run deploy --timeout 3600` (up to 3600s) |

## Next Steps

- Monitor Cloud Run dashboard: https://console.cloud.google.com/run?project=sims-41ff9
- Set up CI/CD (GitHub Actions) for automated deployments
- Configure custom domain instead of `.a.run.app` subdomain
- Set up Cloud SQL for managed database
