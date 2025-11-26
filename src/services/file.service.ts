// File service for downloading audio files
import axios from 'axios';
import { Readable } from 'stream';
import { getSupabaseClient } from '../lib/supabaseClient.js';

export class FileService {
  /**
   * Download file from CDN or storage
   */
  async downloadFile(fileId: string): Promise<{ stream: Readable; size: number; contentType: string }> {
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
      // Generate signed URL from S3
      // This would need to be implemented based on your S3 setup
      // For now, we'll use the CDN URL or try to construct a signed URL
      throw new Error('S3 signed URL generation not implemented. Please use CDN URL.');
    } else {
      throw new Error('No file URL available');
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

