import express from 'express';
// import { getBlockchain } from './chain';
// import { node } from './node.js';
import { p2p } from './services/p2p.js';

const app = express();

app.get('/status', (req, res) => {
    res.json({
        height: 0, // getBlockchain().length,
        peers: p2p.getPeers().length,
        mempool: 0 // node.mempool.getPool().length
    });
});

export default app;