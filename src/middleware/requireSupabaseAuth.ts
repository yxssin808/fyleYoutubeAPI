import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';

/**
 * Require Supabase auth by verifying the user's access token (JWT)
 * via Supabase GoTrue `/auth/v1/user`.
 *
 * Sets `req.userId` so controllers can rely on it instead of trusting
 * `userId` coming from query params / request body.
 */
export const requireSupabaseAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'SUPABASE_URL is not configured',
    });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing access token',
    });
    return;
  }

  const normalizedSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
  try {
    // Supabase verifies token signature + expiry server-side.
    const { data } = await axios.get(`${normalizedSupabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const userId = data?.id as string | undefined;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Unable to resolve user from access token',
      });
      return;
    }

    (req as any).userId = userId;
    next();
  } catch (err: any) {
    const status = err?.response?.status ?? 401;
    res.status(status).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session',
    });
    return;
  }
};

