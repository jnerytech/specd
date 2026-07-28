---
id: "003-unreadable-delta"
change: 2026-07-fatia-3
req: [REQ-FMT-009]
status: pending
evidence:
  commits: []
---

## Objetivo

Delta ilegível reprova em vez de passar por vazio

## Escopo

`assertSectionReadable` distingue seção legitimamente vazia de seção com conteúdo que o parser não entende.

## Restrições

- Seção com conteúdo e nenhum bloco de requisito reprova
- Item de lista citando identificador fora de bloco reprova: é manifesto no formato antigo
- Seção vazia e marcador explícito de vazio continuam aceitos
- É o modo de falha que arquivou a Fatia 1 sem verificar coisa alguma
