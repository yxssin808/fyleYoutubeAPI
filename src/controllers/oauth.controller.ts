// OAuth controller for YouTube authentication
import { Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuthService } from '../services/oauth.service.js';

/**
 * POST /api/youtube/oauth/authorize
 * Generate OAuth authorization URL
 */
export const authorizeController = async (req: Request, res: Response) => {
  try {
    const { redirect_uri } = req.body;

    if (!redirect_uri) {
      return res.status(400).json({
        error: 'Missing redirect_uri',
        message: 'redirect_uri is required',
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri
    );

    // Request YouTube-specific scopes
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ];

    // Force account selection by adding login_hint parameter removal and prompt
    // This ensures users can always select a different account
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent', // Allow user to select account AND force consent screen
      // Add a random state parameter to prevent caching
      state: `youtube_oauth_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });

    res.json({
      success: true,
      auth_url: authUrl,
    });
  } catch (error: any) {
    console.error('❌ Error generating OAuth URL:', error);
    res.status(500).json({
      error: 'Failed to generate OAuth URL',
      message: error.message,
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

    // Calculate expiration time (default: 1 hour from now)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).getTime()
      : Date.now() + 3600 * 1000;

    // Save tokens to database
    const oauthService = new OAuthService();
    await oauthService.saveUserTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expires_at: expiresAt,
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
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const oauthService = new OAuthService();
    const hasTokens = await oauthService.hasValidTokens(userId);

    res.json({
      success: true,
      connected: hasTokens,
    });
  } catch (error: any) {
    console.error('❌ Error checking OAuth status:', error);
    res.status(500).json({
      error: 'Failed to check OAuth status',
      message: error.message,
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

