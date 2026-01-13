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

const router = Router();

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
  skip: (req) => {
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
router.post('/upload', youtubeLimiter, createYouTubeUploadController);

// GET /api/youtube/uploads - Get user's YouTube uploads (read-only, loose rate limit)
router.get('/uploads', readOnlyLimiter, getYouTubeUploadsController);

// GET /api/youtube/limits - Get user's YouTube upload limits (read-only, loose rate limit)
router.get('/limits', readOnlyLimiter, getYouTubeLimitsController);

// PUT /api/youtube/upload/:id/archive - Archive or unarchive a YouTube upload
// MUST come before /upload/:id to avoid route matching conflicts
router.put('/upload/:id/archive', templateWriteLimiter, archiveYouTubeUploadController);

// PUT /api/youtube/upload/:id - Update a YouTube upload
router.put('/upload/:id', templateWriteLimiter, updateYouTubeUploadController);

// DELETE /api/youtube/upload/:id - Delete a YouTube upload
router.delete('/upload/:id', youtubeLimiter, deleteYouTubeUploadController);

// POST /api/youtube/process - Process pending uploads (internal/admin)
router.post('/process', processPendingUploadsController);

// OAuth routes
// POST /api/youtube/oauth/authorize - Generate OAuth authorization URL
router.post('/oauth/authorize', authorizeController);

// POST /api/youtube/oauth/callback - Exchange code for tokens
router.post('/oauth/callback', callbackController);

// GET /api/youtube/oauth/status - Check OAuth connection status (read-only, loose rate limit)
router.get('/oauth/status', readOnlyLimiter, statusController);

// POST /api/youtube/oauth/disconnect - Disconnect YouTube account
router.post('/oauth/disconnect', youtubeLimiter, disconnectController);

// Templates routes
// GET /api/youtube/templates - Get user's templates (read-only, loose rate limit)
router.get('/templates', readOnlyLimiter, getTemplatesController);

// POST /api/youtube/templates - Create a new template (moderate rate limit)
router.post('/templates', templateWriteLimiter, createTemplateController);

// PUT /api/youtube/templates/:id - Update a template (moderate rate limit)
router.put('/templates/:id', templateWriteLimiter, updateTemplateController);

// DELETE /api/youtube/templates/:id - Delete a template (moderate rate limit)
router.delete('/templates/:id', templateWriteLimiter, deleteTemplateController);

export { router as youtubeRouter };

