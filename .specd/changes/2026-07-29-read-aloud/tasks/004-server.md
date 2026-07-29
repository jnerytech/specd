---
id: "004-server"
change: 2026-07-29-read-aloud
req: [REQ-READ-005]
status: done
evidence:
  commits: ["1e768d65ed20731b623c33b9367f25ac2b749393"]
---

## Objetivo

Servir o documento no loopback, de memória, e sair limpo no Ctrl-C.

## Escopo

`src/read/server.ts` com `serveDocument(html, { port })` sobre `node:http`.
Uma rota: `GET /` devolve o HTML que veio pronto por argumento. Qualquer outro
caminho é 404 de corpo fixo. `listen(port, "127.0.0.1")`. `EADDRINUSE` vira erro
operacional nomeando a porta e `--port`. `SIGINT` fecha o servidor e encerra.

## Restrições

- O endereço `127.0.0.1` é literal no `listen`, e há teste que falha se ele
  mudar — a diferença para `0.0.0.0` é invisível na tela e publica repositório
  privado na rede local
- Nenhuma leitura de disco dentro do handler: o HTML chega pronto e o servidor
  não conhece caminho de arquivo. É o que torna travessia impossível por
  construção
- Nenhum cliente HTTP é importado aqui; o servidor não fala com ninguém de fora
- Teste sobe em porta efêmera, faz a requisição e derruba — não deixa processo
  nem porta presa entre testes
