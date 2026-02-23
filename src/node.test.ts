import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from './app.js';

describe('GET /status', () => {
    it('should return the status of the node', async () => {
        const response = await request(app).get('/status');

        // This assertion will likely fail, which is expected.
        // We are checking for environment errors, not logic errors.
        expect(response.status).toBe(200);
    });
});