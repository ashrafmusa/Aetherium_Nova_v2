import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';

// ── Web Crypto / TextEncoder polyfills (required by @noble/post-quantum) ─────
if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as any).TextEncoder = TextEncoder;
    (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    (globalThis as any).crypto = webcrypto;
}

// ── Canvas mock (jsdom does not implement HTMLCanvasElement.getContext) ──────
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    canvas: { width: 800, height: 600 },
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// ── Fetch mock (App tries to hit localhost:3001 on mount) ────────────────────
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
    })
) as jest.Mock;

// ── Silence expected console.error noise in test output ─────────────────────
const originalError = console.error.bind(console);
beforeAll(() => {
    console.error = (...args: unknown[]) => {
        const msg = args[0]?.toString() ?? '';
        // Suppress known jsdom / React noise
        if (
            msg.includes('Not implemented') ||
            msg.includes('AggregateError') ||
            msg.includes('Failed to fetch') ||
            msg.includes('Error syncing') ||
            msg.includes('act(')
        ) return;
        originalError(...args);
    };
});
afterAll(() => {
    console.error = originalError;
});
