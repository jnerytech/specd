# Run 013 — board configurado e indisponível

**Quando:** 2026-07-29
**Contra:** `sandbox/runs/013/target`, cópia do alvo da run 012 com
`url = "http://localhost:18099"` — porta onde nada escuta. O container seguiu no ar
em 18080, para que a indisponibilidade fosse do alvo e não do ambiente.

Esta é a rodada que decide. As outras duas medem o caminho felizivo; esta pergunta
se a ferramenta **para** em vez de virar o modo sem board.

## O que foi medido

| Comando | Resultado |
| --- | --- |
| `explore` sem `[[explore.sources]]` declarada | **exit 0, `bundle: usable`** — achado 1 |
| `explore` com source `type = "board"`, `required = true` | exit 2, `card (board): fetch failed`, manifest gravado com `usable: false` |
| `sync` | exit 2, mensagem de definições de campo indisponíveis, nada escrito |
| `sync` com `SPECD_BOARD_TOKEN` errado | exit 2, mesmo desfecho |
| `archive --sync` | exit 2, capability escrita, change movida, mensagem "a spec avançou e o board não" e ordem de rodar `specd sync` |
| `verify --fast` durante tudo isso | passa — o gate não toca a rede |

Nenhum comando degradou para "seguir como se não houvesse board". REQ-ARC-012
observado ao vivo: o archive ficou de pé com o board para trás, e nada foi
desfeito.

## Achado 1 — `explore` com board inalcançável e nenhuma source declarada sai 0 dizendo "usable"

Coerente com REQ-EXP-003, que só bloqueia por **source obrigatória** que falhou:
sem source, não há falha. Mas o efeito no ciclo é ruim. O repositório declara
`[board] provider`, o board está fora do ar, e o comando responde `bundle: usable`
— que a skill leria como "o card foi coletado".

O modo com board fica dependendo de o autor ter declarado `[[explore.sources]]`
para que a indisponibilidade apareça. Duas configurações que se leem como "tenho
board" produzem desfechos opostos diante da mesma queda de rede.

**Não consertado.** Candidatos: `explore` recusar quando há board configurado e
nenhuma source de tipo `board`; ou o bundle registrar explicitamente "nenhuma
fonte declarada" e não dizer `usable`. A escolha muda comportamento realizado de
`explore` e passa por delta.

Mitigação que já existe: a skill `specd-explore` manda parar quando o board está
inalcançável. Ela só não tem como saber que está, se o comando não disser.

## Achado 2 — `archive` não roda as camadas `provenance` e `schema`

Reprodução controlada, com uma change `2026-07-30-probe` sem bundle, num projeto
que declara uma source obrigatória:

```
verify --fast  → fail provenance: "Change 2026-07-30-probe has no explore manifest…"
archive        → exit 0, capability escrita, change movida
```

`assertArchivable` roda âncoras, `coverage` e `evidence`. `provenance` e `schema`
ficam fora. Então `archive` aplicou na verdade realizada uma change que o gate
reprovava ao lado, no mesmo repositório, no mesmo instante.

REQ-ARC-002 diz "preconditions gate the operation". Hoje elas são três das seis
camadas, e nada na spec diz que são só três.

Do mesmo teste sai o irmão menor: a task da probe estava `pending` e o archive não
se importou. A skill `specd-archive-change` exige toda task `done`, o CLI não —
então a regra vive na camada que pode esquecer.

**Não consertado.** Ampliar as pré-condições de `archive` é mudança de
comportamento realizado, e a decisão de quais camadas entram é do autor.

## Nota de ambiente

`sync` com credencial errada e `sync` com host fora do ar produzem a mesma
mensagem — a de definições de campo indisponíveis — porque a primeira leitura que
falha é `describeFields`. Os dois param, que é o que importa, mas quem lê a saída
não distingue "sem permissão" de "sem rede". Custo baixo, registrado.

## Como o alvo foi montado

> Acrescentado em 2026-07-31, ao versionar os registros. A observação acima não
> foi tocada — o que faltava era a receita, sem a qual o registro não se sustenta
> sozinho agora que o alvo fica fora do repositório.

Cópia do alvo da run 012 em `sandbox/runs/013/target`, com o `.specd/specs/` e o
`changes/archive/` esvaziados e a change reaberta a partir dos artefatos da 012.

A hostilidade é uma linha de configuração: `url` apontando para
`http://localhost:18099`, porta onde nada escuta. O container seguiu no ar em
18080, para que a indisponibilidade fosse do alvo e não do ambiente.

Na segunda metade da rodada, a fonte obrigatória foi acrescentada:

```toml
[board]
url_template = "http://localhost:18099/issues/{card}.json"

[[explore.sources]]
name = "card"
type = "board"
required = true
```
