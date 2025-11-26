// Upload processor service for handling YouTube uploads
import { YouTubeService } from './youtube.service.js';
import { FileService } from './file.service.js';
import { OAuthService } from './oauth.service.js';
import { SupabaseService } from './supabase.service.js';

export class UploadProcessorService {
  private youtubeService: YouTubeService;
  private fileService: FileService;
  private oauthService: OAuthService;
  private supabaseService: SupabaseService;

  constructor() {
    this.youtubeService = new YouTubeService();
    this.fileService = new FileService();
    this.oauthService = new OAuthService();
    this.supabaseService = new SupabaseService();
  }

  /**
   * Process a single YouTube upload
   */
  async processUpload(uploadId: string): Promise<void> {
    console.log(`🔄 Processing upload: ${uploadId}`);

    // Get upload record
    const upload = await this.supabaseService.getYouTubeUpload(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Check if already processed
    if (upload.status === 'uploaded' || upload.status === 'processing') {
      console.log(`⏭️ Upload ${uploadId} already processed or processing`);
      return;
    }

    // Update status to processing
    await this.supabaseService.updateYouTubeUpload(uploadId, {
      status: 'processing',
    });

    try {
      // Get user's OAuth tokens
      const tokens = await this.oauthService.getUserTokens(upload.user_id);
      if (!tokens) {
        throw new Error('User has not connected YouTube account. Please connect your YouTube account first.');
      }

      // Initialize YouTube service
      await this.youtubeService.initialize(tokens.access_token, tokens.refresh_token);

      // Download file
      console.log(`📥 Downloading file: ${upload.file_id}`);
      const { stream, size } = await this.fileService.downloadFile(upload.file_id);

      // Upload to YouTube
      console.log(`📤 Uploading to YouTube: ${upload.title}`);
      const { videoId, url } = await this.youtubeService.uploadVideo(stream, size, {
        title: upload.title,
        description: upload.description || undefined,
        tags: upload.tags || undefined,
        thumbnailUrl: upload.thumbnail_url || undefined,
        privacyStatus: 'private', // Default to private, user can change later
      });

      // Update upload record with success
      await this.supabaseService.updateYouTubeUpload(uploadId, {
        status: 'uploaded',
        youtube_video_id: videoId,
      });

      console.log(`✅ Upload successful: ${videoId} - ${url}`);
    } catch (error: any) {
      console.error(`❌ Upload failed: ${error.message}`);

      // Update upload record with error
      await this.supabaseService.updateYouTubeUpload(uploadId, {
        status: 'failed',
        error_message: error.message || 'Unknown error occurred',
      });

      throw error;
    }
  }

  /**
   * Process all pending uploads
   */
  async processPendingUploads(): Promise<void> {
    console.log('🔍 Checking for pending uploads...');

    const pendingUploads = await this.supabaseService.getPendingUploads();
    console.log(`📋 Found ${pendingUploads.length} pending uploads`);

    for (const upload of pendingUploads) {
      try {
        await this.processUpload(upload.id);
        // Add small delay between uploads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Failed to process upload ${upload.id}:`, error);
        // Continue with next upload
      }
    }
  }

  /**
   * Delete YouTube video and upload record
   */
  async deleteUpload(uploadId: string, userId: string): Promise<void> {
    const upload = await this.supabaseService.getYouTubeUpload(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Verify ownership
    if (upload.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this upload');
    }

    // If video was uploaded, delete from YouTube
    if (upload.youtube_video_id && upload.status === 'uploaded') {
      try {
        const tokens = await this.oauthService.getUserTokens(userId);
        if (tokens) {
          await this.youtubeService.initialize(tokens.access_token, tokens.refresh_token);
          await this.youtubeService.deleteVideo(upload.youtube_video_id);
          console.log(`🗑️ Deleted YouTube video: ${upload.youtube_video_id}`);
        }
      } catch (error: any) {
        console.error('Failed to delete YouTube video:', error);
        // Continue with database deletion even if YouTube deletion fails
      }
    }

    // Delete from database
    await this.supabaseService.deleteYouTubeUpload(uploadId, userId);
    console.log(`🗑️ Deleted upload record: ${uploadId}`);
  }
}

