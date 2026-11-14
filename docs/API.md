# Contratto API

Base URL in sviluppo: `http://localhost:3000` (CORS aperto).

## POST /decide

Body:

```json
{
  "caso": {
    "importo": 1000,
    "giorni_dalla_polizza": 200,
    "denunce_precedenti": 4,
    "testimoni": false,
    "data_caso": "2026-11-14"
  }
}
```

`data_caso` è facoltativa (default: oggi) e decide quali versioni delle regole valgono.

Risposta:

```ts
type Esito = 'approvato' | 'rifiutato' | 'da_rivedere';
interface Fonte { documento: string; sezione: string; approvata_da: string }

interface Decisione {
  esito: Esito;
  data_caso: string;
  catena_spiegazione: {
    regola: string; versione: number; ambito: string; valida_da: string;
    fonte: Fonte; esito: Esito; nota: string; supera: string | null;
  }[];
  regole_superate: {
    regola: string; versione: number; superata_da: string;
    sostituita_da: string | null; esito_che_avrebbe_dato: Esito; nota: string;
  }[];
  regole_coinvolte: string[];
  contraddizioni: {
    regolaA: { id: string; versione: number; fonte: Fonte };
    regolaB: { id: string; versione: number; fonte: Fonte };
    motivo: string;
  }[];
}
```

## GET /rules?data=YYYY-MM-DD

Elenco delle regole del registry con `stato: "attiva" | "superata"` alla data indicata (default: oggi).

## Casi demo

| Caso | data_caso | Esito | Cosa mostra |
|---|---|---|---|
| importo 4000, polizza 200 gg, 0 denunce | 2026-11-01 | approvato | vale R-03 |
| stesso caso | 2026-11-14 | da_rivedere | R-07 ha superato R-03, che avrebbe approvato |
| importo 1000, 4 denunce, nessun testimone | 2026-11-14 | da_rivedere | R-07 approva, C-01 rifiuta: contraddizione |
