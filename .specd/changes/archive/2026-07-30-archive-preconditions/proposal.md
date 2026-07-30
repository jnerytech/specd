---
change: 2026-07-30-archive-preconditions
status: active
---

# archive-preconditions — o archive checa o que o gate checa

## Por quê

A run 013 arquivou uma change que o `verify` reprovava no mesmo instante, no
mesmo repositório. Não foi bug: REQ-ARC-002 declara três pré-condições —
coverage, evidence e âncoras — e `assertArchivable` cumpre exatamente as três.
O buraco está no texto do requisito.

O que escapa é o que as camadas `provenance` e `schema` cobrem: change sem
bundle onde o projeto declara fonte obrigatória, change sem `proposal.md`,
change sem `card` onde o repositório exige card. Arquivar é a operação mais cara
do ciclo — ela promove requisito de `origin: delta` para `origin: specs` e
transforma warning de âncora em erro. Promover com metade do gate lido é assumir
dívida sobre coisa que ninguém verificou.

## O que muda

As pré-condições passam a ser **as camadas offline que `verify.levels` declara**,
escopadas à change sendo arquivada. `project` fica de fora: rodar o
`validation_command` dentro do `archive` duplica o `verify` e cobra caro numa
operação que já é cara.

Respeitar `verify.levels` não é detalhe. REQ-VER-002 diz que só rodam as camadas
que o projeto configurou; exigir no `archive` uma camada que o projeto desligou
seria um segundo gate entrando por outra porta, contra `single-gate`.

## O escopo do diagnóstico é a decisão difícil

`provenance` e `checkDeclaredCard` já iteram `ctx.effective.changes`, e
`assertArchivable` já entrega um contexto com uma change só. Encaixam.

`ctx.effective.diagnostics` e `checkRetiredReuse` são globais: carregam o que os
parsers acharam em toda capability e em toda change aberta. Passados como estão,
um delta quebrado numa change que ninguém está arquivando impediria este
arquivamento — e isso não é rigor, é acoplamento.

O corte escolhido: entra o diagnóstico do diretório desta change, e o das
capabilities que este delta vai reescrever. Sai o resto. A justificativa é
simétrica ao que já existe: `archive` escreve nesses arquivos, então precisa que
eles estejam legíveis; não escreve nos das outras changes, então não julga.

## O que isto derruba, e por que não é regressão

As seis chamadas a `archive()` de `test/integration/redmine/archive-sync.test.ts`
montam projetos sem `proposal.md`, com `[board] provider` declarado — o que
torna `card` obrigatório por default. Elas passam hoje porque o `schema` não é
pré-condição. Quando ele for, param de passar.

Não é regressão: é dívida aparecendo. As fixtures descreviam um estado que o
gate deste repositório já reprova.
