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
   * Get user's plan start date (when current subscription period started)
   * Uses subscription period start, account creation, or first upload date
   * IMPORTANT: If plan was changed (downgrade/upgrade), uses updated_at as new start date
   * Returns the start of the current 30-day billing period
   */
  async getPlanStartDate(userId: string): Promise<Date> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback: use current month start
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }

      // Try to get subscription period info and updated_at from profiles
      // updated_at is automatically updated when plan changes (downgrade/upgrade)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_subscription_current_period_end, created_at, updated_at, plan')
        .eq('id', userId)
        .single();

      let baseDate: Date | null = null;
      let planUpdatedAt: Date | null = null;

      if (!profileError && profile) {
        // Check if plan was recently updated (downgrade/upgrade)
        // updated_at is set when plan changes
        if (profile.updated_at) {
          planUpdatedAt = new Date(profile.updated_at);
        }

        // If we have a subscription period end, calculate period start (30 days before)
        if (profile.stripe_subscription_current_period_end) {
          const periodEnd = new Date(profile.stripe_subscription_current_period_end);
          // Calculate period start (30 days before period end)
          const periodStart = new Date(periodEnd);
          periodStart.setDate(periodStart.getDate() - 30);
          baseDate = periodStart;
        }
        
        // Otherwise, use account creation date
        if (!baseDate && profile.created_at) {
          baseDate = new Date(profile.created_at);
        }
      }

      // Fallback: get the date of the first YouTube upload
      if (!baseDate) {
        const { data: firstUpload, error: uploadError } = await supabase
          .from('youtube_uploads')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (!uploadError && firstUpload?.created_at) {
          baseDate = new Date(firstUpload.created_at);
        }
      }

      // IMPORTANT: If plan was updated (downgrade/upgrade), use updated_at as new start date
      // This ensures rate limiting resets when plan changes
      if (planUpdatedAt && baseDate) {
        // If plan was updated more recently than the base date, use updated_at
        // This handles downgrades where rate limiting should reset
        if (planUpdatedAt > baseDate) {
          console.log('📅 Plan was updated - using updated_at as new start date:', {
            userId,
            planUpdatedAt: planUpdatedAt.toISOString(),
            oldBaseDate: baseDate.toISOString(),
            plan: profile?.plan,
          });
          baseDate = planUpdatedAt;
        }
      } else if (planUpdatedAt && !baseDate) {
        // If we don't have a base date but have updated_at, use it
        baseDate = planUpdatedAt;
      }

      // If we have a base date, calculate the current 30-day period start
      if (baseDate) {
        const now = new Date();
        const daysSinceBase = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        // Calculate which 30-day period we're in
        const periodNumber = Math.floor(daysSinceBase / 30);
        const currentPeriodStart = new Date(baseDate);
        currentPeriodStart.setDate(currentPeriodStart.getDate() + (periodNumber * 30));
        return currentPeriodStart;
      }

      // Final fallback: use current month start
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    } catch (error) {
      console.error('Exception fetching plan start date:', error);
      // Fallback: use current month start
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  /**
   * Count user's YouTube uploads in current billing period
   * Uses rolling 30-day window from plan start date (subscription period start)
   * instead of calendar month
   */
  async getMonthlyUploadCount(userId: string): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // If database is unavailable, return a high number to block uploads (fail-safe)
        console.error('⚠️ Database unavailable - blocking uploads for safety');
        return 999999;
      }

      // Get plan start date (subscription period start or account creation)
      const planStartDate = await this.getPlanStartDate(userId);
      
      const now = new Date();
      
      // Calculate the current 30-day period start
      // This creates a rolling 30-day window from the plan start date
      const daysSinceStart = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const periodNumber = Math.floor(daysSinceStart / 30);
      const currentPeriodStart = new Date(planStartDate);
      currentPeriodStart.setDate(currentPeriodStart.getDate() + (periodNumber * 30));

      console.log('📅 Upload count period:', {
        userId,
        planStartDate: planStartDate.toISOString(),
        currentPeriodStart: currentPeriodStart.toISOString(),
        now: now.toISOString(),
        daysSinceStart,
        periodNumber,
      });

      const { count, error } = await supabase
        .from('youtube_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', currentPeriodStart.toISOString());

      if (error) {
        console.error('Error counting monthly uploads:', error);
        // If database query fails, return a high number to block uploads (fail-safe)
        return 999999;
      }

      return count || 0;
    } catch (error) {
      console.error('Exception counting monthly uploads:', error);
      // If exception occurs, return a high number to block uploads (fail-safe)
      return 999999;
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
        console.error('❌ Supabase client not available');
        return [];
      }

      // Build query - always select all fields
      let query = supabase
        .from('youtube_uploads')
        .select('*')
        .eq('user_id', userId);

      // Only filter out archived if includeArchived is false
      if (!includeArchived) {
        // Show non-archived uploads (archived = false OR archived IS NULL)
        query = query.or('archived.is.null,archived.eq.false');
      }
      // If includeArchived is true, don't add any filter - show ALL uploads

      console.log(`📥 Fetching YouTube uploads for user ${userId}, includeArchived: ${includeArchived}`);
      console.log(`📥 Query will ${includeArchived ? 'include' : 'exclude'} archived uploads`);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching YouTube uploads:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return [];
      }

      const uploads = data || [];
      const archivedCount = uploads.filter((u: any) => u.archived === true).length;
      const nonArchivedCount = uploads.filter((u: any) => u.archived !== true).length;
      
      console.log(`✅ Fetched ${uploads.length} uploads total:`);
      console.log(`   - ${archivedCount} archived`);
      console.log(`   - ${nonArchivedCount} non-archived`);
      console.log(`   - includeArchived was: ${includeArchived}`);

      return uploads;
    } catch (error) {
      console.error('❌ Exception fetching YouTube uploads:', error);
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
        console.warn('⚠️ Supabase client not available for getPendingUploads');
        return [];
      }

      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const nowISO = now.toISOString();

      console.log('🔍 Querying pending uploads:', {
        now: nowISO,
        tenMinutesAgo,
      });

      // Get ALL pending uploads first (without scheduled_at filter)
      const { data: allPendingData, error: allPendingError } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);

      if (allPendingError) {
        console.error('❌ Error fetching all pending uploads:', allPendingError);
      } else {
        console.log(`📋 Found ${allPendingData?.length || 0} total pending uploads`);
      }

      // All pending uploads are ready to process
      // Scheduled uploads are uploaded immediately with publishAt parameter
      // YouTube handles the scheduling, not us
      const pendingData = allPendingData || [];

      console.log(`✅ Found ${pendingData.length} pending uploads ready to process`);

      // Get stuck processing uploads (processing for more than 10 minutes)
      const { data: stuckData, error: stuckError } = await supabase
        .from('youtube_uploads')
        .select('*')
        .eq('status', 'processing')
        .lt('updated_at', tenMinutesAgo)
        .order('updated_at', { ascending: true })
        .limit(5);

      if (stuckError) {
        console.error('❌ Error fetching stuck uploads:', stuckError);
      } else {
        console.log(`📋 Found ${stuckData?.length || 0} stuck processing uploads`);
      }

      const pending = pendingData || [];
      const stuck = stuckData || [];
      
      // Combine and deduplicate by ID
      const all = [...pending, ...stuck];
      const unique = Array.from(new Map(all.map(u => [u.id, u])).values());
      
      console.log(`📦 Returning ${unique.length} uploads to process`);
      
      return unique.slice(0, 10); // Limit to 10 total
    } catch (error) {
      console.error('❌ Exception fetching pending uploads:', error);
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

