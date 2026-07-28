---
id: "001-provenance"
change: 2026-07-fatia-3
req: [REQ-VER-003]
status: done
evidence:
  commits: ["e59b79667ba4edee66a3c32156868eaba95b88f8"]
---

## Objetivo

Camada provenance com condição de guarda

## Escopo

A camada só exige `explore/manifest.json` quando a configuração declara ao menos uma fonte `required`. Reativada em `verify.levels`.

## Restrições

- Projeto que não declarou fonte obrigatória não pediu procedência nenhuma
- Fonte required com status diferente de `ok` reprova e é nomeada
- `draft.md` nunca é lido aqui, por REQ-EXP-007
