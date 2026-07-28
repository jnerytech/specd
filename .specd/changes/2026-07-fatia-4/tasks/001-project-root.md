---
id: "001-project-root"
change: 2026-07-fatia-4
req: [REQ-CFG-010, REQ-ANC-001]
status: pending
evidence:
  commits: []
---

## Objetivo

Raiz do projeto

## Escopo

`findProjectRoot` sobe do cwd até achar `.specd/`. Todo comando que opera sobre projeto existente passa a resolver por ele; `init` é a exceção, porque cria o projeto.

## Restrições

- Não é o cwd e não é o toplevel do git — eram as duas definições concorrentes
- Não depende de git existir nem de a árvore ser ignorada por um repositório pai
- Ausência de `.specd/` em qualquer ancestral sai 2, por P8
