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
      console.error('❌ Supabase client not initialized in getUserTokens');
      throw new Error('Supabase client not initialized. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    try {
      console.log(`🔍 Fetching OAuth tokens for user: ${userId}`);
      
      // Check if we have a youtube_tokens table
      // For now, we'll use a profiles extension or create a separate table
      const { data, error } = await supabase
        .from('profiles')
        .select('youtube_access_token, youtube_refresh_token, youtube_token_expires_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching OAuth tokens from database:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
        });
        
        // Check if column doesn't exist
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          throw new Error('YouTube OAuth columns not found in profiles table. Please run migration: 20250131000005_add_youtube_oauth_fields.sql');
        }
        
        return null;
      }

      if (!data) {
        console.log(`ℹ️ No profile data found for user: ${userId}`);
        return null;
      }

      if (!data.youtube_access_token) {
        console.log(`ℹ️ No YouTube access token found for user: ${userId}`);
        return null;
      }

      console.log(`✅ OAuth tokens found for user: ${userId}`);
      return {
        access_token: data.youtube_access_token,
        refresh_token: data.youtube_refresh_token || undefined,
        expires_at: data.youtube_token_expires_at ? new Date(data.youtube_token_expires_at).getTime() : undefined,
      };
    } catch (error: any) {
      console.error('❌ Exception fetching OAuth tokens:', {
        error: error.message,
        stack: error.stack,
        userId,
      });
      // Re-throw if it's a migration error
      if (error.message?.includes('migration')) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Save user's OAuth tokens to database
   */
  async saveUserTokens(userId: string, tokens: OAuthTokens): Promise<void> {
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

      const { error } = await supabase
        .from('profiles')
        .update({
          youtube_access_token: tokens.access_token,
          youtube_refresh_token: tokens.refresh_token || null,
          youtube_token_expires_at: expiresAt,
        })
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
    try {
      const tokens = await this.getUserTokens(userId);
      if (!tokens) {
        console.log(`ℹ️ No tokens found for user: ${userId}`);
        return false;
      }

      // Check if token is expired
      if (tokens.expires_at && tokens.expires_at < Date.now()) {
        console.log(`ℹ️ Tokens expired for user: ${userId}`);
        return false;
      }

      console.log(`✅ Valid tokens found for user: ${userId}`);
      return true;
    } catch (error: any) {
      console.error('❌ Error checking valid tokens:', {
        error: error.message,
        stack: error.stack,
        userId,
      });
      // Return false on error instead of throwing
      return false;
    }
  }
}

