---
id: "006-init-scaffold"
change: 2026-07-fatia-4
req: [REQ-CFG-004]
status: done
evidence:
  commits: ["86c964643e7a6a4b995a7c5a25e902cdfbae70a3"]
---

## Objetivo

init — diretórios e template

## Escopo

`.specd/changes/archive/` em vez de `.specd/archive/`; template deriva as camadas de `VERIFY_LEVELS`; comentário da política reescrito para a regra vigente.

## Restrições

- A lista de camadas era terceira cópia à mão e foi ela que desatualizou
- `LAYER_ORDER` passa a derivar de `VERIFY_LEVELS`: uma lista só
- O texto do comentário não é gatilhável — registrado como dívida no proposal
