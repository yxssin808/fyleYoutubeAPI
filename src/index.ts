import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { youtubeRouter } from './routes/youtube.routes.js';

const envFiles = ['.env.local', '.env'];
let envLoaded = false;

for (const file of envFiles) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    console.log(`🔐 Loaded environment variables from ${file}`);
  }
}

if (!envLoaded) {
  // This is normal on Railway/production - environment variables come from Railway
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    console.log('ℹ️ Running in production - environment variables loaded from Railway/host');
  } else {
    console.warn('⚠️ No .env.local or .env file found. Environment variables must come from the host.');
  }
} else {
  const supabaseKeys = Object.entries(process.env)
    .filter(([key]) => key.startsWith('SUPABASE_') || key === 'FRONTEND_URL')
    .map(([key, value]) => `${key}=${value ? `${value.substring(0, 6)}...` : '(empty)'}`)
    .join(', ');
  console.log(`✅ Supabase env snapshot: ${supabaseKeys}`);
}

// Debug: Check Google OAuth environment variables on startup
console.log('🔍 Google OAuth Environment Variables Check:', {
  hasGOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  hasGOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  hasGOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI,
  clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
  clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
  clientIdPreview: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 30)}...` : 'MISSING',
  allGoogleKeys: Object.keys(process.env).filter(key => key.includes('GOOGLE')).join(', '),
});

const app = express();
const PORT = Number(process.env.PORT || 4001);

// Trust proxy - required for accurate IP detection behind Railway/proxy/Vercel
// Set to 1 to only trust the first proxy (Vercel), which fixes rate limiting warnings
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for YouTube write endpoints (upload, delete, etc.)
const youtubeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 YouTube write requests per windowMs (increased from 30)
  message: {
    error: 'Too many YouTube requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check with loose rate limiting
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 health checks per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://fyle-beta.vercel.app',
  'https://fyle-cloud.com',
  'https://www.fyle-cloud.com',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, origin || true);
      }
      console.warn(`⚠️ CORS: Origin ${origin} not explicitly allowed. Allowing for now.`);
      return callback(null, origin);
    },
    credentials: true,
  }),
);

app.use(express.json());

// YouTube routes - rate limiting is handled per-route in youtubeRouter
// Template routes have their own moderate rate limiting, upload routes use youtubeLimiter
app.use('/api/youtube', youtubeRouter);

// Health check with loose rate limiting
app.get('/health', healthLimiter, (_, res) => {
  res.json({ status: 'ok', service: 'youtube-api', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ YouTube API error:', err);
  res.status(err.status || 500).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Unexpected server error',
  });
});

// Start the server (Railway or local development)
app.listen(PORT, () => {
  console.log(`🚀 YouTube API listening on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check FFmpeg availability (same logic as VideoProcessingService)
  const possiblePaths = [
    process.env.FFMPEG_PATH,
    process.env.FFMPEG_BINARY,
    '/usr/bin/ffmpeg',        // Standard Linux location (Railway/Docker)
    '/usr/local/bin/ffmpeg',  // Alternative Linux location
    '/opt/homebrew/bin/ffmpeg', // macOS Homebrew
    'ffmpeg',                 // System PATH (fallback)
  ].filter(Boolean);
  
  let ffmpegFound = false;
  let ffmpegPath = null;
  
  for (const path of possiblePaths) {
    try {
      const command = process.platform === 'win32' ? `"${path}" -version` : `${path} -version`;
      execSync(command, { stdio: 'ignore', timeout: 5000 });
      ffmpegFound = true;
      ffmpegPath = path;
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (ffmpegFound) {
    console.log(`✅ FFmpeg: Available for video processing (${ffmpegPath})`);
  } else {
    console.warn(`⚠️ FFmpeg: Not found in standard locations.`);
    console.warn(`   VideoProcessingService will search again when needed.`);
    console.warn(`   On Railway: FFmpeg should be installed via Dockerfile at /usr/bin/ffmpeg`);
    console.warn(`   Locally: Install FFmpeg or set FFMPEG_PATH environment variable.`);
  }
  
  // Final check of critical environment variables
  const criticalVars = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    FRONTEND_URL: !!process.env.FRONTEND_URL,
  };
  
  const missingVars = Object.entries(criticalVars)
    .filter(([_, exists]) => !exists)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
    console.error('   Please set these in Railway → Variables');
  } else {
    console.log('✅ All critical environment variables are set');
  }

  // Start background worker to process pending uploads
  // This ensures uploads are processed even if the initial request fails
  console.log('🔄 Starting background upload processor worker...');
  
  const startUploadWorker = async () => {
    try {
      const { UploadProcessorService } = await import('./services/upload-processor.service.js');
      const processor = new UploadProcessorService();
      await processor.processPendingUploads();
    } catch (error: any) {
      console.error('❌ Background worker error:', error.message);
    }
  };

  // Process immediately on startup
  startUploadWorker();

  // Then process every 30 seconds
  setInterval(() => {
    startUploadWorker();
  }, 30000); // Check every 30 seconds

  console.log('✅ Background upload processor worker started (checks every 30 seconds)');
});

