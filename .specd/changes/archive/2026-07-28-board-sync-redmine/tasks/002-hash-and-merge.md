---
id: "002-hash-and-merge"
change: 2026-07-28-board-sync-redmine
req: [REQ-SYNC-003, REQ-SYNC-004, REQ-SYNC-005]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

A decisão: o que mudou, de que lado, e quando isso é conflito.

## Escopo

`src/sync/hash.ts` normaliza a projeção e calcula o `synced_hash`. `src/sync/merge.ts` declara `FIELD_OWNERSHIP` e implementa `mergeThreeWay` sobre `base`, `ours` e `theirs`.

## Restrições

- `null`, `[]` e `""` normalizam todos para ausente, antes do hash
- Ordem de chaves não afeta o hash; ordem de valores multivalorados afeta, porque é conteúdo
- Conflito é só "os dois lados mudaram para valores diferentes"
- Conflito não escreve nada, nem para os itens sem conflito
- `restored` é resultado próprio, distinto de `updated`
