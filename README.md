## OSKILIFTS

OSKILIFTS is an Expo + React Native app that surfaces RSF weight room capacity (powered by Density's public display token) and the official Group Fitness schedule.

### Prerequisites

- Node 18+ (for built-in `fetch`)
- Expo CLI (`npx expo start`)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment example and adjust if needed:
   ```bash
   cp env.example .env
   ```
   The default Density share token and widget ids are public via RecWell's site, but you can override them in `.env`.

3. Start the scraping API:
   ```bash
   npm run server
   ```
   The server exposes:
   - `GET /api/weightroom` – live capacity snapshot
   - `GET /api/classes?startDate=YYYY-MM-DD` – 7-day class schedule window
   - Static web build (if present in `dist/`) is also served from the same port. Build it via:
     ```bash
     npm run web:build
     ```

4. In a second terminal, run the Expo app:
   ```bash
   npm start
   ```

5. (Optional) point the mobile app at a remote server by setting:
   ```bash
   EXPO_PUBLIC_OSKILIFTS_API_URL=http://<host>:4000
   ```

### Testing the scraper

```bash
curl http://localhost:4000/api/weightroom | jq
curl http://localhost:4000/api/classes | jq
```

### Notes

- Weight room data respects the Density safe display rate-limit via simple caching (30 s).
- Class data is cached for 5 min and sourced from Mindbody's widget endpoint.

### Legal & Ethical Considerations

**Is this legal/okay to scrape UC Berkeley's website?**

This app accesses publicly available data through:

1. **Density API** - UC Berkeley uses Density's "Safe Display" feature, which provides a public share token (`shr_*`) embedded in their website. This token is intentionally designed for public access and is used by the official RSF crowd meter page. We're using the same public API endpoint that their own website uses.

2. **Mindbody Widget API** - The group fitness schedule is served via Mindbody's public widget endpoint (`widgets.mindbodyonline.com`), which is designed to be embedded on public websites. This is the same endpoint that powers the official RecWell schedule page.

**Best Practices:**
- ✅ We use public APIs/endpoints (not scraping protected content)
- ✅ We implement rate limiting and caching to avoid overloading servers
- ✅ We respect robots.txt and terms of service
- ✅ We only access data that's already publicly displayed on UC Berkeley's website

**Recommendations:**
- This is a student project for personal use
- For production/public distribution, consider:
  - Reaching out to RecWell to see if they have an official API
  - Adding attribution/disclaimers in the app
  - Monitoring for any changes to the data sources

**Disclaimer:** This app is not affiliated with or endorsed by UC Berkeley or RecWell. Use at your own discretion.

## Sharing & Deployment

There are several ways to share OSKILIFTS with others:

### Option 1: Quick Share with Expo Go (Mobile Testing)

1. Start your API server locally:
   ```bash
   npm run server
   ```

2. Use a tunneling service to expose your local API:
   ```bash
   # Install ngrok: https://ngrok.com/download
   ngrok http 4000
   ```

3. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

4. Set the API URL in your `.env`:
   ```bash
   EXPO_PUBLIC_OSKILIFTS_API_URL=https://abc123.ngrok.io
   ```

5. Start Expo:
   ```bash
   npm start
   ```

6. Share the QR code with others - they can scan it with the Expo Go app (iOS/Android)

**Note:** The ngrok URL changes each time you restart (free tier). For a permanent solution, use Option 2 or 3.

### Option 2: Deploy API Server to Cloud (Recommended)

Deploy the API server to a cloud service so it's always accessible:

#### Railway (Easiest)

1. Sign up at [railway.app](https://railway.app)
2. Create a new project → "Deploy from GitHub repo"
3. Connect your GitHub repo
4. Railway will auto-detect Node.js and deploy
5. Add environment variables in Railway dashboard:
   - `DENSITY_DISPLAY_ID` (optional, has default)
   - `DENSITY_SPACE_ID` (optional, has default)
   - `DENSITY_SHARE_TOKEN` (optional, has default)
   - `MBO_WIDGET_ID` (optional, has default)
6. Railway provides a URL like `https://your-app.railway.app`
7. Update your `.env`:
   ```bash
   EXPO_PUBLIC_OSKILIFTS_API_URL=https://your-app.railway.app
   ```

#### Render (Free Tier Available)

1. Sign up at [render.com](https://render.com)
2. Create a new "Web Service"
3. Connect your GitHub repo
4. Build command: `npm install`
5. Start command: `node server/index.js`
6. Add environment variables in Render dashboard
7. Render provides a URL like `https://your-app.onrender.com`

#### Other Options
- **Heroku**: Similar to Render, uses the `Procfile`
- **Fly.io**: Good for global distribution
- **DigitalOcean App Platform**: Simple deployment

### Option 3: Deploy Web Version

Deploy the web version so people can access it in their browser:

#### Vercel (Recommended for Web)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variable:
   ```bash
   vercel env add EXPO_PUBLIC_OSKILIFTS_API_URL
   # Enter your API server URL (from Option 2)
   ```

4. Redeploy:
   ```bash
   vercel --prod
   ```

#### Netlify

1. Install Netlify CLI:
   ```bash
   npm i -g netlify-cli
   ```

2. Build and deploy:
   ```bash
   npm run web
   # In another terminal:
   netlify deploy --prod
   ```

### Option 4: Build Standalone Apps

For iOS/Android apps that don't require Expo Go:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Configure:
   ```bash
   eas build:configure
   ```

3. Build:
   ```bash
   # For Android
   eas build --platform android
   
   # For iOS (requires Apple Developer account)
   eas build --platform ios
   ```

4. Distribute via:
   - Android: Google Play Store or direct APK download
   - iOS: TestFlight or App Store

### Quick Start for Sharing

**Fastest way to share right now:**

1. Build the static web app (uses `dist/`):
   ```bash
   npm run web:build
   ```

2. Serve both API + web from the same Express server:
   ```bash
   npm run server
   ```
   This automatically serves the SPA and proxies `/api/*`.

3. Expose the server with ngrok (or deploy anywhere):
   ```bash
   ngrok http 4000
   ```

4. Share the ngrok URL (or deploy to Railway/Render for a permanent link).

**For local testing with friends:**
- Use ngrok (Option 1) - works immediately but URL changes
- Have friends install Expo Go app
- Share QR code from `npm start`
