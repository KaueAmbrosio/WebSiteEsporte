// server.js (exemplo simplificado)
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://api-externa-de-futebol/endpoint'; // substitua
const API_KEY = process.env.FOOTBALL_API_KEY;

let cached = { ts: 0, data: null, ttl: 60 * 5 * 1000 }; // cache 5 min

app.get('/api/matches', async (req, res) => {
    const now = Date.now();
    if (cached.data && now - cached.ts < cached.ttl) {
        return res.json(cached.data);
    }

    try {
        const r = await fetch(API_URL + '?competicao=id&dia=today', {
            headers: { 'X-Auth-Token': API_KEY }
        });
        const data = await r.json();
        cached = { ts: Date.now(), data, ttl: 5 * 60 * 1000 };
        return res.json(data);
    } catch (err) {
        console.error(err);
        if (cached.data) return res.json(cached.data); // degrade gracefully
        return res.status(500).json({ error: 'falha ao buscar dados' });
    }
});

app.use(express.static('public')); // serve seu site estático

app.listen(PORT, () => console.log('Server listening on', PORT));