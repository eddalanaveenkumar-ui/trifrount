# YouTube Video Download Setup Guide

## Problem
YouTube videos cannot be downloaded directly from the browser due to CORS (Cross-Origin Resource Sharing) restrictions and YouTube's API protection.

## Solution
We've created a backend proxy server that handles the video downloads for you.

## Setup Instructions

### Step 1: Install Backend Dependencies

Open a terminal in the Triangle directory and run:

```bash
cd C:/Users/Naveen Kumar/PycharmProjects/naveenprojects/Triangle
npm install --save express cors ytdl-core
```

### Step 2: Start the Backend Server

Run the backend proxy server:

```bash
node backend-proxy.js
```

You should see:
```
YouTube Download Proxy Server running on port 3000
Access at: http://localhost:3000
```

### Step 3: Test the Backend

Open your browser and visit: `http://localhost:3000`

You should see: `{"status":"YouTube Download Proxy Server Running"}`

### Step 4: Update the App (if needed)

The app is already configured to use `http://localhost:3000` for local testing.

For production deployment, update the `BACKEND_URL` in `www/download-manager.js`:

```javascript
const BACKEND_URL = 'https://your-deployed-backend.com';
```

### Step 5: Rebuild the Android App

```bash
npx cap sync android
```

Then rebuild and run from Android Studio.

## How It Works

1. User clicks "Download" button in the app
2. App sends video ID to backend server
3. Backend server uses `ytdl-core` to get the video download URL
4. Backend returns the download URL to the app
5. App downloads the video, encrypts it, and saves it to device storage
6. Video can now be played offline

## Deployment Options

### Option 1: Local Development
- Keep the backend running on your computer
- Use `http://localhost:3000` (only works when testing on emulator or same network)

### Option 2: Deploy to Vercel (Free)
1. Create account at https://vercel.com
2. Install Vercel CLI: `npm install -g vercel`
3. Run: `vercel` in the Triangle directory
4. Update `BACKEND_URL` in download-manager.js to your Vercel URL

### Option 3: Deploy to Heroku (Free tier available)
1. Create account at https://heroku.com
2. Install Heroku CLI
3. Create new app and deploy backend-proxy.js
4. Update `BACKEND_URL` in download-manager.js to your Heroku URL

### Option 4: Deploy to Your Own Server
1. Upload backend-proxy.js to your server
2. Install dependencies: `npm install`
3. Run with PM2 or similar: `pm2 start backend-proxy.js`
4. Update `BACKEND_URL` in download-manager.js to your server URL

## Testing

1. Start the backend server
2. Open the app
3. Play any video
4. Click the "Download" button
5. You should see progress: 0% → 10% → 30% → 40% → ... → 100%
6. Video will be saved and playable offline

## Troubleshooting

### Error: "Backend server error"
- Make sure the backend server is running
- Check that the BACKEND_URL is correct
- Verify the server is accessible from your device

### Error: "Failed to fetch"
- Check CORS settings in backend-proxy.js
- Ensure your device can reach the backend server
- For Android, use your computer's IP address instead of localhost

### Error: "ytdl-core" issues
- YouTube frequently changes their API
- Update ytdl-core: `npm update ytdl-core`
- Check for ytdl-core updates on GitHub

## Notes

- Downloaded videos are encrypted and stored securely
- Videos are saved to device cache directory
- Large videos may take time to download
- Ensure you have sufficient storage space
- Respect YouTube's Terms of Service when downloading videos
