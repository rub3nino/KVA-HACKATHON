import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrain, loadRegistry } from '../src/brain.js';

const rulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../rules');
const brain = createBrain(await loadRegistry(rulesDir));
const base = { importo: 4000, giorni_dalla_polizza: 200, denunce_precedenti: 0, testimoni: true };

test('prima del 12/11 vale R-03: 4.000 € viene approvato', async () => {
  const r = await brain.decide({ ...base, data_caso: '2026-11-01' });
  assert.equal(r.esito, 'approvato');
  assert.deepEqual(r.regole_coinvolte.sort(), ['C-01', 'R-03']);
  assert.equal(r.regole_superate.length, 0);
});

test('dal 12/11 R-07 supera R-03: lo stesso caso va rivisto', async () => {
  const r = await brain.decide({ ...base, data_caso: '2026-11-14' });
  assert.equal(r.esito, 'da_rivedere');
  assert.ok(r.regole_coinvolte.includes('R-07'));
  assert.ok(!r.regole_coinvolte.includes('R-03'));
  const vecchia = r.regole_superate.find((s) => s.regola === 'R-03');
  assert.equal(vecchia.sostituita_da, 'R-07');
  assert.equal(vecchia.esito_che_avrebbe_dato, 'approvato');
});

test('liquidazione approva e antifrode rifiuta: contraddizione con provenienza', async () => {
  const r = await brain.decide({
    ...base, importo: 1000, denunce_precedenti: 4, testimoni: false, data_caso: '2026-11-14',
  });
  assert.equal(r.esito, 'da_rivedere');
  assert.equal(r.contraddizioni.length, 1);
  const [c] = r.contraddizioni;
  assert.equal(c.regolaA.id, 'R-07');
  assert.equal(c.regolaB.id, 'C-01');
  assert.equal(c.regolaB.fonte.documento, 'Policy antifrode');
});

test('due versioni valide insieme nello stesso ambito vengono segnalate', async () => {
  const regole = await loadRegistry(rulesDir);
  const rotto = regole.map((r) => (r.id === 'R-03' ? { ...r, superata_da: null } : r));
  const r = await createBrain(rotto).decide({ ...base, data_caso: '2026-11-14' });
  assert.ok(r.contraddizioni.some((c) => c.motivo.includes('Due versioni valide')));
});
