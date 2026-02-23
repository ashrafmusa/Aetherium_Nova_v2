import app from './app.js';
import supertest from 'supertest';

describe('Simple Test', () => {
    it('should return 200', async () => {
        await supertest(app).get('/status').expect(200);
    });
});