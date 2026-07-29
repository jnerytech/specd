---
id: "003-config-template-contract"
change: 2026-07-28-orphan-guard-and-documented-formats
req: [REQ-CFG-011]
status: done
evidence:
  commits: ["079312f9d3acb19c3e1cb8d052bc45134835376f"]
---

## Objetivo

O template do `init` para de afirmar cobertura que não tem.

## Escopo

Teste que percorre `ConfigSchema` recursivamente e exige cada chave no texto do template. As seis ausentes hoje entram: `board.mapping.capability`, `board.mapping.collapse`, `board.mapping.closed_status`, `board.fields.constant`, `explore.sources.tool`, `explore.sources.arguments`.

## Restrições

- O teste lê `ConfigSchema`, nunca uma segunda lista à mão
- Chave comentada conta; o que se exige é existir no arquivo
- A falha nomeia as chaves ausentes
- Seções novas do `sync` ficam legíveis, com valor de exemplo e não só o nome
