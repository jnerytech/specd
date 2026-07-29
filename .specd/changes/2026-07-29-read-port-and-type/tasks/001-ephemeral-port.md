---
id: "001-ephemeral-port"
change: 2026-07-29-read-port-and-type
req: [REQ-READ-009, REQ-READ-005]
status: pending
evidence:
  commits: []
---

## Objetivo

Sem `--port`, o sistema operacional escolhe. Com `--port`, nada muda.

## Escopo

`DEFAULT_PORT = 4173` vira `EPHEMERAL_PORT = 0` em `src/read/server.ts`, e o
help do escopo `read` deixa de anunciar um número. `serveDocument` já resolve a
porta efetiva por `server.address()` — é o que os testes usam desde a primeira
change —, então a URL impressa já sai correta sem tocar em `index.ts`.

`EADDRINUSE` continua saindo 2 com a mesma mensagem: ele só é alcançável agora
por quem passou `--port`.

## Restrições

- Nenhum sorteio, nenhum intervalo, nenhuma retentativa: `listen(0)` e pronto
- `--port 0` continua sendo uma forma válida de pedir efêmera explicitamente
- Teste sobe duas instâncias ao mesmo tempo e afirma que as duas respondem em
  portas diferentes — é o caso que a change existe para destravar
- O texto do help não pode citar porta default, porque não há uma
