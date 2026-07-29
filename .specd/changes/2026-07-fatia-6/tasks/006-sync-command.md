---
id: "006-sync-command"
change: 2026-07-fatia-6
req: [REQ-SYNC-001, REQ-SYNC-012]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

O comando, e a garantia de que rodar duas vezes não faz nada na segunda.

## Escopo

`src/sync/index.ts` com `sync` e `planActions`, registro em `src/cli/index.ts`, entrada na USAGE. Teste de arquitetura provando que nada alcançável a partir de `src/hooks/run.ts` importa `src/sync/`.

## Restrições

- Falha sai 2, nunca 1
- Nenhum evento de hook invoca `sync`
- `planActions` é puro: recebe estado, devolve ações, não escreve
- Sem mudança não emite escrita e não reescreve `synced_at`
- Relatório distingue `created`, `updated`, `restored`, `unchanged` e `conflict`
