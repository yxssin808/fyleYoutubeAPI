// Video processing service using FFmpeg
// Creates MP4 video from audio URL and thumbnail image
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

export class VideoProcessingService {
  private tempDir: string;
  private ffmpegPath: string | null = null;
  private ffprobePath: string | null = null;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'youtube-videos');
    this.ensureTempDir();
    this.setupFFmpeg();
  }

  /**
   * Setup FFmpeg paths
   * On Railway/Docker: FFmpeg is installed via apt-get in Dockerfile at /usr/bin/ffmpeg
   * Locally: FFmpeg should be in PATH or set via FFMPEG_PATH env var
   */
  private setupFFmpeg() {
    // Try to find FFmpeg in common locations
    // Priority: Environment variables > Standard Linux paths > System PATH
    const possiblePaths = [
      process.env.FFMPEG_PATH,
      process.env.FFMPEG_BINARY,
      '/usr/bin/ffmpeg',        // Standard Linux location (Railway/Docker)
      '/usr/local/bin/ffmpeg',  // Alternative Linux location
      '/opt/homebrew/bin/ffmpeg', // macOS Homebrew
      'ffmpeg',                 // System PATH (fallback)
    ].filter(Boolean); // Remove undefined values

    const possibleProbePaths = [
      process.env.FFPROBE_PATH,
      process.env.FFPROBE_BINARY,
      '/usr/bin/ffprobe',        // Standard Linux location (Railway/Docker)
      '/usr/local/bin/ffprobe',  // Alternative Linux location
      '/opt/homebrew/bin/ffprobe', // macOS Homebrew
      'ffprobe',                 // System PATH (fallback)
    ].filter(Boolean); // Remove undefined values

    // Find FFmpeg
    for (const ffmpegPath of possiblePaths) {
      if (!ffmpegPath) continue;
      
      try {
        // Try to execute ffmpeg -version (works on both Windows and Linux)
        const command = process.platform === 'win32' 
          ? `"${ffmpegPath}" -version`
          : `${ffmpegPath} -version`;
        execSync(command, { stdio: 'ignore', timeout: 5000 });
        this.ffmpegPath = ffmpegPath;
        console.log(`✅ Found FFmpeg at: ${ffmpegPath}`);
        break;
      } catch (error) {
        // Try next path
        continue;
      }
    }

    // Find FFprobe (optional, but recommended)
    for (const ffprobePath of possibleProbePaths) {
      if (!ffprobePath) continue;
      
      try {
        const command = process.platform === 'win32'
          ? `"${ffprobePath}" -version`
          : `${ffprobePath} -version`;
        execSync(command, { stdio: 'ignore', timeout: 5000 });
        this.ffprobePath = ffprobePath;
        console.log(`✅ Found FFprobe at: ${ffprobePath}`);
        break;
      } catch (error) {
        // Try next path
        continue;
      }
    }

    if (!this.ffmpegPath) {
      const errorMsg = process.env.NODE_ENV === 'production'
        ? 'FFmpeg not found on Railway. Please check Dockerfile installation.'
        : 'FFmpeg not found locally. Install FFmpeg or set FFMPEG_PATH environment variable.';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Set paths in fluent-ffmpeg
    if (this.ffmpegPath) {
      ffmpeg.setFfmpegPath(this.ffmpegPath);
    }
    if (this.ffprobePath) {
      ffmpeg.setFfprobePath(this.ffprobePath);
    }
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
      // Set timeout for FFmpeg process (30 minutes max)
      const FFMPEG_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      let timeoutId: NodeJS.Timeout | null = null;
      
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
        // Use a longer duration to ensure it covers the entire audio length
        command.input('color=c=black:s=1280x720:d=3600')
          .inputFormat('lavfi')
          .inputOptions(['-framerate', '1']);
      }

      // Video settings - optimized for quality while maintaining reasonable processing time
      // Map streams first, then set codecs
      command
        .outputOptions(['-map', '0:a']) // Map audio from first input (audio file)
        .outputOptions(['-map', '1:v']) // Map video from second input (thumbnail or color)
        .outputOptions([
          '-c:v', 'libx264', // Video codec
          '-preset', 'fast', // Encoding preset (balance between speed and quality)
          '-crf', '23', // Constant Rate Factor (quality setting, lower = better quality)
          '-pix_fmt', 'yuv420p', // Required for YouTube compatibility
          '-r', '1', // 1 frame per second (static image)
          '-threads', '2', // Limit threads to reduce memory usage
          '-movflags', '+faststart', // Enable fast start for web playback
          '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2', // Ensure 16:9 aspect ratio
          '-aspect', '16:9', // Explicitly set aspect ratio to 16:9
          '-c:a', 'aac', // Audio codec
          '-b:a', '192k', // Audio bitrate
          '-shortest', // End when shortest input ends (audio)
          '-max_muxing_queue_size', '1024', // Prevent queue overflow
        ])
        .output(videoPath)
        .on('start', (cmd: string) => {
          console.log('🎬 FFmpeg command:', cmd);
          // Set timeout to kill process if it takes too long
          timeoutId = setTimeout(() => {
            console.error('❌ FFmpeg timeout after 30 minutes, killing process...');
            command.kill('SIGKILL');
            reject(new Error('FFmpeg process timeout after 30 minutes'));
          }, FFMPEG_TIMEOUT);
        })
        .on('progress', (progress: { percent?: number }) => {
          if (progress.percent) {
            console.log(`📹 Video processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          // Clear timeout on success
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
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
          // Clear timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          console.error('❌ FFmpeg error:', err);
          console.error('❌ Error details:', {
            message: err.message,
            name: err.name,
            stack: err.stack,
          });
          
          // Check if it's a memory issue
          if (err.message.includes('SIGKILL') || err.message.includes('killed')) {
            console.error('⚠️ FFmpeg was killed - likely out of memory or timeout');
            console.error('💡 Suggestions:');
            console.error('   1. Increase Railway service memory limit');
            console.error('   2. Use smaller audio files');
            console.error('   3. Reduce video quality settings');
          }
          
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

