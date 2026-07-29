---
id: "002-delta-parser"
change: 2026-07-28-archive-cycle-and-effective-specs
req: [REQ-FMT-005, REQ-FMT-006]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Parser de delta

## Escopo

Três seções, blocos de requisito completos em ADDED e MODIFIED, identificadores puros em REMOVED.

## Restrições

- O bloco no delta tem a mesma forma do bloco em capability, então `parseRequirement` é reusado sem parâmetro
- `**Capability.**` é obrigatório em ADDED e opcional em MODIFIED
- Seção fora das três reprova
