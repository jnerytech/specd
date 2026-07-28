---
id: 008-explore-collectors
change: 2026-07-fatia-1
req: [REQ-EXP-001, REQ-EXP-002, REQ-EXP-003, REQ-EXP-004, REQ-EXP-005, REQ-EXP-006]
status: done
evidence:
  commits: []
---

## Objetivo

Coleta multi-fonte com manifest, redaction antes da persistência e bloqueio por fonte obrigatória.

## Escopo

Mapa de coletores para board, git, mcp e http; parsing de card por id ou URL; escrita do bundle; manifest com status por fonte.

## Restrições

- Redaction ocorre antes da escrita, nunca depois
- Manifest é gravado mesmo quando o comando falha
- Falha em fonte obrigatória sai com código diferente de zero

## Done when

- Teste cobre fonte obrigatória falhando e opcional falhando
- Teste prova que campo em `redact` não aparece no arquivo persistido
- Bundle fica dentro do diretório da change, rastreado pelo git
