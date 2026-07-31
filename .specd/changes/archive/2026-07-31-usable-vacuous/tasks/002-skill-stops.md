---
id: "002-skill-stops"
change: 2026-07-31-usable-vacuous
req: [REQ-SKL-010]
status: done
evidence:
  commits: ["64acf9c61b2c10b1ccdbbb6215c0876a7ac3fd24"]
---

## Objetivo

Fazer a skill parar onde o comando não pode parar.

## Escopo

`skills/specd-explore/SKILL.md` passa a ler o estado de coleta depois de rodar
`specd explore`, e a parar quando há board configurado e o bundle coletou `none`.

`test/skills/content.test.ts` ganha o teste de conteúdo.

## Restrições

- A parada não depende do código de saída: com fonte opcional, o comando sai 0
- Sem board, `none` não para nada
- A skill nomeia o que falta e pergunta; não declara fonte por conta própria

## Critérios

Os de REQ-SKL-010, verificados sobre o texto do `SKILL.md`.
