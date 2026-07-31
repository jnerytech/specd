---
id: "002-propose-always-records"
change: 2026-07-31-mark-enforced
req: [REQ-SKL-009]
status: done
evidence:
  commits: ["18e4015bb52fdee67024306361d51885f3dd7bb0"]
---

## Objetivo

Tirar da skill o caso especial que criava o furo.

## Escopo

`skills/specd-propose/SKILL.md` passa a mandar rodar `propose-record` sempre,
inclusive quando o delta só remove — e diz por que o registro vazio importa.

`test/skills/content.test.ts` acompanha.

## Restrições

- O texto não pode sugerir que a skill decida quando gravar: é sempre
- A explicação do caso só-`REMOVED` fica curta; o porquê longo mora no requisito

## Critérios

Os de REQ-SKL-009 que falam do caso sempre, verificados sobre o texto do
`SKILL.md`.
