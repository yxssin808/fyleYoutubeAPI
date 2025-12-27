// Supabase service for YouTube uploads
import { getSupabaseClient } from '../lib/supabaseClient.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService {
  /**
   * Get Supabase client
   */
  get client(): SupabaseClient | null {
    return getSupabaseClient();
  }
  /**
   * Get file metadata by ID
   */
  async getFile(fileId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error) {
        console.error('Error fetching file:', error);
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('Exception fetching file:', error);
      return null;
    }
  }

  /**
   * Get user's plan from profiles table
   */
  async getUserPlan(userId: string): Promise<string> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return 'free';
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching user plan:', error);
        return 'free';
      }

      return data.plan || 'free';
    } catch (error) {
      console.error('Exception fetching user plan:', error);
      return 'free';
    }
  }

  /**
   * Count user's YouTube uploads this month
   */
  async getMonthlyUploadCount(userId: string): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return 0;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count, error } = await supabase
        .from('youtube_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

      if (error) {
        console.error('Error counting monthly uploads:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Exception counting monthly uploads:', error);
      return 0;
    }
  }

  /**
   * Create YouTube upload record
   */
  async createYouTubeUpload(data: {
    user_id: string;
    file_id: string;
    title: string;
    description?: string | null;
    tags?: string[] | null;
    thumbnail_url?: string | null;
    scheduled_at?: string | null;
    privacy_status?: 'public' | 'unlisted' | 'private';
    status: string;
  }): Promise<any> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: result, error } = await supabase
        .from('youtube_uploads')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Error creating YouTube upload:', error);
        throw error;
      }

      return result;
    } catch (error: any) {
      console.error('Exception creating YouTube upload:', error);
      throw error;
    }
  }

  /**
   * Get user's YouTube uploads
   */
  async getYouTubeUploads(userId: string, includeArchived: boolean = false): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      let query = supabase
        .from('youtube_uploads')
        .select('*')
        .eq('user_id', userId);

      if (!includeArchived) {
        query = query.or('archived.is.null,archived.eq.false');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching YouTube uploads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching YouTube uploads:', error);
      return [];
    }
  }

  /**
   * Update YouTube upload record
   */
  async updateYouTubeUpload(
    uploadId: string,
    updates: {
      status?: string;
      youtube_video_id?: string;
      youtube_channel_id?: string | null;
      youtube_channel_title?: string | null;
      error_message?: string;
      archived?: boolean;
    }
  ): Promise<any> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase
        .from('youtube_uploads')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadId)
        .select()
        .single();

      if (error) {
        console.error('Error updating YouTube upload:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Exception updating YouTube upload:', error);
      throw error;
    }
  }

  /**
   * Get pending uploads that are ready to process
   * Also includes "processing" uploads that are stuck (more than 10 minutes)
   */
  async getPendingUploads(): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const nowISO = now.toISOString();

      // Get pending uploads that are ready (not scheduled or scheduled time has passed)
      const { data: pendingData, error: pendingError } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('status', 'pending')
        .or(`scheduled_at.is.null,scheduled_at.lte.${nowISO}`)
        .order('created_at', { ascending: true })
        .limit(10);

      // Get stuck processing uploads (processing for more than 10 minutes)
      const { data: stuckData, error: stuckError } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('status', 'processing')
        .lt('updated_at', tenMinutesAgo)
        .order('updated_at', { ascending: true })
        .limit(5);

      if (pendingError) {
        console.error('Error fetching pending uploads:', pendingError);
      }
      if (stuckError) {
        console.error('Error fetching stuck uploads:', stuckError);
      }

      const pending = pendingData || [];
      const stuck = stuckData || [];
      
      // Combine and deduplicate by ID
      const all = [...pending, ...stuck];
      const unique = Array.from(new Map(all.map(u => [u.id, u])).values());
      
      return unique.slice(0, 10); // Limit to 10 total
    } catch (error) {
      console.error('Exception fetching pending uploads:', error);
      return [];
    }
  }

  /**
   * Delete YouTube upload record
   */
  async deleteYouTubeUpload(uploadId: string, userId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await supabase
        .from('youtube_uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', userId); // Ensure user owns the upload

      if (error) {
        console.error('Error deleting YouTube upload:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Exception deleting YouTube upload:', error);
      throw error;
    }
  }

  /**
   * Get YouTube upload by ID
   */
  async getYouTubeUpload(uploadId: string): Promise<any | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (error) {
        console.error('Error fetching YouTube upload:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching YouTube upload:', error);
      return null;
    }
  }
}

