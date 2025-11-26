// YouTube upload routes
import { Router } from 'express';
import {
  createYouTubeUploadController,
  getYouTubeUploadsController,
  getYouTubeLimitsController,
  deleteYouTubeUploadController,
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

// POST /api/youtube/upload - Create a YouTube upload request
router.post('/upload', createYouTubeUploadController);

// GET /api/youtube/uploads - Get user's YouTube uploads
router.get('/uploads', getYouTubeUploadsController);

// GET /api/youtube/limits - Get user's YouTube upload limits
router.get('/limits', getYouTubeLimitsController);

// DELETE /api/youtube/upload/:id - Delete a YouTube upload
router.delete('/upload/:id', deleteYouTubeUploadController);

// POST /api/youtube/process - Process pending uploads (internal/admin)
router.post('/process', processPendingUploadsController);

// OAuth routes
// POST /api/youtube/oauth/authorize - Generate OAuth authorization URL
router.post('/oauth/authorize', authorizeController);

// POST /api/youtube/oauth/callback - Exchange code for tokens
router.post('/oauth/callback', callbackController);

// GET /api/youtube/oauth/status - Check OAuth connection status
router.get('/oauth/status', statusController);

// POST /api/youtube/oauth/disconnect - Disconnect YouTube account
router.post('/oauth/disconnect', disconnectController);

// Templates routes
// GET /api/youtube/templates - Get user's templates
router.get('/templates', getTemplatesController);

// POST /api/youtube/templates - Create a new template
router.post('/templates', createTemplateController);

// PUT /api/youtube/templates/:id - Update a template
router.put('/templates/:id', updateTemplateController);

// DELETE /api/youtube/templates/:id - Delete a template
router.delete('/templates/:id', deleteTemplateController);

export { router as youtubeRouter };

