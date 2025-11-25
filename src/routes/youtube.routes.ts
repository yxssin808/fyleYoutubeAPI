// YouTube upload routes
import { Router } from 'express';
import {
  createYouTubeUploadController,
  getYouTubeUploadsController,
  getYouTubeLimitsController,
} from '../controllers/youtube.controller.js';

const router = Router();

// POST /api/youtube/upload - Create a YouTube upload request
router.post('/upload', createYouTubeUploadController);

// GET /api/youtube/uploads - Get user's YouTube uploads
router.get('/uploads', getYouTubeUploadsController);

// GET /api/youtube/limits - Get user's YouTube upload limits
router.get('/limits', getYouTubeLimitsController);

export { router as youtubeRouter };

