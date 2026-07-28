---
id: "004-schema-effective"
change: 2026-07-fatia-2
req: [REQ-FMT-004]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Camada schema sobre a spec efetiva

## Escopo

A camada passa a ler os deltas das changes abertas, não só as capabilities, e ganha `checkRetiredReuse`.

## Restrições

- Requisito de delta reusando ID aposentado reprova
- Sem isto o gate ficaria verde por não estar olhando
