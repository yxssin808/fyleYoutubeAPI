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
  
  // Check MP3: Treat 'mpeg' as MP3 (common format from Dropbox imports)
  // Also check for 'mp3' in the format string
  const isMp3 = normalizedFormat.includes('mp3') || normalizedFormat.includes('mpeg');
  
  // Check WAV: format includes 'wav' or 'wave'
  const isWav = normalizedFormat.includes('wav') || normalizedFormat.includes('wave');

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

    // Validate YouTube account connection BEFORE creating upload
    // This prevents creating uploads when the account is disconnected
    try {
      const { OAuthService } = await import('../services/oauth.service.js');
      const oauthService = new OAuthService();
      
      // Check if user has valid tokens
      const hasValidTokens = await oauthService.hasValidTokens(sanitizedUserId);
      if (!hasValidTokens) {
        return res.status(403).json({
          error: 'YouTube account not connected',
          message: 'Please connect your YouTube account before uploading. Go to YouTube settings and connect your account.',
        });
      }
      
      // Try to get and refresh tokens to verify they're still valid
      const tokens = await oauthService.getUserTokens(sanitizedUserId);
      if (!tokens || !tokens.access_token) {
        return res.status(403).json({
          error: 'YouTube account connection expired',
          message: 'Your YouTube account connection has expired. Please reconnect your YouTube account in the settings.',
        });
      }
    } catch (authError: any) {
      // If token refresh failed with invalid token error, user needs to reconnect
      if (authError.message?.includes('expired') || 
          authError.message?.includes('reconnect') ||
          authError.message?.includes('invalid') ||
          authError.message?.includes('expired')) {
        return res.status(403).json({
          error: 'YouTube account connection expired',
          message: 'Your YouTube account connection has expired. Please reconnect your YouTube account in the settings.',
        });
      }
      // For other errors, log and continue (might be temporary network issue)
      console.warn('⚠️ Token validation warning:', authError.message);
    }

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
    const fileName = file.name || '';
    
    // Debug log for format validation
    console.log('🎵 Format validation:', {
      fileName,
      fileFormat,
      plan,
      limits: limits.allowedFormats,
    });
    
    const formatValidation = validateFileFormat(fileFormat, plan);
    if (!formatValidation.allowed) {
      // Also check file extension as fallback
      const fileNameLower = fileName.toLowerCase();
      const isMp3ByExtension = fileNameLower.endsWith('.mp3');
      const isWavByExtension = fileNameLower.endsWith('.wav');
      
      // If format validation failed but extension matches, allow it
      if (isMp3ByExtension && limits.allowedFormats.includes('mp3')) {
        console.log('✅ Allowed by file extension (.mp3)');
      } else if (isWavByExtension && limits.allowedFormats.includes('wav')) {
        console.log('✅ Allowed by file extension (.wav)');
      } else {
        return res.status(403).json({
          error: 'File format not allowed',
          message: formatValidation.reason,
          fileFormat,
          fileName,
          allowedFormats: limits.allowedFormats,
        });
      }
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
    const includeArchived = req.query.includeArchived === 'true';

    console.log(`🔍 getYouTubeUploadsController called: userId=${userId}, includeArchived=${includeArchived}`);

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const supabaseService = new SupabaseService();

    const uploads = await supabaseService.getYouTubeUploads(sanitizedUserId, includeArchived);

    console.log(`✅ Returning ${uploads.length} uploads to client`);

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
 * PUT /api/youtube/upload/:id
 * Update a YouTube upload and video metadata
 */
export const updateYouTubeUploadController = async (req: Request, res: Response) => {
  try {
    const uploadId = req.params.id;
    const { userId, title, description, tags, privacyStatus } = req.body;

    if (!uploadId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'uploadId and userId are required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedUploadId = sanitizeString(uploadId);
    const supabaseService = new SupabaseService();

    // Verify upload belongs to user
    const { data: upload, error: fetchError } = await supabaseService.client
      .from('youtube_uploads')
      .select('*')
      .eq('id', sanitizedUploadId)
      .eq('user_id', sanitizedUserId)
      .single();

    if (fetchError || !upload) {
      return res.status(404).json({
        error: 'Upload not found',
        message: 'Upload does not exist or you do not have permission to modify it',
      });
    }

    // Validate title if provided
    let sanitizedTitle = upload.title;
    if (title !== undefined) {
      sanitizedTitle = sanitizeString(title).trim();
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
    }

    // Sanitize description if provided
    const sanitizedDescription = description !== undefined
      ? (description ? sanitizeString(description).trim() : null)
      : upload.description;

    // Sanitize tags if provided
    const sanitizedTags = tags !== undefined
      ? (tags && Array.isArray(tags)
          ? tags.map((tag: string) => sanitizeString(tag).trim()).filter((tag: string) => tag.length > 0)
          : [])
      : upload.tags;

    // Validate privacy status if provided
    const validPrivacyStatuses = ['public', 'unlisted', 'private'];
    const sanitizedPrivacyStatus = privacyStatus && validPrivacyStatuses.includes(privacyStatus)
      ? privacyStatus
      : upload.privacy_status;

    // Update in database
    const updateData: any = {};
    if (title !== undefined) updateData.title = sanitizedTitle;
    if (description !== undefined) updateData.description = sanitizedDescription;
    if (tags !== undefined) updateData.tags = sanitizedTags.length > 0 ? sanitizedTags : null;
    if (privacyStatus !== undefined) updateData.privacy_status = sanitizedPrivacyStatus;

    const { data: updatedUpload, error: updateError } = await supabaseService.updateYouTubeUpload(
      sanitizedUploadId,
      updateData
    );

    if (updateError) {
      throw updateError;
    }

    // If video is already uploaded to YouTube, update it there too
    if (upload.youtube_video_id && upload.status === 'uploaded') {
      try {
        const { YouTubeService } = await import('../services/youtube.service.js');
        const { SupabaseService: SupabaseServiceForOAuth } = await import('../services/supabase.service.js');
        
        const supabaseForOAuth = new SupabaseServiceForOAuth();
        const oauthData = await supabaseForOAuth.getYouTubeOAuth(sanitizedUserId);
        
        if (!oauthData || !oauthData.access_token) {
          throw new Error('YouTube OAuth not connected');
        }

        const youtubeService = new YouTubeService();
        await youtubeService.initialize(oauthData.access_token, oauthData.refresh_token || undefined);

        await youtubeService.updateVideo(upload.youtube_video_id, {
          title: sanitizedTitle,
          description: sanitizedDescription || undefined,
          tags: sanitizedTags.length > 0 ? sanitizedTags : undefined,
          privacyStatus: sanitizedPrivacyStatus as 'public' | 'unlisted' | 'private',
        });

        console.log(`✅ Successfully updated YouTube video: ${upload.youtube_video_id}`);
      } catch (error: any) {
        console.error('❌ Error updating YouTube video:', error);
        // Don't fail the request if YouTube update fails - database is already updated
        // Just log the error
      }
    }

    res.json({
      success: true,
      upload: updatedUpload,
      message: 'Upload updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Error updating YouTube upload:', error);
    res.status(500).json({
      error: 'Failed to update YouTube upload',
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

