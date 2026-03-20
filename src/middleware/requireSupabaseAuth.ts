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
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'SUPABASE_URL is not configured',
    });
    return;
  }

  if (!supabaseAnonKey) {
    res.status(500).json({
      error: 'AUTH_PROVIDER_MISCONFIGURED',
      message: 'SUPABASE_ANON_KEY is not configured',
    });
    return;
  }

  if (!authHeader) {
    res.status(401).json({
      error: 'AUTH_HEADER_MISSING',
      message: 'Missing Authorization header',
    });
    return;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    res.status(401).json({
      error: 'AUTH_SCHEME_INVALID',
      message: 'Invalid Authorization scheme. Expected Bearer token.',
    });
    return;
  }

  const token = bearerMatch[1]?.trim();
  if (!token) {
    res.status(401).json({
      error: 'AUTH_TOKEN_MISSING',
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
        apikey: supabaseAnonKey,
      },
      timeout: 10000,
    });

    const userId = data?.id as string | undefined;
    if (!userId) {
      res.status(401).json({
        error: 'AUTH_USER_RESOLUTION_FAILED',
        message: 'Unable to resolve user from access token',
      });
      return;
    }

    (req as any).userId = userId;
    next();
  } catch (err: any) {
    const providerStatus = err?.response?.status as number | undefined;

    if (providerStatus === 401 || providerStatus === 403) {
      res.status(401).json({
        error: 'AUTH_TOKEN_INVALID',
        message: 'Invalid or expired session',
      });
      return;
    }

    if (providerStatus && providerStatus >= 500) {
      res.status(503).json({
        error: 'AUTH_PROVIDER_UNAVAILABLE',
        message: 'Authentication provider is temporarily unavailable',
      });
      return;
    }

    if (err?.code === 'ECONNABORTED' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'AUTH_PROVIDER_UNREACHABLE',
        message: 'Authentication provider could not be reached',
      });
      return;
    }

    res.status(401).json({
      error: 'AUTH_VALIDATION_FAILED',
      message: 'Invalid or expired session',
    });
    return;
  }
};

