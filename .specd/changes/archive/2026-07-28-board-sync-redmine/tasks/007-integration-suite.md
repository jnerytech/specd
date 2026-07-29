---
id: "007-integration-suite"
change: 2026-07-28-board-sync-redmine
req: [REQ-SYNC-005, REQ-SYNC-010, REQ-SYNC-011, REQ-SYNC-012, REQ-SYNC-013]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

Os critérios de aceite medidos contra o Redmine de verdade, não contra dublê.

## Escopo

`test/integration/redmine/*.test.ts` rodando por `npm run test:integration`, que sobe o container, semeia, roda e derruba. `vitest.config.ts` exclui `test/integration/`.

## Restrições

- `npm run verify` não sobe container — o gate não pode exigir Docker
- Criar, atualizar e rodar duas vezes sem duplicar
- Campo obrigatório omitido: mensagem do servidor repassada literal
- Multivalorado vazio e simples vazio produzem o mesmo hash
- `/custom_fields.json` inacessível com token de membro comum: recusa com diagnóstico
- Mudança dos dois lados: sai 2 e lista o conflito
- Reordenação de hierarquia move `updated_on` e não produz conflito
