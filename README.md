# YouTube API

Serverless Vercel service for YouTube upload integration.

## Features

- YouTube upload request creation
- Plan-based upload limits (Free: 4/month, Bedroom: 30/month, Pro/Studio: unlimited)
- Format validation (MP3 for Free/Bedroom, MP3+WAV for Pro/Studio)
- Upload scheduling
- Thumbnail support (images/GIFs up to 7MB)

## Environment Variables

Required environment variables:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for bypassing RLS)
- `FRONTEND_URL` - Frontend URL for CORS
- `PORT` - Server port (default: 4001)

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

