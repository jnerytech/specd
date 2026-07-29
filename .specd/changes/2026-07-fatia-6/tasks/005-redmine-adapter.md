---
id: "005-redmine-adapter"
change: 2026-07-fatia-6
req: [REQ-SYNC-008, REQ-SYNC-013]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

O único adaptador desta fatia, completo, escrito contra comportamento observado.

## Escopo

`src/sync/adapters/redmine.ts` implementa `BoardAdapter` sobre a REST API do Redmine, e `scanFilter` traduz um instante em filtro `updated_on`. `src/sync/adapters/index.ts` registra os adaptadores por nome.

## Restrições

- Credencial só de `board.token_env`, e falha antes de qualquer requisição
- Token nunca aparece em relatório, log ou erro
- `link` delega a `update` com `parent_issue_id` — é campo, não recurso
- `updated_on` só entra em filtro de varredura, nunca em decisão
- Campo simples vazio é `null` e multivalorado vazio é `[]` na leitura; multivalorado escreve array
