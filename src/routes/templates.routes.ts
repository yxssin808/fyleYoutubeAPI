// Description templates routes
import { Router } from 'express';
import {
  getTemplatesController,
  createTemplateController,
  updateTemplateController,
  deleteTemplateController,
} from '../controllers/templates.controller.js';

const router = Router();

// GET /api/youtube/templates - Get user's templates
router.get('/templates', getTemplatesController);

// POST /api/youtube/templates - Create a new template
router.post('/templates', createTemplateController);

// PUT /api/youtube/templates/:id - Update a template
router.put('/templates/:id', updateTemplateController);

// DELETE /api/youtube/templates/:id - Delete a template
router.delete('/templates/:id', deleteTemplateController);

export { router as templatesRouter };

