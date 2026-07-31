# Run 014 — o caso negativo do achado 2

**Quando:** 2026-07-30
**Contra:** `sandbox/runs/014/target`, projeto Node mínimo criado para esta rodada, com
uma capability e uma change montada para reprovar de propósito.
**Build:** `dist/` em `8f7fd5b`, com a change `2026-07-30-archive-preconditions`
aplicada.

## Por que esta rodada existe

Arquivar change verde exercita o caminho que já funcionava antes do conserto. O
defeito do achado 2 era o `archive` **aceitar** o que o gate reprovava, então a
evidência de conserto é a recusa. O "antes" está medido na
[run 013](013-cycle-skills-hostil.md): mesma classe de change, arquivada com o
gate vermelho ao lado.

## O que foi medido

| Caso | Estado montado | `verify --fast` | `archive` |
| --- | --- | --- | --- |
| A | change sem `proposal.md` | `fail schema` | **exit 2**, nomeando a camada e o arquivo |
| B | fonte obrigatória declarada, change sem bundle | `fail provenance` | **exit 2**, nomeando a camada e o manifesto ausente |
| C | a mesma change, corrigida | `passed` | exit 0, capability escrita |
| D | outra change aberta com delta sem `**Statement.**` | `fail schema` | exit 0 — arquiva a change boa |

Depois das recusas A e B: `.specd/specs/` intocado, o diretório da change ainda
em `changes/`, `changes/archive/` vazio. REQ-ARC-002 pede que nada seja escrito e
nada seja moviedo quando aborta, e nada foi.

A mensagem prefixa a camada — `schema:`, `provenance:` — e termina em
"Run `specd verify` for the full verdict", que é o critério de aceite sobre onde
o veredito mora.

## O caso C existe para que a recusa não prove demais

Um `archive` que recusasse sempre passaria em A e B e seria inútil. C é a mesma
change dos casos anteriores com os dois defeitos corrigidos: arquiva, escreve a
capability, sai 0. A recusa é sobre o estado, não sobre o comando.

## O caso D é o que separa rigor de acoplamento

Com uma segunda change aberta cujo delta não tem `**Statement.**`, o repositório
inteiro fica vermelho no `verify` — e o `archive` da change boa **prossegue**.

É REQ-ARC-015 funcionando: o corte de diagnóstico é o diretório desta change mais
as capabilities que este delta reescreve. Um trabalho quebrado que ninguém está
arquivando não bloqueia o arquivamento de outro.

A consequência precisa ficar escrita, porque é contraintuitiva: **`archive` pode
sair 0 enquanto `specd verify` sai 1**, quando o vermelho pertence a outra change
aberta. Não é o buraco do achado 2 de volta — é a fronteira declarada no lugar do
acoplamento que o Modelo B tirou de propósito.

## O que continua fora

Task `pending` segue sem bloquear o `archive`; a skill exige, o CLI não. Não foi
tocado aqui e continua na lista de pendências.

## Como o alvo foi montado

> Acrescentado em 2026-07-31, ao versionar os registros. A observação acima não
> foi tocada — o que faltava era a receita, sem a qual o registro não se sustenta
> sozinho agora que o alvo fica fora do repositório.

Projeto Node mínimo criado na rodada, em `sandbox/runs/014/target`:

- `package.json` — `type: module`, privado, `test` rodando `node --test test/*.test.js`
- `src/present.js` — uma função, `export function present`, que existe só para a
  âncora resolver
- `git init` e um commit, porque a camada `evidence` consulta a história quando
  uma task declara commit
- `specd init`, e depois `.specd/specs/probe.md` escrita à mão: capability
  `probe`, requisito `REQ-PROBE-001`, âncora para `src/present.js`

As changes de cada caso foram montadas à mão sobre isso, e a configuração de
fonte obrigatória do caso B é uma seção `[[explore.sources]]` com
`type = "board"` e `required = true`.
