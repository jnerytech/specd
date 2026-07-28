---
id: "006-init-scaffold"
change: 2026-07-fatia-4
req: [REQ-CFG-004]
status: pending
evidence:
  commits: []
---

## Objetivo

init — diretórios e template

## Escopo

`.specd/changes/archive/` em vez de `.specd/archive/`; template deriva as camadas de `VERIFY_LEVELS`; comentário da política reescrito para a regra vigente.

## Restrições

- A lista de camadas era terceira cópia à mão e foi ela que desatualizou
- `LAYER_ORDER` passa a derivar de `VERIFY_LEVELS`: uma lista só
- O texto do comentário não é gatilhável — registrado como dívida no proposal
