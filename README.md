# YouTube API

Railway service for YouTube upload integration with FFmpeg video processing.

## Features

- **YouTube Upload Integration**: Full YouTube Data API v3 integration
- **OAuth2 Authentication**: Google OAuth2 for YouTube API access
- **Video Creation**: Automatic MP4 video creation from audio + thumbnail using FFmpeg (directly in this service)
- **Video Upload**: Automatic video upload to YouTube with metadata
- **Job Queue System**: Asynchronous processing of uploads
- **Plan-based Limits**: Free: 4/month, Bedroom: 30/month, Pro/Studio: unlimited
- **Format Validation**: MP3 for Free/Bedroom, MP3+WAV for Pro/Studio
- **Upload Scheduling**: Schedule uploads for future dates
- **Thumbnail Support**: Images/GIFs up to 7MB (converted to video background)
- **Delete Functionality**: Delete uploads and YouTube videos
- **Status Tracking**: Real-time status updates (pending → processing → uploaded/failed)

## Prerequisites

### FFmpeg Installation

**FFmpeg is automatically installed via Dockerfile** when deploying to Railway. No manual installation needed!

For local development, install FFmpeg:

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

**Windows:**
Download from [FFmpeg official website](https://ffmpeg.org/download.html) or use Chocolatey:
```bash
choco install ffmpeg
```

## Environment Variables

### Required Variables

These variables **must** be set for the service to work:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase Dashboard → Settings → API → service_role key (⚠️ Keep secret!) |
| `FRONTEND_URL` | Your frontend URL for CORS | Your production frontend URL (e.g., `https://fyle-cloud.com`) |
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_REDIRECT_URI` | OAuth2 redirect URI | Your frontend OAuth callback URL (e.g., `https://fyle-cloud.com/youtube/oauth/callback`) |
| `STORAGE_API_URL` | Storage service URL | Your storage service URL (e.g., `https://fylestorage.vercel.app/api`) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4001` (Railway sets this automatically) |
| `NODE_ENV` | Node environment | Automatically set by Railway |

### Setting Variables

**For Local Development:**
1. Copy `env.example` to `.env.local`
2. Fill in the required values

**For Railway Deployment:**
1. Go to Railway Dashboard → Your Project → Variables
2. Add all required variables
3. Railway will automatically use these in production

## Development

```bash
# Install dependencies
npm install

# Make sure FFmpeg is installed locally (see Prerequisites)

# Start development server
npm run dev
```

The service will be available at `http://localhost:4001`.

## Deployment to Railway

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"** (or use Railway CLI)
4. Select your repository and the `youtube-api` directory

### Step 2: Configure Build Settings

Railway will automatically detect the `Dockerfile` and `railway.json` configuration:

- **Builder**: Dockerfile (automatically detected)
- **Start Command**: `npm start` (from railway.json)
- **Port**: Railway sets `PORT` automatically

### Step 3: Set Environment Variables

In Railway Dashboard → Your Project → Variables, add all required environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://fyle-cloud.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://fyle-cloud.com/youtube/oauth/callback
STORAGE_API_URL=https://fylestorage.vercel.app/api
```

### Step 4: Deploy

Railway will automatically:
1. Build the Docker image (installs FFmpeg)
2. Install dependencies
3. Build TypeScript
4. Start the server

### Step 5: Get Your Service URL

1. Railway will provide a public URL (e.g., `https://youtube-api-production.up.railway.app`)
2. Update your frontend to use this URL instead of the Vercel URL
3. The service is now ready to use!

## API Endpoints

### POST `/api/youtube/upload`

Create a YouTube upload request.

**Request Body:**
```json
{
  "userId": "string",
  "fileId": "string",
  "title": "string",
  "description": "string (optional)",
  "tags": ["string"] (optional),
  "thumbnailUrl": "string (optional)",
  "scheduledAt": "ISO date string (optional)"
}
```

### GET `/api/youtube/uploads?userId=string`

Get user's YouTube uploads.

### GET `/api/youtube/limits?userId=string`

Get user's YouTube upload limits based on their plan.

### DELETE `/api/youtube/upload/:id?userId=string`

Delete a YouTube upload and associated video.

### POST `/api/youtube/process`

Manually trigger processing of pending uploads (internal/admin use).

## OAuth2 Setup

### Using Existing Google OAuth Credentials

**Good news!** If you already have Google OAuth set up for user registration (via Supabase), you can **reuse the same OAuth Client ID and Secret** for YouTube!

1. **Google Cloud Console Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your existing project (the same one used for Supabase Auth)
   - Enable **YouTube Data API v3**:
     - Go to **APIs & Services → Library**
     - Search for "YouTube Data API v3"
     - Click **Enable**
   - **No need to create new OAuth credentials** - use your existing ones!

2. **Update OAuth Consent Screen (if needed):**
   - Go to **APIs & Services → OAuth consent screen**
   - Add YouTube scopes:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube`
   - Save and continue

3. **Add Redirect URI:**
   - Go to **APIs & Services → Credentials**
   - Edit your existing OAuth 2.0 Client ID
   - Add to **Authorized redirect URIs**:
     ```
     https://your-frontend.com/youtube/oauth/callback
     http://localhost:5173/youtube/oauth/callback  (for local dev)
     ```

4. **Database Migration:**
   - Run migration `20250131000005_add_youtube_oauth_fields.sql`
   - This adds OAuth token fields to the `profiles` table

5. **User Authentication Flow:**
   - Users connect their YouTube account via the "Connect" button in the YouTube upload page
   - This uses a separate OAuth flow with YouTube-specific scopes
   - Tokens are stored in the `profiles` table
   - The service uses these tokens to upload videos

**Note:** The YouTube OAuth flow is separate from the Supabase Auth Google login. Users need to connect their YouTube account specifically for video uploads, even if they logged in with Google.

## Processing Workflow

1. User creates upload request → Status: `pending`
2. If not scheduled, upload is queued immediately
3. Background processor:
   - Gets audio file URL from CDN/S3
   - **Creates MP4 video directly using FFmpeg** (audio + thumbnail)
   - Uploads MP4 video to YouTube using OAuth2 tokens
   - Uploads thumbnail as custom thumbnail (if provided)
   - Updates status to `uploaded` or `failed`
4. User can view status in the uploads overview

## Video Creation

The service automatically creates MP4 videos from audio files using FFmpeg:
- **With Thumbnail**: Audio + thumbnail image (looped for entire duration)
- **Without Thumbnail**: Audio + black background (1280x720)
- **Format**: MP4 (H.264 video, AAC audio) - YouTube compatible
- **Resolution**: 1280x720 (720p)
- **Processing**: Done directly in this service (no external API calls needed)

## Plan Limits

- **Free**: 4 uploads/month, MP3 only
- **Bedroom**: 30 uploads/month, MP3 only
- **Pro**: Unlimited uploads, MP3 + WAV
- **Studio**: Unlimited uploads, MP3 + WAV

## Troubleshooting

### FFmpeg Not Found

If you see `FFmpeg not found` errors:

1. **Local Development**: Make sure FFmpeg is installed (see Prerequisites)
2. **Railway**: The Dockerfile automatically installs FFmpeg. If it's not working, check the build logs.

### Video Processing Fails

- Check Railway logs for FFmpeg errors
- Ensure audio file is accessible (CDN URL, public URL, or signed URL)
- Check thumbnail URL is valid (if provided)

### OAuth Errors

See the troubleshooting guides:
- `FIX_REDIRECT_URI_MISMATCH.md` - For redirect URI errors
- `FIX_OAUTH_ACCESS_DENIED.md` - For access denied errors

## Architecture

This service runs as a **standalone Railway service** with:
- **Express.js** server
- **FFmpeg** for video processing (installed via Dockerfile)
- **Direct video creation** (no external API calls)
- **Background job processing** (reliable on Railway, unlike Vercel Serverless)

## Migration from Vercel

If you were previously using this service on Vercel:

1. **Remove Vercel-specific code**: Already done (no more `export default app`)
2. **Update frontend URL**: Point to your Railway service URL
3. **Remove `API_BASE_URL`**: No longer needed (FFmpeg is in this service)
4. **Deploy to Railway**: Follow the deployment steps above
