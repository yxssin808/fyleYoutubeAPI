# YouTube API

Serverless Vercel service for YouTube upload integration.

## Features

- **YouTube Upload Integration**: Full YouTube Data API v3 integration
- **OAuth2 Authentication**: Google OAuth2 for YouTube API access
- **Video Creation**: Automatic MP4 video creation from audio + thumbnail using FFmpeg
- **Video Upload**: Automatic video upload to YouTube with metadata
- **Job Queue System**: Asynchronous processing of uploads
- **Plan-based Limits**: Free: 4/month, Bedroom: 30/month, Pro/Studio: unlimited
- **Format Validation**: MP3 for Free/Bedroom, MP3+WAV for Pro/Studio
- **Upload Scheduling**: Schedule uploads for future dates
- **Thumbnail Support**: Images/GIFs up to 7MB (converted to video background)
- **Delete Functionality**: Delete uploads and YouTube videos
- **Status Tracking**: Real-time status updates (pending → processing → uploaded/failed)

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
| `API_BASE_URL` | Main API service URL (with FFmpeg) | Your main API service URL (e.g., `https://fyle-api.vercel.app`) |
| `STORAGE_API_URL` | Storage service URL | Your storage service URL (e.g., `https://fylestorage.vercel.app/api`) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (local dev only) | `4001` |
| `NODE_ENV` | Node environment | Automatically set by Vercel |
| `VERCEL` | Vercel detection flag | Automatically set by Vercel |

### Setting Variables

**For Local Development:**
1. Copy `env.example` to `.env.local`
2. Fill in the required values

**For Vercel Deployment:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all required variables for Production, Preview, and Development environments

## Prerequisites

### API Service with FFmpeg

**This service delegates video processing to the main API service**, which already has FFmpeg installed. 

**No FFmpeg installation needed here!** The video creation is handled by the main API service (`api/`), which runs on a platform that supports FFmpeg (Railway, Render, etc.).

Make sure to set `API_BASE_URL` environment variable pointing to your main API service.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

The service will be available at your Vercel deployment URL.

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

### DELETE `/api/youtube/upload/:id`

Delete a YouTube upload and associated video.

**Request Body:**
```json
{
  "userId": "string"
}
```

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
   - **Calls main API service** to create MP4 video (audio + thumbnail)
   - Downloads the created video stream
   - Uploads MP4 video to YouTube using OAuth2 tokens
   - Uploads thumbnail as custom thumbnail (if provided)
   - Updates status to `uploaded` or `failed`
4. User can view status in the uploads overview

## Video Creation

The service automatically creates MP4 videos from audio files:
- **With Thumbnail**: Audio + thumbnail image (looped for entire duration)
- **Without Thumbnail**: Audio + black background (1280x720)
- **Format**: MP4 (H.264 video, AAC audio) - YouTube compatible
- **Resolution**: 1280x720 (720p)

## Plan Limits

- **Free**: 4 uploads/month, MP3 only
- **Bedroom**: 30 uploads/month, MP3 only
- **Pro**: Unlimited uploads, MP3 + WAV
- **Studio**: Unlimited uploads, MP3 + WAV

