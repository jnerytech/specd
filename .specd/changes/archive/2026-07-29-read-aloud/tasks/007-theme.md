---
id: "007-theme"
change: 2026-07-29-read-aloud
req: [REQ-READ-008]
status: done
evidence:
  commits: ["775513ef11d72cd694ebc329e70b7e21cf3918f9"]
---

## Objetivo

Deixar quem lê escolher claro ou escuro, sem script e sem recarregar.

## Escopo

`themeControl` em `src/read/document.ts`: três rádios — auto, claro, escuro —
no cabeçalho, com `auto` marcado. As cores saem de custom properties definidas
em `:root`, sobrescritas por `prefers-color-scheme` e depois por
`body:has(#theme-light:checked)` e `body:has(#theme-dark:checked)`.

`color-scheme` acompanha a escolha, para que o próprio controle e a barra de
rolagem não fiquem no tema oposto ao do texto.

## Restrições

- Zero JavaScript: a troca é estado de formulário mais seletor CSS
- O controle fica no cabeçalho, fora das `section`, então não entra na contagem
  de palavras nem se repete por arquivo
- A ordem de precedência é sistema, depois escolha explícita — nunca o inverso
- Determinismo de REQ-READ-003 continua valendo: a marcação do controle é fixa
  e não depende de ambiente
