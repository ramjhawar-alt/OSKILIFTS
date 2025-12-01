const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const {
  fetchWeightRoomStatus,
  fetchGroupFitnessSchedule,
  getPacificISODate,
} = require('./rsfService');
const {
  checkIn,
  checkOut,
  getActiveCount,
  getCrowdednessStatus,
  cleanupExpired,
  isCheckedIn,
} = require('./hoopersService');
const { storeCapacitySnapshot } = require('./dataCollectionService');
const { analyzePeakHours } = require('./peakHoursAnalytics');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const STATIC_DIR = path.join(__dirname, '..', 'dist');
const HAS_WEB_BUILD = fs.existsSync(STATIC_DIR);
const app = express();

// CORS configuration - allow requests from Expo dev server, localhost, and Vercel
// In development, allow all origins
// In production, allow Vercel domains and Render domains
const isDevelopment = process.env.NODE_ENV !== 'production';

// More permissive CORS - allow all Vercel domains (including preview deployments)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (isDevelopment) {
      return callback(null, true);
    }
    
    // In production, allow:
    // - All localhost origins
    // - All Vercel domains (including preview URLs)
    // - Render domains
    // - Custom domains (any https domain)
    const allowedPatterns = [
      /^http:\/\/localhost(:\d+)?$/,  // localhost with optional port
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,  // 127.0.0.1 with optional port
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,  // Local network IPs (192.168.x.x)
      /^http:\/\/172\.\d+\.\d+\.\d+(:\d+)?$/,  // Local network IPs (172.x.x.x)
      /^https:\/\/.*\.vercel\.app$/,  // All Vercel app domains (including preview)
      /^https:\/\/.*\.vercel\.dev$/,  // Vercel development deployments
      /^https:\/\/.*\.onrender\.com$/, // Render deployments
      /^https:\/\/.*$/,  // Allow any HTTPS domain (for custom domains)
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware to ensure API routes always return JSON
app.use('/api', (req, res, next) => {
  // Set JSON content type for all API routes
  res.setHeader('Content-Type', 'application/json');
  console.log(`[API Middleware] ${req.method} ${req.path} - Content-Type set to application/json`);
  next();
});

app.get('/api/health', (req, res) => {
  console.log(`[API] Health check from: ${req.headers.origin || 'unknown'} (${req.ip})`);
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/weightroom', async (req, res) => {
  console.log(`[API] GET /api/weightroom - Request received from: ${req.headers.origin || 'unknown'} (${req.ip})`);
  try {
    const data = await fetchWeightRoomStatus();
    console.log(`[API] GET /api/weightroom - Success, returning data`);
    
    // Store capacity snapshot for peak hours analysis (non-blocking)
    try {
      storeCapacitySnapshot(data);
    } catch (collectionError) {
      // Don't fail the request if data collection fails
      console.warn('[DataCollection] Failed to store snapshot:', collectionError);
    }
    
    // Add cache headers for client-side caching
    res.setHeader('Cache-Control', 'public, max-age=120'); // Cache for 2 minutes
    res.json(data);
  } catch (error) {
    console.error('[API] Error fetching weight room status:', error);
    res.status(error.status || 500).json({
      error: 'Failed to fetch weight room data',
      details: error.message,
    });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const startDate = req.query.startDate || getPacificISODate();
    const data = await fetchGroupFitnessSchedule(startDate);
    // Add cache headers for client-side caching
    res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache for 30 minutes
    res.json(data);
  } catch (error) {
    console.error('Error fetching class schedule:', error);
    res.status(error.status || 500).json({
      error: 'Failed to fetch class schedule',
      details: error.message,
    });
  }
});

// HOOPERS API endpoints
app.get('/api/hoopers', (_req, res) => {
  try {
    cleanupExpired();
    const count = getActiveCount();
    const status = getCrowdednessStatus(count);
    // Add cache headers for client-side caching (short cache since this changes frequently)
    res.setHeader('Cache-Control', 'public, max-age=30'); // Cache for 30 seconds
    res.json({ count, status });
  } catch (error) {
    console.error('Error fetching hoopers status:', error);
    res.status(500).json({
      error: 'Failed to fetch hoopers status',
      details: error.message,
    });
  }
});

app.post('/api/hoopers/checkin', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = checkIn(userId);
    const count = getActiveCount();
    const status = getCrowdednessStatus(count);
    
    res.json({
      success: true,
      userId: result.userId,
      checkedInAt: result.checkedInAt,
      count,
      status,
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({
      error: 'Failed to check in',
      details: error.message,
    });
  }
});

app.post('/api/hoopers/checkout', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const wasCheckedIn = checkOut(userId);
    const count = getActiveCount();
    const status = getCrowdednessStatus(count);
    
    res.json({
      success: true,
      wasCheckedIn,
      count,
      status,
    });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({
      error: 'Failed to check out',
      details: error.message,
    });
  }
});

app.get('/api/hoopers/status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const checkedIn = isCheckedIn(userId);
    res.json({ checkedIn });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      error: 'Failed to check status',
      details: error.message,
    });
  }
});

// Peak hours analytics endpoint
app.get('/api/peak-hours', (_req, res) => {
  try {
    const analysis = analyzePeakHours();
    // Cache for 1 hour since this doesn't change frequently
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing peak hours:', error);
    res.status(500).json({
      error: 'Failed to analyze peak hours',
      details: error.message,
    });
  }
});

// 404 handler for API routes - must come after all API route handlers
app.use('/api', (req, res) => {
  console.log(`[API] 404 - Endpoint not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
  });
});

if (HAS_WEB_BUILD) {
  console.log(`Serving static web build from ${STATIC_DIR}`);
  // Serve static files ONLY for non-API routes
  app.use((req, res, next) => {
    // Explicitly skip API routes - don't even try to serve static files
    if (req.path.startsWith('/api')) {
      console.log(`[Static] Skipping static file serving for API route: ${req.path}`);
      return next();
    }
    // Use express.static middleware for non-API routes only
    const staticMiddleware = express.static(STATIC_DIR, { index: false });
    staticMiddleware(req, res, (err) => {
      // If static file not found, continue to next middleware
      if (err && err.status === 404) {
        return next();
      }
      next(err);
    });
  });
  // Catch-all handler for non-API routes - serve index.html for SPA routing
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  console.warn('No web build detected. Run `npm run web:build` to generate one.');
}

// Global error handler to ensure JSON responses
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  // Only send JSON for API routes
  if (req.path.startsWith('/api')) {
    res.status(err.status || 500).json({
      error: 'Internal server error',
      details: err.message,
    });
  } else {
    next(err);
  }
});

// Cleanup expired check-ins every 5 minutes
setInterval(() => {
  cleanupExpired();
}, 5 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OSKILIFTS server listening on http://0.0.0.0:${PORT}`);
  if (HAS_WEB_BUILD) {
    console.log(`Web app available at http://0.0.0.0:${PORT}`);
  } else {
    console.log('API ready at /api. Static web build not found.');
  }
});

