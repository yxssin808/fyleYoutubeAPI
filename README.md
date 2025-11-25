# YouTube API

Serverless Vercel service for YouTube upload integration.

## Features

- YouTube upload request creation
- Plan-based upload limits (Free: 4/month, Bedroom: 30/month, Pro/Studio: unlimited)
- Format validation (MP3 for Free/Bedroom, MP3+WAV for Pro/Studio)
- Upload scheduling
- Thumbnail support (images/GIFs up to 7MB)

## Environment Variables

### Required Variables

These variables **must** be set for the service to work:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase Dashboard → Settings → API → service_role key (⚠️ Keep secret!) |
| `FRONTEND_URL` | Your frontend URL for CORS | Your production frontend URL (e.g., `https://fyle-cloud.com`) |

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

## Plan Limits

- **Free**: 4 uploads/month, MP3 only
- **Bedroom**: 30 uploads/month, MP3 only
- **Pro**: Unlimited uploads, MP3 + WAV
- **Studio**: Unlimited uploads, MP3 + WAV

