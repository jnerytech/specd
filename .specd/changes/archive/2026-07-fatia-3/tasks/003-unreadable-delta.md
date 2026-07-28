---
id: "003-unreadable-delta"
change: 2026-07-fatia-3
req: [REQ-FMT-009]
status: done
evidence:
  commits: ["e59b79667ba4edee66a3c32156868eaba95b88f8"]
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
