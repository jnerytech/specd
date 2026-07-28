---
id: 009-init-and-status
change: 2026-07-fatia-1
req: [REQ-CFG-004, REQ-CFG-005, REQ-CFG-006, REQ-CLI-006]
status: pending
evidence:
  commits: []
---

## Objetivo

Bootstrap do projeto e relatório de situação.

## Escopo

`init` detectando stack e escrevendo config completo com comentários, entradas de `.gitattributes`, e `status` reportando drift e pendências.

## Restrições

- Config gerado não é esqueleto vazio
- `verify` roda sem erro de configuração logo após `init`
- `status` sempre retorna código 0

## Done when

- `init` em repositório Node propõe comando de teste coerente
- `status` agrupa saída por change ativa
- Pacote escopado expõe bin `specd`
