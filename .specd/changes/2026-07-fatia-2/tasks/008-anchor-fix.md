---
id: "008-anchor-fix"
change: 2026-07-fatia-2
req: [REQ-ANC-008]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Comando anchor fix

## Escopo

Reescreve a âncora para a sugestão do resolver e deixa o arquivo unstaged.

## Restrições

- Sem sugestão o comando sai 2, não 1 — é recusa de agir, não veredito
- A reescrita é por linha, para não reformatar o que a pessoa escreveu
