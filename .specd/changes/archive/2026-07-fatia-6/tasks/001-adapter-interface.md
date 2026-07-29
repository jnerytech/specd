---
id: "001-adapter-interface"
change: 2026-07-fatia-6
req: [REQ-SYNC-002, REQ-SYNC-011]
status: done
evidence:
  commits: ["0ceef9745d9615396898742426aa72444993e146"]
---

## Objetivo

A superfície de acoplamento inteira: o que o núcleo do `sync` pode pedir a um board.

## Escopo

`src/sync/adapter.ts` declara `BoardAdapter` com quatro escritas (`create`, `update`, `link`, `close`) e duas leituras (`read`, `describeFields`), mais os tipos de item, patch e snapshot. `src/sync/errors.ts` declara `BoardRefusedError`, que carrega status HTTP, mensagem literal do servidor e o identificador local.

## Restrições

- Nenhum tipo aqui nomeia fornecedor, endpoint ou verbo HTTP
- `BoardRefusedError` não interpreta a mensagem: sem parse, sem tradução, sem classificação
- Status HTTP é reportado à parte porque é estruturado; a mensagem não é
- O núcleo importa só desta interface, nunca de `src/sync/adapters/`
