---
id: "004-field-binding"
change: 2026-07-fatia-6
req: [REQ-SYNC-009, REQ-SYNC-010]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

Resolver campo customizado por `id` e por `name`, e recusar quando não dá para verificar.

## Escopo

`src/sync/fields.ts` implementa `bindFields`; `src/sync/errors.ts` ganha `FieldDefinitionsUnavailableError`. Chaves novas de configuração: `[[board.fields]]` com `id`, `name`, `constant` e `from`.

## Restrições

- Só `id` resolve; só `name` resolve; ambos concordantes resolvem pelo `id`
- Divergência sai 2 mostrando configurado e reportado, sem escrever
- Definição inacessível sai 2 dizendo "não consegui verificar", citando o status
- Configuração sem campo declarado nunca consulta definição e nunca é bloqueada por isto
