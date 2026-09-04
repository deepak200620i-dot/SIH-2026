# IBVAP — Deployment & Supabase Setup Guide

This guide walks you through deploying the Intelligent Border Video Analytics Platform (IBVAP) to **Render** and connecting it to your **Supabase** PostgreSQL database.

---

## 🚀 Part 1: Deploy to Render

IBVAP is configured as a unified full-stack application where the FastAPI server hosts both the REST API, WebSocket streams, and the compiled React TypeScript dashboard.

### Step 1: Push Code to GitHub
Ensure all latest files (`render.yaml`, `build.sh`, `frontend/`, `src/`, `supabase_schema.sql`) are committed and pushed to your repository:
```bash
git add .
git commit -m "feat: complete IBVAP end-to-end for Render and Supabase"
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

Render will automatically execute `build.sh` (installing Python dependencies and building the React dashboard with `tsc && vite build`) and start the unified server.

---

## 🗄️ Part 2: Setting up Supabase Database

### Step 1: Create a Supabase Project
1. Go to [Supabase](https://supabase.com/) and click **New Project**.
2. Choose a project name, region, and generate a secure database password.

### Step 2: Execute the Schema Script
1. In the Supabase dashboard, open the **SQL Editor** tab from the left sidebar.
2. Open `supabase_schema.sql` from this repository.
3. Paste the contents into the Supabase SQL editor and click **Run**.
4. This creates:
   - `events` table (with B-tree indexes for timestamp, event_type, severity)
   - `cameras` table (pre-populated with 4 border camera sources)
   - `known_faces` table (for face recognition gallery)
   - `fence_zones` table (for polygon intrusion zones)
   - Default seed data and Row Level Security (RLS) policies.

### Step 3: Link Supabase to Render
1. In Supabase, go to **Project Settings** → **Database**.
2. Under **Connection string**, copy the URI (choose Transaction pooler or Direct URI).
3. In your Render Dashboard, open your Web Service → **Environment**.
4. Set:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_KEY=[YOUR-ANON-OR-SERVICE-KEY]
   ```
5. Click **Save Changes** — Render will redeploy with the live Supabase PostgreSQL database!

---

## 💻 Part 3: Running Locally

### Backend (Terminal 1):
```bash
# Install backend dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn src.api.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### Frontend (Terminal 2):
```bash
cd frontend
npm install
npm run dev
```
- Frontend dev server: `http://localhost:3000`

---

## 🖥️ Part 4: Navigation & Dashboard Features

The dashboard includes a full surveillance command suite:

1. **Dashboard (`/dashboard`)**:
   - 6 Live KPI Metric Cards (Cameras Online, Active Alerts, People Detected, Vehicles Detected, Unknown Faces, Intrusions Today).
   - Live Surveillance preview grid with threat status overlays.
   - Real-time Alerts Panel.
   - Pop-up alert notifications on new security events.
2. **Live Surveillance (`/live`)**:
   - Multi-camera surveillance view across border sectors.
3. **Alerts Feed (`/alerts`)**:
   - Filterable alerts table with severity badges (Critical, High, Medium, Low) and acknowledge controls.
4. **Event Logs (`/events`)**:
   - Historical security event audit trail.
5. **Face Recognition (`/face-recognition`)**:
   - Personnel identification log and face recognition database.
6. **ANPR (`/anpr`)**:
   - Automatic Number Plate Recognition log with vehicle classifications.
7. **Analytics (`/analytics`)**:
   - Interactive visual graphs for event trends and threat breakdowns.
8. **Demo Mode**:
   - Toggle simulated event streams in the top bar to test live system responses.

---

## 🧪 Part 5: Testing & Simulation

To manually trigger a live simulated event through the backend and broadcast it via WebSockets, run:
```bash
curl -X POST http://localhost:8000/api/events/simulate
```
