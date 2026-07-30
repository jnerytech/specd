---
id: "007-sandbox-runs"
change: 2026-07-29-cycle-skills
req: [REQ-SKL-004, REQ-SKL-005, REQ-SKL-006]
status: done
evidence:
  commits: ["38df4ef084759fe9608f36f73e560a2d95960852"]
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

## Resultado

As três rodadas correram contra `sandbox/runs/011/target`, `012/target` e
`013/target`, alvo Node sintético que as skills não conheciam. Registros em
`sandbox/runs/011-cycle-skills-sem-board.md`,
`012-cycle-skills-com-board.md` e `013-cycle-skills-hostil.md`; índice e
pendências em `sandbox/RELATORIO.md`.

O ciclo fecha nos dois modos, e nada degradou na rodada hostil: `explore` com
source obrigatória, `sync` e `archive --sync` saem 2 contra board inalcançável, e
o archive fica de pé com o board atrás. A transição para status não fechado foi
medida contra o Redmine do container, com releitura, e virou teste de integração.

Quatro achados foram registrados sem conserto, porque três deles são decisão de
desenho e um é custo de adoção declarado: `sync` quebrando na etapa de propose
quando a change cria capability nova, `archive` não rodando `provenance` nem
`schema`, `explore` dizendo `usable` sem source declarada contra board fora do ar,
e `card = "required"` ligando junto com o board.
