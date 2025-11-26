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
        console.warn('⚠️ Supabase client not initialized, defaulting to free plan');
        return 'free';
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('❌ Error fetching user plan:', {
          error: error?.message,
          userId,
          data: data ? 'exists' : 'null',
        });
        return 'free';
      }

      // Normalize plan name (lowercase, handle variations)
      const plan = (data.plan || 'free').toLowerCase().trim();
      
      // Map common variations to standard plan names
      const planMap: Record<string, string> = {
        'free': 'free',
        'bedroom': 'bedroom',
        'pro': 'pro',
        'studio': 'studio',
        // Handle any other variations
      };

      const normalizedPlan = planMap[plan] || plan;
      
      console.log(`✅ User plan fetched: ${plan} → ${normalizedPlan} (userId: ${userId})`);
      
      return normalizedPlan;
    } catch (error) {
      console.error('❌ Exception fetching user plan:', error);
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
  async getYouTubeUploads(userId: string): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

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
      error_message?: string;
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
   */
  async getPendingUploads(): Promise<any[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('status', 'pending')
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .order('created_at', { ascending: true })
        .limit(10); // Process 10 at a time

      if (error) {
        console.error('Error fetching pending uploads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching pending uploads:', error);
      return [];
    }
  }

  /**
   * Delete YouTube upload record
   */
  async deleteYouTubeUpload(uploadId: string, userId: string): Promise<void> {
    console.log(`🗄️ Deleting YouTube upload from database: ${uploadId}, user: ${userId}`);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.error('❌ Supabase client not initialized');
        throw new Error('Supabase client not initialized');
      }

      console.log('✅ Supabase client obtained, executing delete query...');
      const { data, error } = await supabase
        .from('youtube_uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', userId) // Ensure user owns the upload
        .select();

      if (error) {
        console.error('❌ Error deleting YouTube upload from database:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          uploadId,
          userId,
        });
        throw error;
      }

      console.log(`✅ Delete query executed successfully. Deleted rows: ${data?.length || 0}`);
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

