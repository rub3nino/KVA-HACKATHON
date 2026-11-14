# Decision brain

Un motore di decisione per processi assicurativi che sa **da dove viene** ogni regola,
**quale versione vale** alla data del caso e **quando due regole si contraddicono**.
Le decisioni sono deterministiche e spiegabili: l'azienda possiede la propria conoscenza
decisionale, invece di affittarla a un LLM.

Caso d'esempio: triage di un sinistro auto (liquidare, rifiutare, mandare a un liquidatore).
Tutti i dati sono sintetici.

## Struttura

```
engine/   motore (Zen + supersessione + contraddizioni), API HTTP, test
rules/    regole in formato JDM + registry.json con provenienza e validità
ui/       frontend Angular (viste Decisione / Perché / Regole)
docs/     contratto API e note
```

## Avvio

```bash
cd engine
npm install
npm test
npm start          # http://localhost:3000
```

```bash
curl -X POST localhost:3000/decide -H 'Content-Type: application/json' \
  -d '{"caso":{"importo":1000,"giorni_dalla_polizza":200,"denunce_precedenti":4,"testimoni":false,"data_caso":"2026-11-14"}}'
```

## Come funziona

1. **Provenienza.** Ogni regola in `rules/registry.json` ha `fonte` (documento, sezione, chi l'ha approvata).
2. **Supersessione.** Ogni regola vale in `[valida_da, superata_da)`. Per ogni `ambito` si esegue
   solo la versione valida alla `data_caso`. Le versioni superate vengono comunque eseguite e
   mostrate in `regole_superate`, così si vede cosa avrebbero deciso e quale regola le ha sostituite.
   Due versioni valide insieme nello stesso ambito sono un errore della memoria e vengono segnalate.
3. **Contraddizioni.** Se in ambiti diversi una regola approva e un'altra rifiuta lo stesso caso,
   l'esito è `da_rivedere` e la contraddizione riporta la provenienza di entrambe.
   Senza contraddizioni vince l'esito più prudente (rifiutato > da_rivedere > approvato).

Le tabelle in `rules/jdm/` si aprono e si modificano su [editor.gorules.io](https://editor.gorules.io).

## Strumenti e modelli AI usati

- Claude Code (Claude Opus 5.5) per scaffolding, motore e test.
- _(da completare durante l'evento)_

## Licenza

MIT. Vedi [LICENSE](LICENSE).
