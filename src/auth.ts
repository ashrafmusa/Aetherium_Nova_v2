import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getLogger } from './logger.js';

const logger = getLogger();

if (!process.env.API_KEY) {
    logger.error('[Auth] FATAL: API_KEY environment variable is not set. Refusing to start.');
    process.exit(1);
}

const API_KEY_BUF = Buffer.from(process.env.API_KEY as string);

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
    const providedKey = req.headers['x-api-key'];

    if (!providedKey) {
        logger.warn('[Auth] Access denied. No API key provided.');
        return res.status(401).json({ error: 'API key is required.' });
    }

    const providedBuf = Buffer.from(String(providedKey));

    // Constant-time comparison prevents timing side-channel attacks
    if (
        providedBuf.length !== API_KEY_BUF.length ||
        !crypto.timingSafeEqual(providedBuf, API_KEY_BUF)
    ) {
        logger.warn('[Auth] Access denied. Invalid API key provided.');
        return res.status(403).json({ error: 'Invalid API key.' });
    }

    next();
}