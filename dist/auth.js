import logger from './logger.js';
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    logger.error('[Auth] CRITICAL: API_KEY environment variable is not set. API authentication will fail.');
}
export function apiKeyAuth(req, res, next) {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey) {
        logger.warn('[Auth] Access denied. No API key provided.');
        return res.status(401).json({ error: 'API key is required.' });
    }
    if (String(providedKey) !== API_KEY) {
        logger.warn('[Auth] Access denied. Invalid API key provided.');
        return res.status(403).json({ error: 'Invalid API key.' });
    }
    next();
}
