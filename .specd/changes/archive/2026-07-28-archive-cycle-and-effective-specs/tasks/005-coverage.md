---
id: "005-coverage"
change: 2026-07-28-archive-cycle-and-effective-specs
req: [REQ-VER-004]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Camada coverage

## Escopo

Requisito em ADDED ou MODIFIED sem task da própria change reprova.

## Restrições

- Referência é o campo `req`, e nada mais
- Task em qualquer status conta, inclusive `pending`
- REMOVED não exige task
