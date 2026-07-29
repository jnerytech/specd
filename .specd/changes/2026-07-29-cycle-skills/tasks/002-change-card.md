---
id: "002-change-card"
change: 2026-07-29-cycle-skills
req: [REQ-CFG-012, REQ-FMT-011]
status: pending
evidence:
  commits: []
---

## Objetivo

Dar à change uma identidade externa declarada, e ao repositório o botão que diz
se ela é obrigatória.

## Escopo

`src/config/schema.ts` ganha `BOARD_CARD_MODES` e o campo `board.card`, com
default `required` aplicado só quando há board configurado. Template do `init`
documenta a chave, por REQ-CFG-011.

`src/parser/change.ts` — arquivo novo — lê a frontmatter de `proposal.md` com
`ChangeFrontmatterSchema`: `change`, `status` e `card` opcional com `ref` e
`url`. A camada `schema` do gate passa a validar a frontmatter da change, que
hoje não é lida por ninguém.

## Restrições

- Repositório sem `[board]` continua passando sem nenhuma declaração nova. As
  changes arquivadas deste repositório não têm `card` e não podem passar a
  reprovar
- `card` meio escrito — `ref` sem `url` ou o contrário — reprova. Ligação pela
  metade não é ligação, é a mesma regra de `readBoardLinks`
- O parser não escreve `card`. Descobrir o card é trabalho da skill de explore

## Critérios

Os de REQ-CFG-012 e REQ-FMT-011. Mais um teste de regressão sobre as changes
arquivadas do próprio repositório: nenhuma passa a reprovar.
