---
id: "002-fixtures"
change: 2026-07-30-archive-preconditions
req: [REQ-ARC-002]
status: done
evidence:
  commits: ["369a5209afa769dae6b607ee0f3d6cff880c106c"]
---

## Objetivo

Corrigir as fixtures que passavam por causa do buraco.

## Escopo

As seis chamadas a `archive()` em `test/integration/redmine/archive-sync.test.ts`
montam projeto sem `proposal.md` num config que declara `[board] provider` —
onde `card` é obrigatório por default (REQ-CFG-012). Ganham `proposal.md` com
`card`, como já faz `archive-transition.test.ts`.

## Restrições

- Não é regressão e não se conserta afrouxando o gate: as fixtures descreviam um
  estado que o gate deste repositório já reprova
- A suíte de integração é a que precisa de Docker; roda por
  `npm run test:integration`, nunca pelo `npm run verify`

## Critérios

Suíte de integração verde com as pré-condições novas em vigor.
