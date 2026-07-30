---
id: "001-statements"
change: 2026-07-30-weak-statements
req: [REQ-EFF-003, REQ-EFF-004, REQ-SKL-001, REQ-SKL-003, REQ-SKL-004, REQ-SKL-005, REQ-SKL-006]
status: pending
evidence:
  commits: []
---

## Objetivo

Fazer o repositório sustentar os enunciados reescritos.

## Escopo

Dois testes novos em `test/init/skills.test.ts`: o critério de caminho que sobe
de diretório, que antes não tinha teste, e a verificação de que cada `SKILL.md`
empacotado existe — o que dá corpo às âncoras múltiplas de REQ-SKL-001.

`test/spec/exit-contract.test.ts` já tem `reaches no network module` e
`spec informs and never judges`; nenhum dos dois muda. O critério de requisito
sem critério de aceite, que REQ-EFF-003 passa a nomear, já é exercitado ali.

Nenhuma mudança em código de produção: os seis são enunciado e âncora.

## Restrições

- Âncora nova precisa resolver, senão o archive recusa por REQ-ANC-007
- Nada de fabricar reescrita durante o apply para exercitar o critério c1 de
  REQ-SKL-008
- Achado 3 continua fora

## Critérios

Os de REQ-SKL-001 e REQ-EFF-004 que ainda não têm teste. Os demais já têm, e a
reescrita não muda o que eles verificam.
