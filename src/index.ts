import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
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
  console.warn('⚠️ No .env.local or .env file found. Environment variables must come from the host.');
} else {
  const supabaseKeys = Object.entries(process.env)
    .filter(([key]) => key.startsWith('SUPABASE_') || key === 'FRONTEND_URL')
    .map(([key, value]) => `${key}=${value ? `${value.substring(0, 6)}...` : '(empty)'}`)
    .join(', ');
  console.log(`✅ Supabase env snapshot: ${supabaseKeys}`);
}

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

// Stricter rate limit for YouTube endpoints
const youtubeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 YouTube requests per windowMs
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

// YouTube routes with stricter rate limiting (includes templates)
app.use('/api/youtube', youtubeLimiter, youtubeRouter);

// Health check with loose rate limiting
app.get('/health', healthLimiter, (_, res) => {
  res.json({ status: 'ok', service: 'youtube-api', timestamp: new Date().toISOString() });
});

// Error handler middleware (must be last)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ YouTube API error handler triggered:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    status: err.status,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Unexpected server error',
  });
});

// Start the server (Railway or local development)
app.listen(PORT, () => {
  console.log(`🚀 YouTube API listening on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎬 FFmpeg: Available for video processing`);
});

