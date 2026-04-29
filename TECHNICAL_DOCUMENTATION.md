# OSKILIFTS - Complete Technical Documentation

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Website:** https://oskilifts.com

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Languages & Technologies](#languages--technologies)
4. [Technical Concepts](#technical-concepts)
5. [Tools & Services](#tools--services)
6. [Data Flow & Workflow](#data-flow--workflow)
7. [API Endpoints](#api-endpoints)
8. [Deployment Architecture](#deployment-architecture)
9. [External Integrations](#external-integrations)
10. [File Structure](#file-structure)

---

## Project Overview

**OSKILIFTS** is a cross-platform fitness tracking application that provides real-time gym capacity data, group fitness schedules, workout logging, and social features for UC Berkeley's Recreational Sports Facility (RSF).

### Key Features
- Real-time RSF weight room capacity meter
- Group fitness class schedules
- Workout logging with streak tracking
- Basketball court check-in system (Hoopers)
- Peak hours analytics
- Gamified workout tracking (Oski Bear)

---

## Architecture Overview

OSKILIFTS follows a **client-server architecture** with:

- **Frontend:** React Native app (iOS, Android, Web) using Expo
- **Backend:** Node.js/Express REST API server
- **Data Storage:** 
  - Client-side: AsyncStorage (local device storage)
  - Server-side: Supabase Postgres (`capacity_snapshots` for peak-hours analytics)
  - In-memory: JavaScript Map (basketball check-ins)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  React Native App (iOS/Android/Web)                          │
│  ├── TypeScript/TSX Components                               │
│  ├── React Navigation (Tab + Stack)                          │
│  ├── AsyncStorage (Local Data)                              │
│  └── API Service Layer                                       │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTP/REST API
                   │ (JSON)
┌──────────────────▼───────────────────────────────────────────┐
│                      SERVER LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  Node.js/Express Server                                      │
│  ├── REST API Endpoints                                      │
│  ├── Data Collection Service                                 │
│  ├── Peak Hours Analytics                                    │
│  └── CORS Middleware                                         │
└──────────────────┬───────────────────────────────────────────┘
                   │ External APIs
┌──────────────────▼───────────────────────────────────────────┐
│                  EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────┤
│  ├── Density API (Gym Capacity)                             │
│  ├── Mindbody Widget API (Class Schedules)                  │
│  └── Cloud Deployment (Vercel, Render)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Languages & Technologies

### Frontend Languages

1. **TypeScript** (Primary)
   - Type-safe JavaScript superset
   - Used for all React components and services
   - Configuration: tsconfig.json (extends Expo base config)
   - Version: 5.9.2

2. **TSX/JSX** (React)
   - Component markup syntax
   - Used in all screen and component files

3. **JavaScript** (Server)
   - Used in server-side code (server/ directory)
   - Node.js runtime (v18+)

### Frontend Technologies

1. **React Native** (v0.81.5)
   - Cross-platform mobile framework
   - Enables iOS, Android, and Web from single codebase

2. **React** (v19.1.0)
   - UI library for building components
   - Hooks: useState, useEffect, useCallback, useMemo

3. **Expo** (v54.0.25)
   - Development platform for React Native
   - Provides build tools, dev server, and deployment
   - Enables "Expo Go" for quick testing

4. **React Navigation** (v7.x)
   - Navigation library
   - @react-navigation/native - Core navigation
   - @react-navigation/native-stack - Stack navigation
   - @react-navigation/bottom-tabs - Tab navigation

5. **React Native Web** (v0.21.0)
   - Allows React Native components to run in browsers
   - Enables web deployment from same codebase

6. **React Native SVG** (v15.12.1)
   - SVG rendering for React Native
   - Used for Oski Bear illustrations

7. **React Native Calendars** (v1.1313.0)
   - Calendar component library
   - Used in workout history screen

8. **AsyncStorage** (v2.2.0)
   - Local key-value storage
   - Persists workouts, custom exercises, user preferences

### Backend Technologies

1. **Node.js** (v18+)
   - JavaScript runtime
   - Required for built-in fetch API

2. **Express.js** (v5.1.0)
   - Web framework for Node.js
   - Handles HTTP requests, routing, middleware

3. **CORS** (v2.8.5)
   - Cross-Origin Resource Sharing middleware
   - Allows frontend to call backend from different origins

4. **Cheerio** (v1.1.2)
   - Server-side HTML parsing (jQuery-like)
   - Used to parse Mindbody widget HTML

5. **dotenv** (v17.2.3)
   - Environment variable management
   - Loads .env file configuration

### Development Tools

1. **TypeScript Compiler** (v5.9.2)
   - Type checking and compilation
   - Dev dependency

2. **ts-node** (v10.9.2)
   - TypeScript execution for Node.js
   - Dev dependency

3. **Expo CLI**
   - Command-line tools for Expo
   - Development server, build commands

4. **npm** (Node Package Manager)
   - Dependency management
   - Script execution

---

## Technical Concepts

### 1. Cross-Platform Development
- **Single Codebase:** One TypeScript/React Native codebase runs on iOS, Android, and Web
- **Platform Detection:** Uses Platform.OS to conditionally render platform-specific code
- **React Native Web:** Translates React Native components to web-compatible HTML/CSS

### 2. REST API Architecture
- **RESTful Design:** Standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON Communication:** All API responses in JSON format
- **Stateless:** Each request contains all necessary information
- **Resource-Based URLs:** /api/weightroom, /api/classes, /api/hoopers

### 3. Caching Strategy
- **Client-Side Caching:** AsyncStorage for instant data loading
- **Server-Side Caching:** In-memory Map cache (30s for weight room, 5min for classes)
- **Cache Headers:** HTTP Cache-Control headers for browser caching
- **Stale-While-Revalidate:** Show cached data, fetch fresh in background

### 4. State Management
- **React Hooks:** useState, useEffect, useCallback, useMemo
- **Local State:** Component-level state management
- **AsyncStorage:** Persistent state across app restarts
- **No Redux/MobX:** Simple hook-based state management

### 5. Data Persistence
- **Client-Side:** AsyncStorage (workouts, custom exercises, user preferences)
- **Server-Side:** Supabase Postgres (`capacity_snapshots` table) for peak-hours analytics (persistent across Render deploys)
- **In-Memory:** JavaScript Map (basketball check-ins - temporary)

### 6. API Integration Patterns
- **Public API Tokens:** Density API uses public share tokens
- **Widget Embedding:** Mindbody widget API designed for embedding
- **Rate Limiting:** Respects API rate limits with caching
- **Error Handling:** Graceful fallbacks when APIs fail

### 7. Scheduled Jobs
- **setInterval:** Periodic data collection (every 5 minutes)
- **Background Processing:** Non-blocking data collection
- **Data Retention:** 90-day rolling window for capacity data

### 8. Type Safety
- **TypeScript:** Compile-time type checking
- **Type Definitions:** Custom types in src/types/
- **Interface Definitions:** API response types, component props

### 9. Navigation Architecture
- **Tab Navigation:** Bottom tabs (Home, Workouts, Hoopers)
- **Stack Navigation:** Nested navigation within tabs
- **Type-Safe Navigation:** TypeScript types for navigation params

### 10. Responsive Design
- **Flexbox Layout:** React Native's default layout system
- **Safe Area Context:** Handles notches and system UI
- **Platform-Specific Styles:** Conditional styling for iOS/Android

---

## Tools & Services

### Development Tools

1. **Expo CLI**
   - Development server
   - QR code generation for testing
   - Build commands

2. **Node.js**
   - Runtime environment
   - Package management (npm)
   - Server execution

3. **Git**
   - Version control
   - Code collaboration

4. **VS Code / Cursor**
   - Code editor
   - TypeScript support
   - Debugging

### Deployment Platforms

1. **Vercel** (Frontend - Web)
   - **Purpose:** Hosts static web build
   - **Configuration:** vercel.json
   - **Build Command:** npm run web:build
   - **Output Directory:** dist/
   - **Features:**
     - Automatic HTTPS
     - CDN distribution
     - Custom domain support
     - Environment variables
   - **URL:** https://oskilifts.com

2. **Render** (Backend - API Server)
   - **Purpose:** Hosts Node.js/Express API server
   - **Configuration:** Procfile (web: node server/index.js)
   - **Build Command:** npm install
   - **Start Command:** node server/index.js
   - **Features:**
     - Free tier available
     - Auto-deploy from GitHub
     - Environment variables
     - Health checks
   - **URL:** https://oskilifts.onrender.com

3. **Railway** (Alternative Backend)
   - **Purpose:** Alternative to Render for API hosting
   - **Features:**
     - Auto-detects Node.js
     - GitHub integration
     - Environment variables

### External Services & APIs

1. **Supabase**
   - **Purpose:** Store periodic weight-room capacity snapshots for peak-hours charts
   - **Setup:** Run `server/migrations/001_capacity_snapshots.sql` in the Supabase SQL editor
   - **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` on the Render API service

2. **Density API**
   - **Purpose:** Real-time gym capacity data
   - **Base URL:** https://api.density.io/v2
   - **Endpoints Used:**
     - /displays/{DISPLAY_ID} - Display configuration
     - /spaces/{SPACE_ID}/count - Current occupancy count
   - **Authentication:** Public share token (shr_*)
   - **Rate Limiting:** 30-second cache to respect limits

3. **Mindbody Widget API**
   - **Purpose:** Group fitness class schedules
   - **Base URL:** https://widgets.mindbodyonline.com
   - **Endpoint:** /widgets/schedules/{WIDGET_ID}/load_markup
   - **Data Format:** HTML widget (parsed with Cheerio)
   - **Caching:** 5-minute cache

4. **Expo Application Services (EAS)**
   - **Purpose:** Build standalone iOS/Android apps
   - **Features:**
     - Cloud builds
     - App Store distribution
     - Over-the-air updates

### Development Utilities

1. **ngrok**
   - **Purpose:** Local tunnel for testing
   - **Use Case:** Expose local API to mobile devices
   - **Alternative:** Expo's built-in tunneling

2. **jq** (Optional)
   - **Purpose:** JSON parsing in terminal
   - **Use Case:** Testing API endpoints

---

## Data Flow & Workflow

### Weight Room Capacity Flow

1. User opens app → HomeScreen loads
2. Frontend calls fetchWeightRoomStatus()
3. Check AsyncStorage cache → Return cached if available
4. If no cache, fetch from API: GET /api/weightroom
5. Backend receives request
6. Check in-memory cache (30s TTL)
7. If cache expired, fetch from Density API:
   - GET /displays/{DISPLAY_ID}
   - GET /spaces/{SPACE_ID}/count
8. Parse and format data
9. Store in cache (30s)
10. Return JSON response
11. Frontend receives data
12. Store in AsyncStorage cache
13. Update UI with capacity data
14. Background: Fetch fresh data for next load

### Scheduled Data Collection Flow

1. Server starts → setInterval scheduled (every 5 minutes)
2. collectCapacitySnapshot() runs
3. Fetch current capacity from Density API
4. Transform to snapshot format (Pacific-local day/hour for consistency):
   - recorded_at (ISO timestamp)
   - day_of_week (0–6, Pacific)
   - hour / minute (Pacific)
   - current_count, max_capacity, percentage, is_open
5. Insert row into Supabase `capacity_snapshots` (skipped if `SUPABASE_*` env vars are unset)
6. Retention: queries use roughly the last 90 days of rows

### Peak Hours Analysis Flow

1. User views HomeScreen → loadPeakHours() called
2. Frontend calls GET /api/peak-hours
3. Backend loads snapshots from Supabase (up to ~50k recent rows)
4. If fewer than ~20 samples: return “collecting data” plus a friendly recommendation payload
5. If enough data:
   - Build per-day hourly averages (6 AM–11 PM) for the chart
   - Compute global busiest/quietest slots and busiest day
   - Derive a go/wait/best-time recommendation from typical occupancy vs. current Pacific time
6. Return JSON consumed by `PeakHoursChart` (bar chart, day chips, recommendation banner)

**Note:** Render’s free tier sleeps after ~15 minutes without traffic, which pauses snapshot collection unless something wakes the service (e.g. periodic ping to `GET /api/health`).

### Workout Logging Flow

1. User navigates to Workouts tab
2. User taps "Log Workout"
3. LogWorkoutScreen opens
4. User selects:
   - Date
   - Workout day type (Legs, Push, Pull, etc.)
   - Exercises (with sets/reps)
   - Optional notes
5. User taps "Save"
6. Frontend validates data
7. Create Workout object
8. Load existing workouts from AsyncStorage
9. Add/update workout in array
10. Save back to AsyncStorage
11. Navigate back to WorkoutsScreen
12. WorkoutsScreen reloads and displays updated list
13. Oski Bear streak recalculates

### Basketball Check-In Flow

1. User navigates to Hoopers tab
2. Frontend calls GET /api/hoopers
3. Backend receives request
4. Cleanup expired check-ins (older than 1 hour)
5. Count active check-ins in memory Map
6. Calculate crowdedness status:
   - ≤12: "Not Crowded"
   - 13-20: "Moderate"
   - >20: "Very Crowded"
7. Return { count, status }
8. Frontend displays current count and status
9. User taps "I'm Playing Basketball"
10. Frontend calls POST /api/hoopers/checkin
11. Backend creates check-in entry:
    - userId (from AsyncStorage or generated)
    - checkedInAt (timestamp)
    - expiresAt (checkedInAt + 1 hour)
12. Store in memory Map
13. Return updated count and status
14. Frontend updates UI

---

## API Endpoints

### Backend API (Express Server)

**Base URL:** http://localhost:4000 (dev) or https://oskilifts.onrender.com (prod)

#### 1. Health Check
- **Endpoint:** GET /api/health
- **Response:** { ok: true, time: "ISO timestamp" }
- **Purpose:** Server health monitoring

#### 2. Weight Room Capacity
- **Endpoint:** GET /api/weightroom
- **Response:** JSON with occupancy, capacity, percent, status, message, updatedAt, isOpen, hours
- **Cache:** 2 minutes (client), 30 seconds (server)
- **Source:** Density API

#### 3. Group Fitness Classes
- **Endpoint:** GET /api/classes?startDate=YYYY-MM-DD
- **Response:** JSON with startDate and days array containing sessions
- **Cache:** 30 minutes
- **Source:** Mindbody Widget API

#### 4. Basketball Court Status
- **Endpoint:** GET /api/hoopers
- **Response:** { count: 15, status: "Moderate" }
- **Cache:** 30 seconds

#### 5. Basketball Check-In
- **Endpoint:** POST /api/hoopers/checkin
- **Body:** { userId: "user-123" }
- **Response:** { success: true, userId: "...", checkedInAt: timestamp, count: 16, status: "..." }

#### 6. Basketball Check-Out
- **Endpoint:** POST /api/hoopers/checkout
- **Body:** { userId: "user-123" }
- **Response:** { success: true, wasCheckedIn: true, count: 15, status: "..." }

#### 7. Basketball Status Check
- **Endpoint:** GET /api/hoopers/status/:userId
- **Response:** { checkedIn: true }

#### 8. Peak Hours Analysis
- **Endpoint:** GET /api/peak-hours
- **Response:** JSON with hasData, busiest, bestTime, busiestDay, totalSamples, dataRange
- **Cache:** 1 hour

#### 9. Raw Capacity Data (Debug)
- **Endpoint:** GET /api/capacity-data
- **Response:** { totalSamples: 1250, data: [...], summary: {...} }
- **Purpose:** View collected capacity data for analysis

---

## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    USER DEVICES                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   iOS    │  │ Android │  │   Web    │              │
│  │   App    │  │   App   │  │ Browser  │              │
│  └────┬─────┘  └────┬────┘  └────┬─────┘              │
└───────┼─────────────┼────────────┼────────────────────┘
        │             │             │
        │ HTTPS       │ HTTPS       │ HTTPS
        │             │             │
┌───────▼─────────────▼────────────▼────────────────────┐
│                    VERCEL                               │
│  ┌──────────────────────────────────────────────┐     │
│  │  Static Web Build (dist/)                     │     │
│  │  - React Native Web bundle                    │     │
│  │  - SPA routing                                │     │
│  │  - CDN distribution                           │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
        │
        │ API Calls (HTTPS)
        │
┌───────▼────────────────────────────────────────────────┐
│                    RENDER                               │
│  ┌──────────────────────────────────────────────┐     │
│  │  Node.js/Express API Server                  │     │
│  │  - REST API endpoints                        │     │
│  │  - Data collection service                   │     │
│  │  - Peak hours analytics                      │     │
│  │  - CORS middleware                           │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
        │
        │ External API Calls
        │
┌───────▼────────────────────────────────────────────────┐
│              EXTERNAL APIS                               │
│  ┌──────────────┐  ┌──────────────────┐               │
│  │ Density API  │  │ Mindbody Widget  │               │
│  │ (Capacity)   │  │ (Class Schedule) │               │
│  └──────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### Development Environment

```
┌─────────────────────────────────────────────────────────┐
│              LOCAL DEVELOPMENT                          │
│                                                         │
│  Terminal 1:                                           │
│  ┌──────────────────────────────────────────────┐     │
│  │  npm run server                               │     │
│  │  → Express server on localhost:4000          │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  Terminal 2:                                           │
│  ┌──────────────────────────────────────────────┐     │
│  │  npm start (or npx expo start)                │     │
│  │  → Expo dev server on localhost:8081          │     │
│  │  → Opens web browser or mobile simulator     │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  Mobile Device (Optional):                             │
│  ┌──────────────────────────────────────────────┐     │
│  │  Expo Go app                                  │     │
│  │  → Scan QR code                               │     │
│  │  → Connects to local server via network IP    │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Build Process

**Web Build:**
```bash
npm run web:build
→ Expo exports static web bundle
→ Output: dist/ directory
→ Deploy to Vercel
```

**Mobile Build:**
```bash
eas build --platform ios
eas build --platform android
→ Expo Application Services builds native apps
→ Output: .ipa (iOS) or .aab (Android)
→ Submit to App Stores
```

---

## External Integrations

### 1. Density API Integration

**Purpose:** Real-time gym capacity monitoring

**Implementation:**
- Uses public share token from RSF website
- Two API calls per request:
  1. /displays/{DISPLAY_ID} - Gets display configuration and capacity limits
  2. /spaces/{SPACE_ID}/count - Gets current occupancy count

**Data Flow:**
```
Density Sensors → Density Cloud → Density API → OSKILIFTS Backend → OSKILIFTS Frontend
```

**Rate Limiting:**
- 30-second server-side cache
- Respects Density's "Safe Display" rate limits

**Error Handling:**
- Graceful fallback if API unavailable
- Shows "Closed" status during non-operating hours
- Handles network timeouts

### 2. Mindbody Widget API Integration

**Purpose:** Group fitness class schedules

**Implementation:**
- Public widget endpoint designed for embedding
- HTML response parsed with Cheerio
- Extracts class details: name, time, instructor, location, cancellation status

**Data Flow:**
```
Mindbody System → Mindbody Widget API → OSKILIFTS Backend → Parse HTML → JSON → Frontend
```

**Caching:**
- 5-minute cache (classes don't change frequently)
- Reduces API calls

**Parsing:**
- Uses Cheerio (jQuery-like server-side HTML parser)
- Extracts structured data from HTML widget
- Handles cancellation status from embedded JSON

---

## File Structure

```
OSKILIFTS/
├── server/                          # Backend server code
│   ├── index.js                     # Express server, API routes
│   ├── rsfService.js               # Density & Mindbody API integration
│   ├── hoopersService.js           # Basketball check-in logic
│   ├── dataCollectionService.js    # Capacity data storage
│   ├── peakHoursAnalytics.js       # Peak hours analysis
│   └── analyzeCapacityData.js      # Data analysis script
│
├── src/                             # Frontend source code
│   ├── components/                  # Reusable React components
│   ├── screens/                     # App screens
│   ├── services/                    # Business logic
│   ├── types/                       # TypeScript type definitions
│   ├── navigation/                  # Navigation configuration
│   ├── data/                        # Static data
│   └── config/                      # Configuration
│
├── assets/                          # Static assets
├── data/                            # Server-side data storage
├── dist/                            # Web build output (generated)
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── app.json                         # Expo app configuration
├── vercel.json                      # Vercel deployment config
├── Procfile                         # Render deployment config
└── README.md                        # Project documentation
```

---

## Key Configuration Files

### package.json
- **Dependencies:** All npm packages
- **Scripts:** Build and run commands
- **Main:** Entry point for Expo

### tsconfig.json
- **Extends:** Expo base TypeScript config
- **Strict Mode:** Enabled for type safety

### app.json
- **Expo Config:** App name, version, icons, splash screens
- **Platform Settings:** iOS/Android/Web specific configs

### vercel.json
- **Build Command:** npm run web:build
- **Output Directory:** dist/
- **Rewrites:** SPA routing (all routes → index.html)
- **Headers:** Cache control for static assets

### Procfile
- **Web Process:** node server/index.js
- **Used by:** Render, Heroku, Railway

---

## Development Workflow

### Local Development

1. **Clone Repository**
   ```bash
   git clone <repo-url>
   cd OSKILIFTS
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

4. **Start Backend Server**
   ```bash
   npm run server
   # Server runs on http://localhost:4000
   ```

5. **Start Frontend (New Terminal)**
   ```bash
   npm start
   # Expo dev server starts
   # Press 'w' for web, 'i' for iOS, 'a' for Android
   ```

### Testing

**API Testing:**
```bash
# Health check
curl http://localhost:4000/api/health

# Weight room capacity
curl http://localhost:4000/api/weightroom | jq

# Class schedule
curl http://localhost:4000/api/classes | jq

# Peak hours
curl http://localhost:4000/api/peak-hours | jq
```

**Data Analysis:**
```bash
node server/analyzeCapacityData.js
```

### Building for Production

**Web Build:**
```bash
npm run web:build
# Output: dist/ directory
# Deploy to Vercel
```

**Mobile Build:**
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build
eas build --platform ios
eas build --platform android
```

---

## Deployment Workflow

### Backend Deployment (Render)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Render Auto-Deploys**
   - Detects Procfile
   - Runs npm install
   - Starts node server/index.js
   - Provides URL: https://oskilifts.onrender.com

3. **Set Environment Variables**
   - In Render dashboard
   - Add all variables from `.env`, including **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** (required for persistent peak-hours data)

4. **Wake pings (optional, free tier)**  
   Use an external cron or uptime monitor to hit `GET /api/health` every ~10 minutes so the API stays warm and the 5‑minute snapshot job keeps running.

### Frontend Deployment (Vercel)

1. **Build Web Bundle**
   ```bash
   npm run web:build
   ```

2. **Deploy to Vercel**
   ```bash
   npx vercel
   # Or connect GitHub repo for auto-deploy
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add EXPO_PUBLIC_OSKILIFTS_API_URL
   # Enter: https://oskilifts.onrender.com
   ```

4. **Redeploy**
   ```bash
   vercel --prod
   ```

---

## Security Considerations

1. **CORS Configuration**
   - Allows specific origins in production
   - Allows all origins in development
   - Prevents unauthorized API access

2. **Environment Variables**
   - Sensitive data in .env (gitignored)
   - Public tokens are safe (designed for public use)
   - No authentication required (public APIs)

3. **Rate Limiting**
   - Caching prevents API abuse
   - Respects external API rate limits

4. **Data Privacy**
   - No user authentication
   - Local data stored on device
   - No personal information collected

---

## Performance Optimizations

1. **Caching Strategy**
   - Client-side: AsyncStorage for instant loads
   - Server-side: In-memory cache with TTL
   - HTTP: Cache-Control headers

2. **Lazy Loading**
   - Components load on demand
   - Images optimized

3. **Code Splitting**
   - Expo handles bundle optimization
   - Web build optimized for size

4. **API Optimization**
   - Batch requests where possible
   - Background refresh (stale-while-revalidate)
   - Request timeouts prevent hanging

---

## Known Limitations

1. **Basketball Check-Ins**
   - In-memory storage (lost on restart)
   - No persistence across server restarts
   - User-reported (not sensor-based)

2. **Data Collection**
   - Requires server to be running continuously
   - Free tier services may sleep after inactivity

3. **Mobile Apps**
   - Requires Expo Go for development
   - Standalone builds require Apple Developer account ($99/year)

---

## Future Enhancements

1. **Database Integration**
   - Extend Postgres usage (e.g. user accounts) beyond peak-hours snapshots
   - Persistent basketball check-ins
   - User accounts and authentication

2. **Real-Time Updates**
   - WebSocket connections
   - Push notifications for capacity changes

3. **Advanced Analytics**
   - Machine learning for peak hour predictions
   - Historical trend analysis
   - User workout insights

4. **Social Features**
   - Friend connections
   - Workout sharing
   - Leaderboards

---

## Conclusion

OSKILIFTS is a modern, cross-platform fitness application built with React Native, TypeScript, and Node.js. It demonstrates:

- **Full-stack development** (frontend + backend)
- **Cross-platform deployment** (iOS, Android, Web)
- **API integration** (Density, Mindbody)
- **Data analytics** (peak hours analysis)
- **Modern tooling** (Expo, Vercel, Render)
- **Best practices** (TypeScript, REST APIs, caching)

The architecture is scalable, maintainable, and follows industry best practices for modern web and mobile development.

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Author:** OSKILIFTS Development Team
