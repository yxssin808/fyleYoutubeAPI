// OAuth2 service for Google/YouTube authentication
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { google } from 'googleapis';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export class OAuthService {
  /**
   * Get user's OAuth tokens from database and refresh if needed
   */
  async getUserTokens(userId: string): Promise<OAuthTokens | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Check if we have a youtube_tokens table
      // For now, we'll use a profiles extension or create a separate table
      const { data, error } = await supabase
        .from('profiles')
        .select('youtube_access_token, youtube_refresh_token, youtube_token_expires_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      if (!data.youtube_access_token) {
        return null;
      }

      const expiresAt = data.youtube_token_expires_at ? new Date(data.youtube_token_expires_at).getTime() : undefined;
      const refreshToken = data.youtube_refresh_token || undefined;

      // Check if token is expired or will expire within 30 minutes
      // Access tokens are valid for 1 hour (set by Google, cannot be changed)
      // We refresh proactively 30 minutes before expiration to keep tokens active longer
      // This ensures tokens remain valid throughout long upload processes
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes before expiration
      const isExpiredOrExpiringSoon = !expiresAt || (expiresAt - now) < thirtyMinutes;

      // If token is expired or expiring soon, and we have a refresh token, refresh it
      if (isExpiredOrExpiringSoon && refreshToken) {
        console.log(`🔄 Token expired or expiring soon for user ${userId}, refreshing...`);
        try {
          const refreshedTokens = await this.refreshAccessToken(refreshToken);
          
          // Save the new tokens to database
          await this.saveUserTokens(userId, {
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || refreshToken, // Keep old refresh token if new one not provided
            expires_at: refreshedTokens.expires_at,
          });

          return refreshedTokens;
        } catch (refreshError: any) {
          console.error('❌ Failed to refresh access token:', refreshError);
          // If refresh fails with invalid_grant or invalid_token, the refresh token is invalid
          // Also check for common OAuth error codes and messages
          const isInvalidToken = refreshError.message?.includes('invalid_grant') || 
              refreshError.message?.includes('invalid_token') ||
              refreshError.message?.includes('Token has been expired or revoked') ||
              refreshError.message?.includes('token_expired') ||
              refreshError.code === 401 ||
              refreshError.code === 400 ||
              (refreshError.response?.data?.error === 'invalid_grant') ||
              (refreshError.response?.data?.error === 'invalid_token');
              
          if (isInvalidToken) {
            // Clear invalid tokens from database
            await this.saveUserTokens(userId, { access_token: '' });
            throw new Error('YouTube account connection expired. Please reconnect your YouTube account in the settings.');
          }
          // For other errors, try with existing token but log warning
          console.warn('⚠️ Token refresh failed, attempting with existing token');
        }
      }

      return {
        access_token: data.youtube_access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      };
    } catch (error) {
      console.error('Error fetching OAuth tokens:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('OAuth2 credentials not configured. Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      // Calculate expiration time (default: 1 hour from now)
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date).getTime()
        : Date.now() + 3600 * 1000;

      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expires_at: expiresAt,
      };
    } catch (error: any) {
      // Provide more specific error messages
      // Check for all common OAuth error codes and messages
      const isInvalidToken = error.message?.includes('invalid_grant') || 
          error.message?.includes('invalid_token') ||
          error.message?.includes('Token has been expired or revoked') ||
          error.message?.includes('token_expired') ||
          error.code === 400 ||
          error.code === 401 ||
          (error.response?.data?.error === 'invalid_grant') ||
          (error.response?.data?.error === 'invalid_token');
          
      if (isInvalidToken) {
        throw new Error('YouTube account connection expired. Please reconnect your YouTube account in the settings.');
      }
      // Re-throw with original message for other errors
      throw error;
    }
  }

  /**
   * Save user's OAuth tokens to database
   */
  async saveUserTokens(
    userId: string, 
    tokens: OAuthTokens,
    channelInfo?: { channelId?: string | null; channelTitle?: string | null }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const expiresAt = tokens.expires_at
        ? new Date(tokens.expires_at).toISOString()
        : null;

      // If access_token is empty, clear all tokens
      if (!tokens.access_token || tokens.access_token.trim() === '') {
        const { error } = await supabase
          .from('profiles')
          .update({
            youtube_access_token: null,
            youtube_refresh_token: null,
            youtube_token_expires_at: null,
          })
          .eq('id', userId);

        if (error) {
          throw error;
        }
        return;
      }

      const updateData: any = {
        youtube_access_token: tokens.access_token,
        youtube_refresh_token: tokens.refresh_token || null,
        youtube_token_expires_at: expiresAt,
      };

      // Add channel info if provided
      if (channelInfo) {
        updateData.youtube_channel_id = channelInfo.channelId || null;
        updateData.youtube_channel_title = channelInfo.channelTitle || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving OAuth tokens:', error);
      throw new Error('Failed to save OAuth tokens');
    }
  }

  /**
   * Check if user has valid OAuth tokens
   * Returns true if user has tokens (access token or refresh token)
   * 
   * Token Duration (set by Google, cannot be changed):
   * - Access tokens: 1 hour (3600 seconds)
   * - Refresh tokens: 6 months (can expire if user revokes access or changes password)
   * 
   * If we have a refresh token, we can always get a new access token,
   * so the connection is considered valid as long as refresh token exists.
   */
  async hasValidTokens(userId: string): Promise<boolean> {
    const tokens = await this.getUserTokens(userId);
    if (!tokens) {
      return false;
    }

    // If we have a refresh token, tokens are valid (we can always refresh)
    if (tokens.refresh_token) {
      return true;
    }

    // If no refresh token, check if access token is still valid
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      return false;
    }

    return true;
  }
}

