#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "========================================="
echo "Building IBVAP for Render Deployment"
echo "========================================="

# 1. Install Python dependencies
echo ">> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# 2. Build Frontend React Dashboard
echo ">> Building Frontend React Dashboard..."
cd frontend
npm install
npm run build
cd ..

# 3. Create required runtime directories
echo ">> Creating runtime storage directories..."
mkdir -p data/evidence
mkdir -p data/faces
mkdir -p data/videos

echo "========================================="
echo "IBVAP Build Completed Successfully!"
echo "========================================="
