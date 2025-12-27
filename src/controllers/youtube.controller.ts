// YouTube upload controller
import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase.service.js';

interface YouTubeUploadRequest {
  userId: string;
  fileId: string;
  title: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  scheduledAt?: string; // ISO date string
  privacyStatus?: 'public' | 'unlisted' | 'private';
}

interface PlanLimits {
  maxUploadsPerMonth: number | 'unlimited';
  allowedFormats: string[]; // ['mp3'] or ['mp3', 'wav']
}

// Plan-based limits
const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxUploadsPerMonth: 4,
    allowedFormats: ['mp3'],
  },
  bedroom: {
    maxUploadsPerMonth: 30,
    allowedFormats: ['mp3'],
  },
  pro: {
    maxUploadsPerMonth: 'unlimited',
    allowedFormats: ['mp3', 'wav'],
  },
  studio: {
    maxUploadsPerMonth: 'unlimited',
    allowedFormats: ['mp3', 'wav'],
  },
};

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate file format against plan limits
 */
function validateFileFormat(fileFormat: string, plan: string): { allowed: boolean; reason?: string } {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  
  // Normalize format (remove bitrate, etc.)
  const normalizedFormat = fileFormat.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isMp3 = normalizedFormat.includes('mp3');
  const isWav = normalizedFormat.includes('wav');

  if (isMp3 && limits.allowedFormats.includes('mp3')) {
    return { allowed: true };
  }

  if (isWav && limits.allowedFormats.includes('wav')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Your ${plan} plan only allows ${limits.allowedFormats.join(' and ')} files.`,
  };
}

/**
 * POST /api/youtube/upload
 * Create a YouTube upload request
 */
export const createYouTubeUploadController = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      fileId,
      title,
      description,
      tags,
      thumbnailUrl,
      scheduledAt,
      privacyStatus,
    }: YouTubeUploadRequest = req.body;

    console.log('🎬 YouTube upload request:', {
      userId,
      fileId,
      title: title?.substring(0, 50),
    });

    // Validate required fields
    if (!userId || !fileId || !title) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'fileId', 'title'],
      });
    }

    // Sanitize inputs
    const sanitizedUserId = sanitizeString(userId);
    const sanitizedFileId = sanitizeString(fileId);
    const sanitizedTitle = sanitizeString(title).trim();
    const sanitizedDescription = description ? sanitizeString(description).trim() : null;
    const sanitizedTags = tags
      ? tags.map((tag) => sanitizeString(tag).trim()).filter((tag) => tag.length > 0)
      : [];

    if (!sanitizedTitle || sanitizedTitle.length === 0) {
      return res.status(400).json({
        error: 'Invalid title',
        message: 'Title must be a non-empty string',
      });
    }

    if (sanitizedTitle.length > 100) {
      return res.status(400).json({
        error: 'Title too long',
        message: 'Title must be 100 characters or less',
      });
    }

    // Initialize services
    const supabaseService = new SupabaseService();

    // Get user plan
    const plan = await supabaseService.getUserPlan(sanitizedUserId);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    console.log(`📋 User plan: ${plan}, limits:`, limits);

    // Check monthly upload limit
    if (limits.maxUploadsPerMonth !== 'unlimited') {
      const monthlyCount = await supabaseService.getMonthlyUploadCount(sanitizedUserId);
      
      if (monthlyCount >= limits.maxUploadsPerMonth) {
        return res.status(403).json({
          error: 'Monthly upload limit reached',
          message: `Your ${plan} plan allows ${limits.maxUploadsPerMonth} YouTube uploads per month. You've reached this limit.`,
          limit: limits.maxUploadsPerMonth,
          current: monthlyCount,
        });
      }
    }

    // Get file metadata to validate format
    const file = await supabaseService.getFile(sanitizedFileId);
    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The specified file does not exist',
      });
    }

    // Validate file format
    const fileFormat = file.format || file.type || '';
    const formatValidation = validateFileFormat(fileFormat, plan);
    if (!formatValidation.allowed) {
      return res.status(403).json({
        error: 'File format not allowed',
        message: formatValidation.reason,
        fileFormat,
        allowedFormats: limits.allowedFormats,
      });
    }

    // Validate scheduled date if provided
    let scheduledDate: Date | null = null;
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid scheduled date',
          message: 'scheduledAt must be a valid ISO date string',
        });
      }
      // Don't allow scheduling in the past
      if (scheduledDate < new Date()) {
        return res.status(400).json({
          error: 'Invalid scheduled date',
          message: 'Cannot schedule uploads in the past',
        });
      }
    }

    // Validate thumbnail URL if provided
    if (thumbnailUrl) {
      const sanitizedThumbnailUrl = sanitizeString(thumbnailUrl);
      try {
        new URL(sanitizedThumbnailUrl);
      } catch {
        return res.status(400).json({
          error: 'Invalid thumbnail URL',
          message: 'thumbnailUrl must be a valid URL',
        });
      }
    }

    // Validate privacy status
    const validPrivacyStatuses = ['public', 'unlisted', 'private'];
    const sanitizedPrivacyStatus = privacyStatus && validPrivacyStatuses.includes(privacyStatus)
      ? privacyStatus
      : 'public'; // Default to public

    // Create YouTube upload record
    const uploadRecord = await supabaseService.createYouTubeUpload({
      user_id: sanitizedUserId,
      file_id: sanitizedFileId,
      title: sanitizedTitle,
      description: sanitizedDescription,
      tags: sanitizedTags.length > 0 ? sanitizedTags : null,
      thumbnail_url: thumbnailUrl ? sanitizeString(thumbnailUrl) : null,
      scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
      privacy_status: sanitizedPrivacyStatus as 'public' | 'unlisted' | 'private',
      status: 'pending',
    });

    console.log('✅ YouTube upload record created:', uploadRecord.id);

    // Queue upload for processing (background worker will pick it up)
    // Both immediate and scheduled uploads are processed immediately
    // Scheduled uploads use YouTube's publishAt parameter for scheduling
    Promise.resolve().then(async () => {
      try {
        const { UploadProcessorService } = await import('../services/upload-processor.service.js');
        const processor = new UploadProcessorService();
        await processor.processUpload(uploadRecord.id);
      } catch (error: any) {
        // Error is logged in processUpload, worker will retry
        console.error('❌ Immediate processing failed, worker will retry:', uploadRecord.id);
      }
    }).catch(() => {
      // Silently fail - worker will pick it up
    });

    res.json({
      success: true,
      upload: uploadRecord,
      message: scheduledDate
        ? `Upload scheduled for ${scheduledDate.toISOString()}`
        : 'Upload queued for processing',
    });
  } catch (error: any) {
    console.error('❌ Error creating YouTube upload:', error);
    res.status(500).json({
      error: 'Failed to create YouTube upload',
      message: error.message,
    });
  }
};

/**
 * GET /api/youtube/uploads
 * Get user's YouTube uploads
 */
export const getYouTubeUploadsController = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const supabaseService = new SupabaseService();

    const uploads = await supabaseService.getYouTubeUploads(sanitizedUserId);

    res.json({
      success: true,
      uploads,
    });
  } catch (error: any) {
    console.error('❌ Error fetching YouTube uploads:', error);
    res.status(500).json({
      error: 'Failed to fetch YouTube uploads',
      message: error.message,
    });
  }
};

/**
 * GET /api/youtube/limits
 * Get user's YouTube upload limits based on plan
 */
export const getYouTubeLimitsController = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const supabaseService = new SupabaseService();

    const plan = await supabaseService.getUserPlan(sanitizedUserId);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const monthlyCount = await supabaseService.getMonthlyUploadCount(sanitizedUserId);

    res.json({
      success: true,
      plan,
      limits: {
        maxUploadsPerMonth: limits.maxUploadsPerMonth,
        allowedFormats: limits.allowedFormats,
      },
      usage: {
        currentMonth: monthlyCount,
        remaining:
          limits.maxUploadsPerMonth === 'unlimited'
            ? 'unlimited'
            : Math.max(0, limits.maxUploadsPerMonth - monthlyCount),
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching YouTube limits:', error);
    res.status(500).json({
      error: 'Failed to fetch YouTube limits',
      message: error.message,
    });
  }
};

/**
 * DELETE /api/youtube/upload/:id
 * Delete a YouTube upload and video
 */
export const deleteYouTubeUploadController = async (req: Request, res: Response) => {
  try {
    const uploadId = req.params.id;
    const userId = req.body.userId || req.query.userId as string;

    if (!uploadId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'uploadId and userId are required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedUploadId = sanitizeString(uploadId);

    const { UploadProcessorService } = await import('../services/upload-processor.service.js');
    const processor = new UploadProcessorService();

    await processor.deleteUpload(sanitizedUploadId, sanitizedUserId);

    res.json({
      success: true,
      message: 'Upload deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Error deleting YouTube upload:', error);
    res.status(error.message?.includes('Unauthorized') ? 403 : 500).json({
      error: 'Failed to delete YouTube upload',
      message: error.message,
    });
  }
};

/**
 * PUT /api/youtube/upload/:id/archive
 * Archive or unarchive a YouTube upload
 */
export const archiveYouTubeUploadController = async (req: Request, res: Response) => {
  try {
    const uploadId = req.params.id;
    const { userId, archived } = req.body;

    if (!uploadId || !userId || typeof archived !== 'boolean') {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'uploadId, userId, and archived (boolean) are required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedUploadId = sanitizeString(uploadId);
    const supabaseService = new SupabaseService();

    // Check if Supabase client is available
    if (!supabaseService.client) {
      return res.status(500).json({
        error: 'Database connection failed',
        message: 'Unable to connect to database',
      });
    }

    // Verify upload belongs to user
    const { data: upload, error: fetchError } = await supabaseService.client
      .from('youtube_uploads')
      .select('id, user_id')
      .eq('id', sanitizedUploadId)
      .eq('user_id', sanitizedUserId)
      .single();

    if (fetchError || !upload) {
      return res.status(404).json({
        error: 'Upload not found',
        message: 'Upload does not exist or you do not have permission to modify it',
      });
    }

    // Update archived status
    const { data: updatedUpload, error: updateError } = await supabaseService.updateYouTubeUpload(
      sanitizedUploadId,
      { archived }
    );

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      upload: updatedUpload,
      message: archived ? 'Upload archived successfully' : 'Upload unarchived successfully',
    });
  } catch (error: any) {
    console.error('❌ Error archiving YouTube upload:', error);
    res.status(500).json({
      error: 'Failed to archive YouTube upload',
      message: error.message,
    });
  }
};

/**
 * POST /api/youtube/process
 * Manually trigger processing of pending uploads (admin/internal use)
 */
export const processPendingUploadsController = async (req: Request, res: Response) => {
  try {
    // Optional: Add authentication/authorization check here
    const { UploadProcessorService } = await import('../services/upload-processor.service.js');
    const processor = new UploadProcessorService();

    await processor.processPendingUploads();

    res.json({
      success: true,
      message: 'Pending uploads processed',
    });
  } catch (error: any) {
    console.error('❌ Error processing pending uploads:', error);
    res.status(500).json({
      error: 'Failed to process pending uploads',
      message: error.message,
    });
  }
};

