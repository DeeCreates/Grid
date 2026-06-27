# GRID Security - Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Vercel CLI installed: `npm i -g vercel`
3. Vercel account with proper permissions

## Environment Variables

Set up the following environment variables in Vercel:

### Firebase Configuration
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Analytics (Optional)
- `VITE_GA_MEASUREMENT_ID`

### Feature Flags
- `VITE_ENABLE_ANALYTICS`
- `VITE_ENABLE_DEBUG`

## Deployment Steps

### 1. Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link the project
vercel link