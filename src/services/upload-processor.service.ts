// Upload processor service for handling YouTube uploads
import { YouTubeService } from './youtube.service.js';
import { OAuthService } from './oauth.service.js';
import { SupabaseService } from './supabase.service.js';
import { VideoProcessingService } from './video-processing.service.js';
import axios from 'axios';
import { createReadStream } from 'fs';

export class UploadProcessorService {
  private youtubeService: YouTubeService;
  private oauthService: OAuthService;
  private supabaseService: SupabaseService;
  private videoProcessingService: VideoProcessingService;

  constructor() {
    this.youtubeService = new YouTubeService();
    this.oauthService = new OAuthService();
    this.supabaseService = new SupabaseService();
    this.videoProcessingService = new VideoProcessingService();
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

      // Get file URL from Supabase (don't download the file, just get the URL)
      console.log(`📥 Getting file URL: ${upload.file_id}`);
      
      // Get file metadata to find CDN URL
      console.log(`   Getting Supabase client...`);
      const supabase = this.supabaseService.client;
      if (!supabase) {
        console.error('❌ Supabase client is null');
        throw new Error('Supabase client not initialized');
      }
      
      console.log(`   ✅ Supabase client obtained`);
      console.log(`   Querying Supabase for file: ${upload.file_id}`);
      console.log(`   Starting query at: ${new Date().toISOString()}`);
      
      // Add timeout to Supabase query
      const queryPromise = supabase
        .from('files')
        .select('cdn_url, s3_key, user_id')
        .eq('id', upload.file_id)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('❌ Supabase query timeout after 30 seconds');
          reject(new Error('Supabase query timeout after 30 seconds'));
        }, 30000);
      });
      
      let fileData: any;
      let fileError: any;
      
      try {
        console.log(`   Waiting for Supabase response...`);
        const result = await Promise.race([queryPromise, timeoutPromise]) as any;
        console.log(`   ✅ Supabase query completed at: ${new Date().toISOString()}`);
        fileData = result.data;
        fileError = result.error;
        
        if (fileError) {
          console.error('❌ Supabase returned error:', fileError);
        } else {
          console.log(`   ✅ Supabase returned data: ${fileData ? 'yes' : 'no'}`);
        }
      } catch (error: any) {
        console.error('❌ Supabase query failed:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      if (fileError) {
        console.error('❌ File query error:', {
          error: fileError,
          message: fileError.message,
          code: fileError.code,
          details: fileError.details,
        });
        throw new Error(`File not found in database: ${fileError.message || 'Unknown error'}`);
      }
      
      if (!fileData) {
        console.error('❌ File data is null');
        throw new Error('File not found in database: No data returned');
      }
      
      console.log(`   ✅ File found: cdn_url=${!!fileData.cdn_url}, s3_key=${!!fileData.s3_key}`);

      // Get audio URL (prefer CDN, fallback to signed URL from S3)
      console.log(`   Determining audio URL...`);
      let audioUrl: string | undefined = undefined;
      if (fileData.cdn_url) {
        audioUrl = fileData.cdn_url;
        console.log(`   ✅ Using CDN URL: ${fileData.cdn_url.substring(0, 100)}...`);
      }
      
      // If still no URL, try signed URL from S3
      if (!audioUrl && fileData.s3_key) {
        console.log(`   ⚠️ No CDN URL, need to generate signed URL from S3`);
        // Get signed URL from Storage API
        let storageApiUrl = process.env.STORAGE_API_URL || '';
        if (!storageApiUrl) {
          throw new Error('STORAGE_API_URL not configured. Cannot generate signed URL for S3 files.');
        }
        
        // Normalize URL (remove trailing slash)
        storageApiUrl = storageApiUrl.replace(/\/+$/, '');
        
        console.log(`   Requesting signed URL for S3 key: ${fileData.s3_key}`);
        console.log(`   Storage API URL: ${storageApiUrl}`);
        
        try {
          const signedUrlEndpoint = `${storageApiUrl}/api/storage/download-url`;
          console.log(`   Full endpoint: ${signedUrlEndpoint}`);
          
          const signedUrlResponse = await axios.post(
            signedUrlEndpoint,
            {
              objectKey: fileData.s3_key,
              userId: upload.user_id,
            },
            {
              timeout: 120000, // 2 minutes timeout
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (!signedUrlResponse.data?.data?.downloadUrl) {
            throw new Error('Storage API did not return a download URL');
          }
          
          audioUrl = signedUrlResponse.data.data.downloadUrl;
          if (audioUrl) {
            console.log(`   ✅ Got signed URL: ${audioUrl.substring(0, 100)}...`);
          }
        } catch (error: any) {
          console.error('❌ Failed to get signed URL:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status,
          });
          throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
      } else {
        throw new Error('File has no CDN URL or S3 key');
      }

      // Ensure we have an audio URL
      if (!audioUrl) {
        throw new Error('Failed to determine audio URL. File has no accessible URL.');
      }

      // Create MP4 video using FFmpeg directly
      console.log(`🎬 Creating video from audio + thumbnail using FFmpeg...`);
      console.log(`   Audio URL: ${audioUrl.substring(0, 100)}...`);
      console.log(`   Thumbnail URL: ${upload.thumbnail_url || 'none'}`);
      
      let videoPath: string;
      let videoSize: number;
      
      try {
        const result = await this.videoProcessingService.createVideoFromAudio(
          audioUrl,
          upload.thumbnail_url || null
        );
        videoPath = result.videoPath;
        videoSize = result.size;
        console.log(`✅ Video created: ${videoPath} (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error: any) {
        console.error(`❌ Failed to create video:`, {
          message: error.message,
          stack: error.stack,
        });
        throw new Error(`Video creation failed: ${error.message}`);
      }

      // Upload video to YouTube
      console.log(`📤 Uploading to YouTube: ${upload.title}`);
      const videoStream = createReadStream(videoPath);
      
      try {
        const { videoId, url } = await this.youtubeService.uploadVideo(videoStream, videoSize, {
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
      } finally {
        // Cleanup video file after upload
        await this.videoProcessingService.cleanupVideo(videoPath);
      }
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
    console.log(`🗑️ Starting delete process for upload: ${uploadId}, user: ${userId}`);

    const upload = await this.supabaseService.getYouTubeUpload(uploadId);
    if (!upload) {
      console.error(`❌ Upload not found: ${uploadId}`);
      throw new Error('Upload not found');
    }

    console.log(`✅ Upload found: ${uploadId}, status: ${upload.status}, youtube_video_id: ${upload.youtube_video_id || 'none'}`);

    // Verify ownership
    if (upload.user_id !== userId) {
      console.error(`❌ Ownership mismatch: upload.user_id=${upload.user_id}, provided userId=${userId}`);
      throw new Error('Unauthorized: You do not own this upload');
    }

    console.log('✅ Ownership verified');

    // If video was uploaded, delete from YouTube
    if (upload.youtube_video_id && upload.status === 'uploaded') {
      console.log(`🎬 Attempting to delete YouTube video: ${upload.youtube_video_id}`);
      try {
        const tokens = await this.oauthService.getUserTokens(userId);
        if (tokens) {
          console.log('✅ OAuth tokens found, initializing YouTube service...');
          await this.youtubeService.initialize(tokens.access_token, tokens.refresh_token);
          await this.youtubeService.deleteVideo(upload.youtube_video_id);
          console.log(`✅ Deleted YouTube video: ${upload.youtube_video_id}`);
        } else {
          console.warn('⚠️ No OAuth tokens found, skipping YouTube video deletion');
        }
      } catch (error: any) {
        console.error('❌ Failed to delete YouTube video:', {
          error: error.message,
          stack: error.stack,
          youtube_video_id: upload.youtube_video_id,
        });
        // Continue with database deletion even if YouTube deletion fails
      }
    } else {
      console.log('ℹ️ No YouTube video to delete (status not uploaded or no video_id)');
    }

    // Delete from database
    console.log('🗄️ Deleting upload record from database...');
    await this.supabaseService.deleteYouTubeUpload(uploadId, userId);
    console.log(`✅ Deleted upload record: ${uploadId}`);
  }
}

