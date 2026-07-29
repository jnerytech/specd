---
id: 003-spec-parser
change: 2026-07-28-verify-gate-and-anchor-ladder
req: [REQ-FMT-001, REQ-FMT-002, REQ-FMT-003, REQ-FMT-008]
status: done
evidence:
  commits: [9cadaab55d3b86d8dec75cd47e78676a6040c401]
---

## Objetivo

Parser de capability: frontmatter, requisitos como seções de nível 3, blocos de âncora.

## Escopo

Leitura de `.specd/specs/*.md`, extração de frontmatter, quebra em requisitos, parsing do bloco `yaml anchors`.

## Restrições

- ID fora do padrão reprova com mensagem citando o padrão esperado
- Campo `status` em requisito reprova
- Bloco de âncora fora de requisito gera warning, não erro

## Done when

- Parser lê as sete capabilities deste próprio repositório sem erro
- Teste cobre ID inválido, status indevido e âncora malformada
