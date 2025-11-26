// File service for downloading audio files
import axios from 'axios';
import { Readable } from 'stream';
import { getSupabaseClient } from '../lib/supabaseClient.js';

export class FileService {
  /**
   * Get signed URL from Storage API
   */
  private async getSignedUrl(s3Key: string, userId: string): Promise<string> {
    const storageApiUrl = process.env.STORAGE_API_URL || '';
    
    if (!storageApiUrl) {
      throw new Error('Storage API URL not configured. Please set STORAGE_API_URL environment variable.');
    }

    try {
      // Remove trailing slash if present
      const baseUrl = storageApiUrl.replace(/\/$/, '');
      
      // Storage API endpoint: /storage/download-url
      const response = await axios.post(
        `${baseUrl}/storage/download-url`,
        {
          objectKey: s3Key,
          userId: userId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      if (!response.data?.data?.downloadUrl) {
        throw new Error('Storage API did not return a download URL');
      }

      return response.data.data.downloadUrl;
    } catch (error: any) {
      console.error('Failed to get signed URL:', error);
      if (error.response) {
        throw new Error(`Storage API error (${error.response.status}): ${error.response.data?.error || error.message}`);
      }
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Download file from CDN or storage
   */
  async downloadFile(fileId: string, userId?: string): Promise<{ stream: Readable; size: number; contentType: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Get file metadata
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !file) {
      throw new Error('File not found');
    }

    // Try CDN URL first, then S3 signed URL
    let fileUrl: string;

    if (file.cdn_url) {
      fileUrl = file.cdn_url;
    } else if (file.s3_key) {
      // Generate signed URL from Storage API
      if (!userId && !file.user_id) {
        throw new Error('User ID required to generate signed URL for S3 files');
      }
      fileUrl = await this.getSignedUrl(file.s3_key, userId || file.user_id);
    } else {
      throw new Error('No file URL available (no cdn_url or s3_key)');
    }

    // Download file
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'stream',
        timeout: 300000, // 5 minutes timeout
      });

      const contentType = response.headers['content-type'] || 'audio/mpeg';
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);

      return {
        stream: response.data as Readable,
        size: contentLength || file.size || 0,
        contentType,
      };
    } catch (error: any) {
      console.error('File download error:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !file) {
      throw new Error('File not found');
    }

    return file;
  }
}

