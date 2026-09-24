import { Router, Request, Response } from 'express';
import { AuthService, COOKIE_NAME } from '../auth/authService.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

export const adminAuthRouter = Router();

const isProduction = process.env.NODE_ENV === 'production';

// Helper for client IP
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * POST /api/admin/auth/login
 */
adminAuthRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required.' },
      });
      return;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const { user, token } = await AuthService.login({
      email,
      password,
      ipAddress,
      userAgent,
    });

    // Set secure HttpOnly session cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      user,
      token, // Also return token in body for programmatic or API clients
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: err.message || 'Authentication failed.' },
    });
  }
});

/**
 * POST /api/admin/auth/logout
 */
adminAuthRouter.post('/logout', (req: Request, res: Response) => {
  const token = req.adminToken;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  if (token) {
    AuthService.logout(token, ipAddress, userAgent);
  }

  // Clear cookie
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });

  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/admin/auth/me
 */
adminAuthRouter.get('/me', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.adminUser,
  });
});
