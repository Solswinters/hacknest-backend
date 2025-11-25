import { Injectable, NestMiddleware } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Enforce HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none';"
    );

    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    // Remove powered-by header
    res.removeHeader('X-Powered-By');

    next();
  }
}

