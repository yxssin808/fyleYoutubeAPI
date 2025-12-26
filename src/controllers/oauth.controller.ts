// OAuth controller for YouTube authentication
import { Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuthService } from '../services/oauth.service.js';

/**
 * POST /api/youtube/oauth/authorize
 * Generate OAuth authorization URL
 */
export const authorizeController = async (req: Request, res: Response) => {
  // Debug: Log all Google-related environment variables
  console.log('🔐 OAuth authorize request received:', {
    method: req.method,
    url: req.url,
    body: req.body,
  });
  
  console.log('🔍 Environment Variables Check:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    clientIdPreview: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 30)}...` : 'MISSING',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('CLIENT')).join(', '),
  });

  try {
    let { redirect_uri } = req.body;

    if (!redirect_uri) {
      console.error('❌ Missing redirect_uri in request body');
      return res.status(400).json({
        error: 'Missing redirect_uri',
        message: 'redirect_uri is required',
      });
    }

    // Normalize redirect_uri: remove trailing slashes
    redirect_uri = redirect_uri.replace(/\/+$/, '');
    
    // Validate redirect_uri format
    try {
      const url = new URL(redirect_uri);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return res.status(400).json({
          error: 'Invalid redirect_uri',
          message: 'redirect_uri must use http or https protocol',
        });
      }
    } catch (urlError) {
      return res.status(400).json({
        error: 'Invalid redirect_uri',
        message: 'redirect_uri must be a valid URL',
      });
    }

    console.log(`✅ Redirect URI received and normalized: ${redirect_uri}`);

    // Validate Google OAuth credentials
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID is not set in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'GOOGLE_CLIENT_ID is not configured. Please set it in Railway/Vercel environment variables.',
      });
    }

    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ GOOGLE_CLIENT_SECRET is not set in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'GOOGLE_CLIENT_SECRET is not configured. Please set it in Railway/Vercel environment variables.',
      });
    }

    console.log('✅ Google OAuth credentials found');

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri
      );

      console.log('✅ OAuth2 client created');

      // Request YouTube-specific scopes
      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
      ];

      console.log('✅ Scopes defined:', scopes);

      // Force account selection by adding login_hint parameter removal and prompt
      // This ensures users can always select a different account
      // access_type: 'offline' is required to get a refresh token
      // prompt: 'consent' forces Google to show consent screen and return refresh token
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'select_account consent', // Allow user to select account AND force consent screen to get refresh token
        // Add a random state parameter to prevent caching
        state: `youtube_oauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      });

      console.log('✅ Auth URL generated successfully');
      console.log(`   Auth URL length: ${authUrl.length} characters`);
      console.log(`   Auth URL preview: ${authUrl.substring(0, 100)}...`);

      res.json({
        success: true,
        auth_url: authUrl,
      });
    } catch (oauthError: any) {
      console.error('❌ Error creating OAuth2 client or generating URL:', {
        error: oauthError.message,
        stack: oauthError.stack,
        name: oauthError.name,
        clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'missing',
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
      });
      throw oauthError;
    }
  } catch (error: any) {
    console.error('❌ Error generating OAuth URL:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      url: req.url,
      method: req.method,
      body: req.body,
    });
    
    res.status(500).json({
      error: 'Failed to generate OAuth URL',
      message: error.message || 'Unknown error occurred',
    });
  }
};

/**
 * POST /api/youtube/oauth/callback
 * Exchange authorization code for tokens
 */
export const callbackController = async (req: Request, res: Response) => {
  try {
    const { code, userId, redirect_uri } = req.body;

    if (!code || !userId || !redirect_uri) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'code, userId, and redirect_uri are required',
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri
    );

    // Exchange code for tokens
    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
    } catch (error: any) {
      console.error('❌ OAuth token exchange error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
      
      // Provide more specific error messages
      if (error.message?.includes('invalid_grant')) {
        throw new Error('Authorization code expired or already used. Please try connecting again.');
      }
      throw error;
    }

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Warn if no refresh token (needed for long-term access)
    if (!tokens.refresh_token) {
      console.warn('⚠️ No refresh token received. User may need to re-authorize after token expires.');
      console.warn('   This can happen if the user has already authorized the app before.');
      console.warn('   To get a refresh token, the user must revoke access and re-authorize.');
    }

    // Calculate expiration time (default: 1 hour from now)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).getTime()
      : Date.now() + 3600 * 1000;

    // Get YouTube channel information
    let channelId: string | null = null;
    let channelTitle: string | null = null;
    
    try {
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const channelResponse = await youtube.channels.list({
        part: ['snippet', 'id'],
        mine: true,
      });
      
      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        const channel = channelResponse.data.items[0];
        channelId = channel.id || null;
        channelTitle = channel.snippet?.title || null;
        console.log(`✅ YouTube channel info: ${channelTitle} (${channelId})`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to fetch YouTube channel info:', error.message);
      // Continue without channel info - not critical
    }

    // Save tokens and channel info to database
    const oauthService = new OAuthService();
    await oauthService.saveUserTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expires_at: expiresAt,
    }, {
      channelId,
      channelTitle,
    });

    res.json({
      success: true,
      message: 'YouTube account connected successfully',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exchanging OAuth code:', error);
    res.status(500).json({
      error: 'Failed to exchange OAuth code',
      message: error.message,
    });
  }
};

/**
 * GET /api/youtube/oauth/status
 * Check if user has connected YouTube account
 */
export const statusController = async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  try {
    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const oauthService = new OAuthService();
    
    try {
      const hasTokens = await oauthService.hasValidTokens(userId);
      
      res.json({
        success: true,
        connected: hasTokens,
      });
    } catch (serviceError: any) {
      // Don't log errors for missing tokens - that's expected if account is not connected
      if (serviceError.message?.includes('Supabase') || serviceError.message?.includes('not initialized')) {
        console.error('❌ Database error in OAuth status check:', serviceError.message);
        return res.status(500).json({
          error: 'Database connection error',
          message: 'Failed to connect to database. Please check server configuration.',
        });
      }
      
      // For other errors (like missing tokens), just return not connected
      // This is expected behavior, not an error
      res.json({
        success: true,
        connected: false,
      });
    }
  } catch (error: any) {
    // Only log unexpected errors
    console.error('❌ Unexpected error checking OAuth status:', {
      error: error.message,
      userId,
    });
    
    // Return not connected instead of error - this is expected if account is not connected
    res.json({
      success: true,
      connected: false,
    });
  }
};

/**
 * POST /api/youtube/oauth/disconnect
 * Disconnect YouTube account
 */
export const disconnectController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId is required',
      });
    }

    const oauthService = new OAuthService();
    
    // Clear tokens from database
    await oauthService.saveUserTokens(userId, {
      access_token: '',
      refresh_token: undefined,
      expires_at: undefined,
    });

    res.json({
      success: true,
      message: 'YouTube account disconnected successfully',
    });
  } catch (error: any) {
    console.error('❌ Error disconnecting OAuth:', error);
    res.status(500).json({
      error: 'Failed to disconnect YouTube account',
      message: error.message,
    });
  }
};

