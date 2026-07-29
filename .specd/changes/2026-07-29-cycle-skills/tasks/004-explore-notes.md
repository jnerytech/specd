---
id: "004-explore-notes"
change: 2026-07-29-cycle-skills
req: [REQ-EXP-010, REQ-EXP-011]
status: pending
evidence:
  commits: []
---

## Objetivo

Dar endereço à prosa da exploração dentro do diretório que o bundle já ocupa, e
recusar coletar o card errado.

## Escopo

`src/explore/paths.ts` ganha `NOTES_FILE`. `src/explore/index.ts` preserva o
arquivo ao reescrever o bundle e não o inclui no manifest.

`src/explore/card-ref.ts` ganha `assertCardMatchesChange`, chamada depois de
`parseCardRef` e antes de qualquer requisição: se a change declara `card` e o
argumento nomeia outro, sai 2 citando os dois.

## Restrições

- O comando não cria nem edita `notes.md`. Quem escreve é a skill
- O comando não escreve `card` na frontmatter da change. Duas escritas de fontes
  diferentes no mesmo campo é como se produz o conflito que se quer evitar
- Comparação de card considera identificador e URL: o mesmo card citado das duas
  formas não é conflito
- A verificação acontece antes da rede. Recusar depois de coletar já pagou o
  custo que a recusa existe para evitar

## Critérios

Os de REQ-EXP-010 e REQ-EXP-011. Rodar `explore` duas vezes com `notes.md`
presente e conferir byte a byte que ele não mudou.
