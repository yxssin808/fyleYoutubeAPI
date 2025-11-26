// OAuth2 service for Google/YouTube authentication
import { getSupabaseClient } from '../lib/supabaseClient.js';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export class OAuthService {
  /**
   * Get user's OAuth tokens from database
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

      return {
        access_token: data.youtube_access_token,
        refresh_token: data.youtube_refresh_token || undefined,
        expires_at: data.youtube_token_expires_at ? new Date(data.youtube_token_expires_at).getTime() : undefined,
      };
    } catch (error) {
      console.error('Error fetching OAuth tokens:', error);
      return null;
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
   */
  async hasValidTokens(userId: string): Promise<boolean> {
    const tokens = await this.getUserTokens(userId);
    if (!tokens) {
      return false;
    }

    // Check if token is expired
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      return false;
    }

    return true;
  }
}

