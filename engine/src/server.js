import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrain, isValidAt, loadRegistry } from './brain.js';

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../rules');
const brain = createBrain(await loadRegistry(rulesDir));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/decide', async (req, res) => {
  const caso = req.body?.caso;
  if (!caso || typeof caso !== 'object') return res.status(400).json({ errore: 'Manca "caso" nel body' });
  try {
    res.json(await brain.decide(caso));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

app.get('/rules', (req, res) => {
  const oggi = req.query.data ?? new Date().toISOString().slice(0, 10);
  res.json(
    brain.regole.map(({ jdm, ...r }) => ({ ...r, stato: isValidAt(r, oggi) ? 'attiva' : 'superata' })),
  );
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`decision brain su http://localhost:${port}`));
