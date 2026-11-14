// Decision brain: sceglie le regole valide alla data del caso, le esegue con Zen,
// costruisce la catena di spiegazione e segnala le contraddizioni.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ZenEngine } from '@gorules/zen-engine';

const ESITI = ['approvato', 'rifiutato', 'da_rivedere'];

export async function loadRegistry(rulesDir) {
  const raw = JSON.parse(await readFile(path.join(rulesDir, 'registry.json'), 'utf8'));
  const regole = await Promise.all(
    raw.regole.map(async (r) => ({
      ...r,
      jdm: await readFile(path.join(rulesDir, r.file)),
    })),
  );
  return regole;
}

// Una regola vale nell'intervallo [valida_da, superata_da). Date ISO (YYYY-MM-DD) si confrontano come stringhe.
export function isValidAt(regola, data) {
  return regola.valida_da <= data && (regola.superata_da == null || data < regola.superata_da);
}

export function createBrain(regole) {
  const engine = new ZenEngine();
  const decisions = new Map(regole.map((r) => [r.id, engine.createDecision(r.jdm)]));

  async function run(regola, caso) {
    const { result, trace } = await decisions.get(regola.id).evaluate(caso, { trace: true });
    const step = Object.values(trace).find((t) => t.traceData?.rule);
    const riga = step?.traceData?.rule ?? {};
    if (!ESITI.includes(result.esito)) {
      throw new Error(`La regola ${regola.id} ha restituito un esito non valido: ${result.esito}`);
    }
    return { esito: result.esito, riga: riga._id ?? null, nota: riga._description ?? '' };
  }

  async function decide(caso) {
    const data = caso.data_caso ?? new Date().toISOString().slice(0, 10);
    const attive = regole.filter((r) => isValidAt(r, data));
    const contraddizioni = [];

    // Integrità della memoria: in un ambito deve valere una sola versione alla volta.
    const perAmbito = Map.groupBy(attive, (r) => r.ambito);
    for (const [ambito, versioni] of perAmbito) {
      for (let i = 1; i < versioni.length; i++) {
        contraddizioni.push({
          regolaA: ref(versioni[0]),
          regolaB: ref(versioni[i]),
          motivo: `Due versioni valide insieme per l'ambito "${ambito}" alla data ${data}`,
        });
      }
    }

    const catena = [];
    for (const r of attive) {
      const out = await run(r, caso);
      catena.push({
        regola: r.id,
        versione: r.versione,
        ambito: r.ambito,
        valida_da: r.valida_da,
        fonte: r.fonte,
        esito: out.esito,
        nota: out.nota,
        supera: r.supera,
      });
    }

    // Cosa avrebbero deciso le versioni superate: mostra perché la regola nuova "ha battuto" la vecchia.
    const superate = [];
    for (const r of regole.filter((r) => r.superata_da != null && r.superata_da <= data)) {
      const out = await run(r, caso);
      const successore = regole.find((s) => s.supera === r.id);
      superate.push({
        regola: r.id,
        versione: r.versione,
        superata_da: r.superata_da,
        sostituita_da: successore?.id ?? null,
        esito_che_avrebbe_dato: out.esito,
        nota: out.nota,
      });
    }

    // Contraddizioni tra ambiti: una regola approva, un'altra rifiuta lo stesso caso.
    for (const a of catena) {
      for (const b of catena) {
        if (a.esito === 'approvato' && b.esito === 'rifiutato') {
          contraddizioni.push({
            regolaA: { id: a.regola, versione: a.versione, fonte: a.fonte },
            regolaB: { id: b.regola, versione: b.versione, fonte: b.fonte },
            motivo: `${a.regola} approva, ${b.regola} rifiuta lo stesso caso`,
          });
        }
      }
    }

    return {
      esito: aggrega(catena, contraddizioni),
      data_caso: data,
      catena_spiegazione: catena,
      regole_superate: superate,
      regole_coinvolte: attive.map((r) => r.id),
      contraddizioni,
    };
  }

  return { decide, regole };
}

// Con una contraddizione decide un umano. Altrimenti vince l'esito più prudente.
function aggrega(catena, contraddizioni) {
  if (contraddizioni.length > 0) return 'da_rivedere';
  const esiti = catena.map((c) => c.esito);
  if (esiti.includes('rifiutato')) return 'rifiutato';
  if (esiti.includes('da_rivedere') || esiti.length === 0) return 'da_rivedere';
  return 'approvato';
}

function ref(r) {
  return { id: r.id, versione: r.versione, fonte: r.fonte };
}
