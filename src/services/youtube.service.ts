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

    // Refresh token if needed
    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error('Failed to refresh access token:', error);
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
            privacyStatus: options.privacyStatus || 'private',
            selfDeclaredMadeForKids: false,
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
        } catch (error) {
          console.warn('Failed to upload thumbnail, continuing:', error);
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
      console.error('Thumbnail upload error:', error);
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
    } catch (error: any) {
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

