// Video processing service using FFmpeg
// Creates MP4 video from audio URL and thumbnail image
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class VideoProcessingService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'youtube-videos');
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Create MP4 video from audio URL and thumbnail image
   */
  async createVideoFromAudio(
    audioUrl: string,
    thumbnailUrl: string | null,
    outputPath?: string
  ): Promise<{ videoPath: string; size: number }> {
    const videoPath = outputPath || path.join(this.tempDir, `${uuidv4()}.mp4`);
    
    console.log('🎬 Starting video creation:', {
      audioUrl: audioUrl.substring(0, 100) + '...',
      thumbnailUrl: thumbnailUrl || 'none',
      outputPath: videoPath,
    });

    // Download thumbnail if provided
    let thumbnailPath: string | null = null;
    if (thumbnailUrl) {
      try {
        console.log('📥 Downloading thumbnail...');
        thumbnailPath = await this.downloadThumbnail(thumbnailUrl);
        console.log('✅ Thumbnail downloaded:', thumbnailPath);
      } catch (error: any) {
        console.warn('⚠️ Failed to download thumbnail, using default:', error.message);
      }
    }

    // Download audio file
    console.log('📥 Downloading audio file...');
    const audioPath = path.join(this.tempDir, `${uuidv4()}.mp3`);
    try {
      await this.downloadAudio(audioUrl, audioPath);
      console.log('✅ Audio downloaded:', audioPath);
    } catch (error: any) {
      console.error('❌ Failed to download audio:', error.message);
      throw new Error(`Failed to download audio file: ${error.message}`);
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Input: Audio file
      command.input(audioPath);

      // Input: Thumbnail (if provided) or create solid color
      if (thumbnailPath) {
        command.input(thumbnailPath);
        // Loop thumbnail for entire video duration
        command.inputOptions(['-loop', '1', '-framerate', '1']);
      } else {
        // Create solid color background (1280x720, black) using lavfi
        command.input('color=c=black:s=1280x720:d=1')
          .inputFormat('lavfi')
          .inputOptions(['-framerate', '1']);
      }

      // Video settings
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt', 'yuv420p', // Required for YouTube compatibility
          '-shortest', // End when shortest input ends (audio)
          '-r', '1', // 1 frame per second (static image)
        ])
        .outputOptions(['-map', '0:a']) // Map audio from first input (audio file)
        .outputOptions(['-map', '1:v']) // Map video from second input (thumbnail or color)
        .outputOptions(['-c:v', 'libx264', '-preset', 'medium', '-crf', '23']) // Video encoding
        .outputOptions(['-c:a', 'aac', '-b:a', '192k']) // Audio encoding
        .output(videoPath)
        .on('start', (cmd: string) => {
          console.log('🎬 FFmpeg command:', cmd);
        })
        .on('progress', (progress: { percent?: number }) => {
          if (progress.percent) {
            console.log(`📹 Video processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          try {
            // Get file size
            const stats = await fs.stat(videoPath);
            const size = stats.size;

            // Cleanup temp files
            await this.cleanupTempFile(audioPath);
            if (thumbnailPath) {
              await this.cleanupTempFile(thumbnailPath);
            }

            console.log(`✅ Video created: ${videoPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
            resolve({ videoPath, size });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (err: Error) => {
          console.error('❌ FFmpeg error:', err);
          // Cleanup on error
          await this.cleanupTempFile(audioPath);
          if (thumbnailPath) {
            await this.cleanupTempFile(thumbnailPath);
          }
          reject(err);
        })
        .run();
    });
  }

  /**
   * Download audio file from URL
   */
  private async downloadAudio(audioUrl: string, outputPath: string): Promise<void> {
    try {
      const response = await axios.get(audioUrl, {
        responseType: 'stream',
        timeout: 300000, // 5 minutes timeout for large files
      });

      return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(outputPath);
        
        response.data.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve();
        });

        writeStream.on('error', (error: any) => {
          reject(error);
        });

        response.data.on('error', (error: any) => {
          reject(error);
        });
      });
    } catch (error: any) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  /**
   * Download thumbnail image to temp file
   */
  private async downloadThumbnail(thumbnailUrl: string): Promise<string> {
    try {
      const response = await axios.get(thumbnailUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
      });

      const ext = path.extname(new URL(thumbnailUrl).pathname) || '.jpg';
      const thumbnailPath = path.join(this.tempDir, `${uuidv4()}${ext}`);

      await fs.writeFile(thumbnailPath, Buffer.from(response.data));

      return thumbnailPath;
    } catch (error: any) {
      throw new Error(`Failed to download thumbnail: ${error.message}`);
    }
  }

  /**
   * Cleanup temp file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  /**
   * Cleanup video file after upload
   */
  async cleanupVideo(videoPath: string): Promise<void> {
    await this.cleanupTempFile(videoPath);
  }
}

