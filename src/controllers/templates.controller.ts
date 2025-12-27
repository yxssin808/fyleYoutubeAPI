// Description templates controller
import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase.service.js';

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/[<>]/g, '');
}

/**
 * GET /api/youtube/templates
 * Get user's templates and system templates
 */
export const getTemplatesController = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId',
        message: 'userId query parameter is required',
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const supabaseService = new SupabaseService();
    const supabase = supabaseService.client;

    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection failed',
      });
    }

    // Get user templates and system templates
    const { data: templates, error } = await supabase
      .from('youtube_description_templates')
      .select('*')
      .or(`user_id.eq.${sanitizedUserId},is_system.eq.true`)
      .order('is_system', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return res.status(500).json({
        error: 'Failed to fetch templates',
        message: error.message,
      });
    }

    res.json({
      success: true,
      templates: templates || [],
    });
  } catch (error: any) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message,
    });
  }
};

/**
 * POST /api/youtube/templates
 * Create a new template
 */
export const createTemplateController = async (req: Request, res: Response) => {
  try {
    const { userId, name, description } = req.body;

    if (!userId || !name || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'name', 'description'],
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedName = sanitizeString(name).trim();
    const sanitizedDescription = sanitizeString(description).trim();

    if (!sanitizedName || sanitizedName.length === 0) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Name must be a non-empty string',
      });
    }

    if (sanitizedName.length > 100) {
      return res.status(400).json({
        error: 'Name too long',
        message: 'Name must be 100 characters or less',
      });
    }

    const supabaseService = new SupabaseService();
    const supabase = supabaseService['client'] || (await import('../lib/supabaseClient.js')).getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection failed',
      });
    }

    const { data: template, error } = await supabase
      .from('youtube_description_templates')
      .insert({
        user_id: sanitizedUserId,
        name: sanitizedName,
        description: sanitizedDescription,
        is_default: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return res.status(500).json({
        error: 'Failed to create template',
        message: error.message,
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('❌ Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message,
    });
  }
};

/**
 * PUT /api/youtube/templates/:id
 * Update a template
 */
export const updateTemplateController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, name, description, is_default } = req.body;

    console.log('📝 Update template request:', { 
      id, 
      userId, 
      name: name !== undefined, 
      description: description !== undefined, 
      is_default,
      is_defaultType: typeof is_default,
      body: req.body 
    });

    if (!userId || !id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'id'],
        received: { userId: !!userId, id: !!id },
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedId = sanitizeString(id);

    const supabaseService = new SupabaseService();
    const supabase = supabaseService['client'] || (await import('../lib/supabaseClient.js')).getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection failed',
      });
    }

    // Check if template exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('youtube_description_templates')
      .select('*')
      .eq('id', sanitizedId)
      .eq('user_id', sanitizedUserId)
      .eq('is_system', false)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'Template does not exist or you do not have permission to edit it',
      });
    }

    const updateData: any = {};
    if (name !== undefined) {
      const sanitizedName = sanitizeString(name).trim();
      if (sanitizedName.length > 0 && sanitizedName.length <= 100) {
        updateData.name = sanitizedName;
      }
    }
    if (description !== undefined) {
      updateData.description = sanitizeString(description).trim();
    }
    // Handle is_default flag (can be boolean true/false or undefined)
    if (is_default !== undefined) {
      const shouldBeDefault = is_default === true || is_default === 'true';
      // If setting as default, unset all other defaults for this user first
      if (shouldBeDefault) {
        const { error: unsetError } = await supabase
          .from('youtube_description_templates')
          .update({ is_default: false })
          .eq('user_id', sanitizedUserId)
          .eq('is_system', false)
          .neq('id', sanitizedId);
        
        if (unsetError) {
          console.error('Error unsetting other defaults:', unsetError);
          // Continue anyway, as this is not critical
        }
      }
      // Always set is_default, even if it's the same value (allows re-setting default)
      updateData.is_default = shouldBeDefault;
    }

    // Check if we have at least one field to update
    // is_default is always valid if provided, even if it's false
    if (Object.keys(updateData).length === 0) {
      console.error('No valid fields to update:', { name, description, is_default, body: req.body });
      return res.status(400).json({
        error: 'No valid fields to update',
        message: 'At least one field (name, description, or is_default) must be provided',
        received: { 
          name: name !== undefined, 
          description: description !== undefined, 
          is_default: is_default !== undefined,
          body: req.body 
        },
      });
    }

    console.log('Updating template:', { id: sanitizedId, userId: sanitizedUserId, updateData });

    const { data: template, error } = await supabase
      .from('youtube_description_templates')
      .update(updateData)
      .eq('id', sanitizedId)
      .eq('user_id', sanitizedUserId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return res.status(500).json({
        error: 'Failed to update template',
        message: error.message,
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('❌ Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message,
    });
  }
};

/**
 * DELETE /api/youtube/templates/:id
 * Delete a template
 */
export const deleteTemplateController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    if (!userId || !id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'id'],
      });
    }

    const sanitizedUserId = sanitizeString(userId);
    const sanitizedId = sanitizeString(id);

    const supabaseService = new SupabaseService();
    const supabase = supabaseService['client'] || (await import('../lib/supabaseClient.js')).getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        error: 'Database connection failed',
      });
    }

    // Check if template exists and belongs to user (and is not system)
    const { data: existing, error: checkError } = await supabase
      .from('youtube_description_templates')
      .select('*')
      .eq('id', sanitizedId)
      .eq('user_id', sanitizedUserId)
      .eq('is_system', false)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'Template does not exist or you do not have permission to delete it',
      });
    }

    const { error } = await supabase
      .from('youtube_description_templates')
      .delete()
      .eq('id', sanitizedId)
      .eq('user_id', sanitizedUserId);

    if (error) {
      console.error('Error deleting template:', error);
      return res.status(500).json({
        error: 'Failed to delete template',
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message,
    });
  }
};

