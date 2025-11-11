import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (dev mode)`);
});
