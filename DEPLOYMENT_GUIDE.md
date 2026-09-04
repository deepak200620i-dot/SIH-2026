# IBVAP — Deployment & Supabase Setup Guide

This guide walks you through deploying the Intelligent Border Video Analytics Platform (IBVAP) to **Render** and connecting it to your **Supabase** PostgreSQL database.

---

## 🚀 Part 1: Deploy to Render

IBVAP is configured as a unified full-stack application where the FastAPI server hosts both the REST API, WebSocket streams, and pre-built React Dashboard.

### Step 1: Push Code to GitHub
Ensure all latest files (`render.yaml`, `build.sh`, `frontend/`, `src/`) are committed and pushed to your repository:
```bash
git add .
git commit -m "feat: connect end-to-end and ready for Render and Supabase"
git push origin main
```

### Step 2: Create a Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `ibvap-border-security` (or your choice)
   - **Language / Environment**: `Python`
   - **Branch**: `main`
   - **Build Command**: `bash build.sh`
   - **Start Command**: `uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. Under **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.10.12`
   - *(Optional until Supabase setup)* `DATABASE_URL`: *(Your Supabase connection string)*
5. Click **Deploy Web Service**.

Render will automatically run `build.sh` (installing Python packages and building the React frontend) and launch the server.

---

## 🗄️ Part 2: Setting up Supabase Database

### Step 1: Create a Supabase Project
1. Go to [Supabase](https://supabase.com/) and click **New Project**.
2. Choose a project name, region, and generate a secure database password.

### Step 2: Execute the Schema Script
1. In the Supabase dashboard, open the **SQL Editor** tab from the left sidebar.
2. Open `supabase_schema.sql` from this repository.
3. Paste the contents into the Supabase SQL editor and click **Run**.
4. This will create:
   - `events` table (with indexes for timestamp, event_type, severity)
   - `cameras` table (pre-populated with 4 border camera sources)
   - `known_faces` table (for face recognition gallery)
   - `fence_zones` table (for polygon intrusion zones)
   - Default seed data and Row Level Security (RLS) policies.

### Step 3: Link Supabase to Render
1. In Supabase, go to **Project Settings** → **Database**.
2. Under **Connection string**, copy the URI (choose Transaction pooler / Direct URI).
3. In your Render Dashboard, open your Web Service → **Environment**.
4. Set:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_KEY=[YOUR-ANON-OR-SERVICE-KEY]
   ```
5. Click **Save Changes** and Render will redeploy with the live database!

---

## 💻 Part 3: Running Locally

### Backend:
```bash
# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn src.api.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
- Frontend dev server: `http://localhost:3000`

---

## 🧪 Part 4: End-to-End Testing & Demos

1. **Live Event Simulation**:
   To trigger an instant real-time security event (broadcast over WebSockets to the dashboard UI), call:
   ```bash
   curl -X POST http://localhost:8000/api/events/simulate
   ```
2. **Face Gallery Management**:
   Open the `/faces` page in the dashboard to register new personnel with uploaded photos.
3. **Fence Zone Editor**:
   Open `/fence` to draw and adjust virtual polygon security zones.
4. **Live Cameras & Alerts**:
   Open `/dashboard` and `/cameras` to monitor threat levels, recent alerts, and real-time feeds.
