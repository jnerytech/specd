---
id: "006-skills-content"
change: 2026-07-29-cycle-skills
req: [REQ-SKL-004, REQ-SKL-005, REQ-SKL-006]
status: done
evidence:
  commits: ["985f12bfbdaffada8a78393ff403b8b6fcff509c"]
---

## Objetivo

Escrever as quatro skills do ciclo.

## Escopo

`skills/specd-explore/`, `skills/specd-propose/`, `skills/specd-apply-change/`
e `skills/specd-archive-change/`.

Divisão de escrita, que é o que separa uma skill da seguinte:

| | código | delta | `.specd/specs/` | board | `explore/notes.md` |
| --- | --- | --- | --- | --- | --- |
| explore | lê | lê | lê | lê | escreve |
| propose | lê | escreve | lê | escreve | lê |
| apply | escreve | escreve | — | — | — |
| archive | — | consome | escreve | escreve | — |

`explore` abre a change: cria o diretório, escreve `proposal.md` com a
frontmatter — incluindo `card`, onde ele é exigido — e `explore/notes.md`,
depois roda `specd explore <card> --change <name>`.

`propose` escreve `delta.md` e, havendo board, mostra `specd sync --dry-run`,
pede confirmação e roda `specd sync`. O sync reconcilia a spec efetiva inteira,
então o plano exibido pode conter itens de outras changes abertas, e a skill diz
isso em vez de esconder.

`apply` implementa, atualiza o delta com o que a execução descobriu, roda o gate
e reporta o veredito dele.

`archive` confere gate verde, anuncia a escrita e roda
`specd archive <change> --sync`.

## Restrições

- A spec efetiva vem de `specd spec --json`. Nenhuma skill reconstrói overlay
- Ponto de decisão vira pergunta pela ferramenta do host, com opções
- Board configurado e inalcançável para a skill. Nunca vira modo sem board
- Nenhum documento gerado carrega contagem de requisitos, capabilities ou
  testes; a fonte é `specd status`
- REQ-ID citado só depois de conferido no repositório
- Princípio citado pelo nome, nunca por sigla
- As três superfícies de prosa da change têm donos distintos: `proposal.md` é o
  argumento, `explore/notes.md` é o registro da exploração, `memory/` é
  rascunho descartável com limite de linhas

## Critérios

Os de REQ-SKL-004, REQ-SKL-005 e REQ-SKL-006, verificados sobre o texto de cada
`SKILL.md`.
