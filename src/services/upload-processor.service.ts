// Upload processor service for handling YouTube uploads
import { YouTubeService } from './youtube.service.js';
import { FileService } from './file.service.js';
import { OAuthService } from './oauth.service.js';
import { SupabaseService } from './supabase.service.js';
import axios from 'axios';
import { Readable } from 'stream';

export class UploadProcessorService {
  private youtubeService: YouTubeService;
  private oauthService: OAuthService;
  private supabaseService: SupabaseService;
  private apiBaseUrl: string;

  constructor() {
    this.youtubeService = new YouTubeService();
    this.oauthService = new OAuthService();
    this.supabaseService = new SupabaseService();
    // Use API_BASE_URL or default to the main API service
    this.apiBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_URL || 'https://fyle-api.vercel.app';
    console.log(`📡 API Base URL configured: ${this.apiBaseUrl}`);
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
      const supabase = this.supabaseService.client;
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('cdn_url, s3_key')
        .eq('id', upload.file_id)
        .single();

      if (fileError || !fileData) {
        console.error('❌ File query error:', fileError);
        throw new Error(`File not found in database: ${fileError?.message || 'Unknown error'}`);
      }
      
      console.log(`   File found: cdn_url=${!!fileData.cdn_url}, s3_key=${!!fileData.s3_key}`);

      // Get audio URL (prefer CDN, fallback to signed URL)
      let audioUrl: string;
      if (fileData.cdn_url) {
        audioUrl = fileData.cdn_url;
        console.log(`   ✅ Using CDN URL: ${audioUrl.substring(0, 100)}...`);
      } else if (fileData.s3_key) {
        // Get signed URL from Storage API
        const storageApiUrl = process.env.STORAGE_API_URL || '';
        if (!storageApiUrl) {
          throw new Error('STORAGE_API_URL not configured. Cannot generate signed URL for S3 files.');
        }
        
        console.log(`   Requesting signed URL for S3 key: ${fileData.s3_key}`);
        console.log(`   Storage API URL: ${storageApiUrl}`);
        
        try {
          const signedUrlResponse = await axios.post(
            `${storageApiUrl}/api/storage/download-url`,
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
          console.log(`   ✅ Got signed URL: ${audioUrl.substring(0, 100)}...`);
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

      // Create MP4 video using API service (which has FFmpeg)
      console.log(`🎬 Creating video from audio + thumbnail via API service...`);
      console.log(`   API Base URL: ${this.apiBaseUrl}`);
      console.log(`   Audio URL: ${audioUrl.substring(0, 100)}...`);
      console.log(`   Thumbnail URL: ${upload.thumbnail_url || 'none'}`);
      
      let videoResponse;
      try {
        const videoApiUrl = `${this.apiBaseUrl}/api/video/create`;
        console.log(`   Calling: ${videoApiUrl}`);
        
        videoResponse = await axios.post(
          videoApiUrl,
          {
            audioUrl: audioUrl,
            thumbnailUrl: upload.thumbnail_url || null,
          },
          {
            responseType: 'stream',
            timeout: 600000, // 10 minutes timeout (video processing can take time)
            validateStatus: (status) => status < 500, // Don't throw on 4xx
          }
        );

        if (videoResponse.status !== 200) {
          const errorText = await this.streamToString(videoResponse.data);
          throw new Error(`API Service returned ${videoResponse.status}: ${errorText}`);
        }

        console.log(`✅ Video creation request successful (Status: ${videoResponse.status})`);
        console.log(`   Content-Length: ${videoResponse.headers['content-length'] || 'unknown'}`);
      } catch (error: any) {
        console.error(`❌ Failed to create video via API service:`, {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
          apiUrl: `${this.apiBaseUrl}/api/video/create`,
          timeout: error.code === 'ECONNABORTED' ? 'Request timeout' : undefined,
        });
        throw new Error(`Video creation failed: ${error.message}`);
      }

      // Upload video stream to YouTube
      console.log(`📤 Uploading to YouTube: ${upload.title}`);
      const videoStream = videoResponse.data as Readable;
      const contentLength = parseInt(videoResponse.headers['content-length'] || '0', 10);
      console.log(`   Video size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
      
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
   * Helper to convert stream to string for error messages
   */
  private async streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
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

