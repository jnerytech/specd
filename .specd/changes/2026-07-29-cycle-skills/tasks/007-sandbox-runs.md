---
id: "007-sandbox-runs"
change: 2026-07-29-cycle-skills
req: [REQ-SKL-004, REQ-SKL-005, REQ-SKL-006]
status: pending
evidence:
  commits: []
---

## Objetivo

Rodar o ciclo inteiro contra repositório que as skills não conhecem, nos três
modos, e registrar o que quebrar.

## Escopo

Três rodadas em `sandbox/runs/`, registro imutável por rodada, `RELATORIO.md`
mutável como índice contendo só pendências abertas.

- **com board:** card real, `board.card = "required"`, ciclo `explore → propose
  → apply → archive` até a transição de status acontecer e ser relida
- **sem board:** repositório sem `[board]`, o mesmo ciclo, provando que os
  passos de board somem em vez de falharem
- **hostil:** board configurado e indisponível — credencial errada, host
  inalcançável, card inexistente. As três param, e nenhuma delas segue como se
  não houvesse board

## Restrições

- Repositório alvo não pode ser este. Todos os defeitos relevantes do specd
  apareceram rodando contra algo que a ferramenta não tinha visto, e nenhum
  apareceu em teste unitário
- A rodada hostil é a que decide. As outras duas confirmam o caminho feliz, que
  é o que menos falha
- Achado vira delta desta change enquanto ela estiver aberta, não issue na
  cabeça de quem rodou

## Critérios

Os de REQ-SKL-004, REQ-SKL-005 e REQ-SKL-006 observados em execução, não em
leitura do texto da skill.
