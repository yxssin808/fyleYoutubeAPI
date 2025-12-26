// YouTube API service for video uploads
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'stream';

export interface YouTubeUploadOptions {
  title: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  categoryId?: string;
}

export class YouTubeService {
  private youtube: any;

  /**
   * Initialize YouTube API client with OAuth2
   * Automatically refreshes token if needed
   */
  async initialize(accessToken: string, refreshToken?: string): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Always try to refresh token if we have a refresh token
    // This ensures we have a fresh access token
    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        console.log('✅ Access token refreshed successfully');
      } catch (error: any) {
        console.error('⚠️ Failed to refresh access token:', error.message || error);
        // Continue with existing token - it might still be valid
      }
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(
    videoStream: Readable,
    videoSize: number,
    options: YouTubeUploadOptions
  ): Promise<{ videoId: string; url: string }> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized. Call initialize() first.');
    }

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: options.title.substring(0, 100), // YouTube limit
            description: options.description?.substring(0, 5000) || '', // YouTube limit
            tags: options.tags?.slice(0, 500) || [], // YouTube limit
            categoryId: options.categoryId || '10', // Music category
          },
          status: {
            privacyStatus: options.privacyStatus || 'public',
            selfDeclaredMadeForKids: false,
            madeForKids: false, // Explicitly set to false to prevent Shorts classification
          },
        },
        media: {
          body: videoStream,
        },
      });

      const videoId = response.data.id;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // Upload thumbnail if provided
      if (options.thumbnailUrl && videoId) {
        try {
          await this.uploadThumbnail(videoId, options.thumbnailUrl);
          console.log('✅ Thumbnail uploaded successfully');
        } catch (error: any) {
          // Check if it's a permissions error (channel not verified)
          if (error.status === 403 || error.message?.includes('permissions') || error.message?.includes('forbidden')) {
            console.warn('⚠️ Thumbnail upload failed: Channel verification required');
            console.warn('   YouTube requires channel verification to upload custom thumbnails.');
            console.warn('   Video uploaded successfully, but thumbnail was not set.');
            console.warn('   To enable thumbnails: Verify your YouTube channel at https://www.youtube.com/verify');
          } else {
            console.warn('⚠️ Failed to upload thumbnail (non-critical):', error.message || error);
          }
          // Continue - thumbnail upload failure is not critical
        }
      }

      return { videoId, url };
    } catch (error: any) {
      console.error('YouTube upload error:', error);
      throw new Error(
        error.message || 'Failed to upload video to YouTube'
      );
    }
  }

  /**
   * Upload thumbnail to YouTube video
   */
  private async uploadThumbnail(videoId: string, thumbnailUrl: string): Promise<void> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      // Download thumbnail
      const thumbnailResponse = await axios.get(thumbnailUrl, {
        responseType: 'arraybuffer',
      });

      const thumbnailBuffer = Buffer.from(thumbnailResponse.data);

      await this.youtube.thumbnails.set({
        videoId,
        media: {
          body: thumbnailBuffer,
        },
      });
      } catch (error: any) {
        // Re-throw with more context
        if (error.status === 403 || error.message?.includes('permissions') || error.message?.includes('forbidden')) {
          throw new Error('Channel verification required: YouTube requires channel verification to upload custom thumbnails. Verify your channel at https://www.youtube.com/verify');
        }
        throw new Error(error.message || 'Failed to upload thumbnail');
      }
  }

  /**
   * Delete video from YouTube
   */
  async deleteVideo(videoId: string): Promise<void> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      await this.youtube.videos.delete({
        id: videoId,
      });
      console.log(`✅ Successfully deleted YouTube video: ${videoId}`);
    } catch (error: any) {
      // If video is already deleted (404), treat as success
      if (error.status === 404 || error.message?.includes('cannot be found') || error.message?.includes('videoNotFound')) {
        console.log(`⚠️ Video ${videoId} not found - may already be deleted. Treating as success.`);
        return; // Success - video is already gone
      }
      
      console.error('YouTube delete error:', error);
      throw new Error(error.message || 'Failed to delete video from YouTube');
    }
  }

  /**
   * Get video details
   */
  async getVideoDetails(videoId: string): Promise<any> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'status'],
        id: [videoId],
      });

      return response.data.items?.[0] || null;
    } catch (error: any) {
      console.error('YouTube get video error:', error);
      throw new Error(error.message || 'Failed to get video details');
    }
  }
}

