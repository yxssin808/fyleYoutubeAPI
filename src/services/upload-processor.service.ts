// Upload processor service for handling YouTube uploads
import { YouTubeService } from './youtube.service.js';
import { FileService } from './file.service.js';
import { OAuthService } from './oauth.service.js';
import { SupabaseService } from './supabase.service.js';
import axios from 'axios';
import { Readable } from 'stream';

export class UploadProcessorService {
  private youtubeService: YouTubeService;
  private fileService: FileService;
  private oauthService: OAuthService;
  private supabaseService: SupabaseService;
  private apiBaseUrl: string;

  constructor() {
    this.youtubeService = new YouTubeService();
    this.fileService = new FileService();
    this.oauthService = new OAuthService();
    this.supabaseService = new SupabaseService();
    // Use API_BASE_URL or default to the main API service
    this.apiBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_URL || 'https://fyle-api.vercel.app';
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

      // Download file to get URL
      console.log(`📥 Getting file URL: ${upload.file_id}`);
      const { stream: audioStream } = await this.fileService.downloadFile(upload.file_id, upload.user_id);
      
      // Get file URL from Supabase for video processing API
      const uploadRecord = await this.supabaseService.getYouTubeUpload(uploadId);
      if (!uploadRecord) {
        throw new Error('Upload record not found');
      }

      // Get file metadata to find CDN URL
      const supabase = this.supabaseService.client;
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data: fileData } = await supabase
        .from('files')
        .select('cdn_url, s3_key')
        .eq('id', upload.file_id)
        .single();

      if (!fileData) {
        throw new Error('File not found in database');
      }

      // Get audio URL (prefer CDN, fallback to signed URL)
      let audioUrl: string;
      if (fileData.cdn_url) {
        audioUrl = fileData.cdn_url;
      } else if (fileData.s3_key) {
        // Get signed URL from Storage API
        const storageApiUrl = process.env.STORAGE_API_URL || '';
        const signedUrlResponse = await axios.post(
          `${storageApiUrl}/api/storage/download-url`,
          {
            objectKey: fileData.s3_key,
            userId: upload.user_id,
          }
        );
        audioUrl = signedUrlResponse.data.data.downloadUrl;
      } else {
        throw new Error('File has no CDN URL or S3 key');
      }

      // Create MP4 video using API service (which has FFmpeg)
      console.log(`🎬 Creating video from audio + thumbnail via API service...`);
      const videoResponse = await axios.post(
        `${this.apiBaseUrl}/api/video/create`,
        {
          audioUrl: audioUrl,
          thumbnailUrl: upload.thumbnail_url || null,
        },
        {
          responseType: 'stream',
        }
      );

      // Upload video stream to YouTube
      console.log(`📤 Uploading to YouTube: ${upload.title}`);
      const videoStream = videoResponse.data as Readable;
      const contentLength = parseInt(videoResponse.headers['content-length'] || '0', 10);
      
      const { videoId, url } = await this.youtubeService.uploadVideo(videoStream, contentLength, {
        title: upload.title,
        description: upload.description || undefined,
        tags: upload.tags || undefined,
        thumbnailUrl: upload.thumbnail_url || undefined, // Still upload as custom thumbnail
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

