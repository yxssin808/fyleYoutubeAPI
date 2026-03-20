// YouTube upload routes
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createYouTubeUploadController,
  getYouTubeUploadsController,
  getYouTubeLimitsController,
  deleteYouTubeUploadController,
  archiveYouTubeUploadController,
  updateYouTubeUploadController,
  processPendingUploadsController,
} from '../controllers/youtube.controller.js';
import {
  getTemplatesController,
  createTemplateController,
  updateTemplateController,
  deleteTemplateController,
} from '../controllers/templates.controller.js';
import {
  authorizeController,
  callbackController,
  statusController,
  disconnectController,
} from '../controllers/oauth.controller.js';
import { requireSupabaseAuth } from '../middleware/requireSupabaseAuth.js';

const router = Router();

// Express route handlers in this codebase return `res.json(...)` in many branches.
// TypeScript expects handlers to return `void | Promise<void>`, so we wrap them.
const wrapHandler = (fn: any) => {
  return (req: any, res: any, next: any) => {
    void Promise.resolve(fn(req, res)).catch(next);
  };
};

// Loose rate limit for read-only endpoints (limits, status, templates)
// These are called frequently by the frontend
const readOnlyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 requests per minute (1 per second)
  message: {
    error: 'Too many read requests from this IP, please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: any) => {
    // Skip rate limiting for health checks or if user is authenticated (optional)
    return false;
  },
});

// Moderate rate limit for template write operations (create, update, delete)
// Less strict than YouTube uploads but still limited to prevent abuse
const templateWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Allow 20 template operations per minute
  message: {
    error: 'Too many template operations from this IP, please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for YouTube write endpoints (upload, delete, etc.)
const youtubeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 YouTube write requests per windowMs
  message: {
    error: 'Too many YouTube requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/youtube/upload - Create a YouTube upload request
router.post('/upload', youtubeLimiter, requireSupabaseAuth, wrapHandler(createYouTubeUploadController));

// GET /api/youtube/uploads - Get user's YouTube uploads (read-only, loose rate limit)
router.get('/uploads', readOnlyLimiter, requireSupabaseAuth, wrapHandler(getYouTubeUploadsController));

// GET /api/youtube/limits - Get user's YouTube upload limits (read-only, loose rate limit)
router.get('/limits', readOnlyLimiter, requireSupabaseAuth, wrapHandler(getYouTubeLimitsController));

// PUT /api/youtube/upload/:id/archive - Archive or unarchive a YouTube upload
// MUST come before /upload/:id to avoid route matching conflicts
router.put('/upload/:id/archive', templateWriteLimiter, requireSupabaseAuth, wrapHandler(archiveYouTubeUploadController));

// PUT /api/youtube/upload/:id - Update a YouTube upload
router.put('/upload/:id', templateWriteLimiter, requireSupabaseAuth, wrapHandler(updateYouTubeUploadController));

// DELETE /api/youtube/upload/:id - Delete a YouTube upload
router.delete('/upload/:id', youtubeLimiter, requireSupabaseAuth, wrapHandler(deleteYouTubeUploadController));

// POST /api/youtube/process - Process pending uploads (internal/admin)
router.post('/process', wrapHandler(processPendingUploadsController));

// OAuth routes
// POST /api/youtube/oauth/authorize - Generate OAuth authorization URL
router.post('/oauth/authorize', wrapHandler(authorizeController));

// POST /api/youtube/oauth/callback - Exchange code for tokens
router.post('/oauth/callback', requireSupabaseAuth, wrapHandler(callbackController));

// GET /api/youtube/oauth/status - Check OAuth connection status (read-only, loose rate limit)
router.get('/oauth/status', readOnlyLimiter, requireSupabaseAuth, wrapHandler(statusController));

// POST /api/youtube/oauth/disconnect - Disconnect YouTube account
router.post('/oauth/disconnect', youtubeLimiter, requireSupabaseAuth, wrapHandler(disconnectController));

// Templates routes
// GET /api/youtube/templates - Get user's templates (read-only, loose rate limit)
router.get('/templates', readOnlyLimiter, requireSupabaseAuth, wrapHandler(getTemplatesController));

// POST /api/youtube/templates - Create a new template (moderate rate limit)
router.post('/templates', templateWriteLimiter, requireSupabaseAuth, wrapHandler(createTemplateController));

// PUT /api/youtube/templates/:id - Update a template (moderate rate limit)
router.put('/templates/:id', templateWriteLimiter, requireSupabaseAuth, wrapHandler(updateTemplateController));

// DELETE /api/youtube/templates/:id - Delete a template (moderate rate limit)
router.delete('/templates/:id', templateWriteLimiter, requireSupabaseAuth, wrapHandler(deleteTemplateController));

export { router as youtubeRouter };

