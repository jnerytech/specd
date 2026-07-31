# Run 012 — ciclo das skills próprias, modo com board

**Quando:** 2026-07-29
**Contra:** `sandbox/runs/012/target`, cópia limpa do alvo sintético da run 011,
apontada para o Redmine 6.1.3 do container (`localhost:18080`, projeto
`specd-sync`), com `card = "required"` e `archived_status = "Resolved"`.
**Card:** issue 5, criada por API antes do ciclo.

## O que foi medido

| Passo | Resultado |
| --- | --- |
| `explore 5 --change …` com o card declarado | bundle escrito, `card 5 (redmine)` |
| `explore 4 --change …` com card divergente | exit 2, cita os dois, nada gravado |
| change sem `card` e `card = "required"` | camada `schema` reprova, nomeando a chave e a alternativa |
| `sync --dry-run` | plano com dois `create`, exibido antes de qualquer escrita |
| `sync` na etapa de propose | **exit 2, ENOENT** — ver achado 1 |
| `archive --sync` | capability escrita, dois `create` no board, dois itens movidos |
| leitura do board depois | issues 10 e 11 em `Resolved` |

REQ-SYNC-017 e REQ-ARC-014 medidos contra instância real: os itens da change
foram para um status **não fechado**, que é a diferença que a change inteira
existe para criar. A releitura confirmou; não foi a resposta da escrita que
confirmou.

## Achado 1 — `sync` quebra na etapa de propose quando a change cria capability nova

```
ENOENT: no such file or directory, open '…/.specd/specs/rate-limit.md'
exit 2
```

O link do board vive na frontmatter da spec (REQ-SYNC-007), chaveado por item.
`sync` roda sobre a spec efetiva, que inclui os deltas abertos — então ele planeja
criar card para um requisito cuja capability **ainda não existe em disco**, porque
sob Modelo B o arquivo só nasce no `archive`.

Consequência direta: o passo 6 de `specd-propose` — "sincronize a proposta" — falha
em toda change que introduz capability nova. Change que só acrescenta requisito a
capability já existente não é afetada, porque o arquivo está lá para receber o
link.

**Não consertado.** É decisão de desenho, não bug de digitação, e são pelo menos
três saídas possíveis: gravar o link no próprio delta e migrá-lo no archive; criar
o arquivo de capability vazio no propose; ou declarar que propose não sincroniza
capability nova e reportar isso em vez de falhar. Escolher por conta própria seria
adivinhar.

Defeito pré-existente: `sync` já lia a spec efetiva antes desta change. O que a
change fez foi construir um fluxo que passa por ali toda vez.

## Achado 2 — `card = "required"` liga junto com o board

O default de REQ-CFG-012 é `required` onde há board. Repositório que hoje só usa
`sync` e nunca ouviu falar de card passa a reprovar em toda change aberta ao
atualizar. As fixtures de integração deste repositório são exatamente esse caso —
não declaram `card` — e passam só porque `archive` não roda a camada `schema`
(achado 3 da run 013).

Fica registrado como custo de adoção, não como conserto: o default foi escolhido
porque board configurado com change sem card produz trabalho invisível para quem
acompanha pelo board. Quem discorda escreve uma linha de config.

## Ruído medido

Redmine exige o campo `Cliente` na criação, então a issue do card precisou de
`custom_fields`. Isso já era conhecido da run 004 e continua verdadeiro; vale
lembrar que qualquer instância de cliente pode ter campo obrigatório que o specd
não conhece, e `[[board.fields]]` com `constant` é o que resolve.

## Como o alvo foi montado

> Acrescentado em 2026-07-31, ao versionar os registros. A observação acima não
> foi tocada — o que faltava era a receita, sem a qual o registro não se sustenta
> sozinho agora que o alvo fica fora do repositório.

Cópia do alvo da run 011 em `sandbox/runs/012/target`, com `.specd/`, `.git/` e
`.claude/` removidos, `git init` de novo e `specd init --skills`.

Sobre isso, a configuração de board escrita à mão em `.specd/config.toml`:

```toml
[board]
provider = "redmine"
project = "specd-sync"
url = "http://localhost:18080"
token_env = "SPECD_BOARD_TOKEN"
card = "required"

[board.mapping]
capability = "Feature"
requirement = "Feature"
collapse = ["task"]
closed_status = "Closed"
archived_status = "Resolved"

[[board.fields]]
id = 1
constant = "ACME"
```

O Redmine é o do `test/integration/redmine/`, subido por `docker compose` e
semeado por `seed.sh`. O card foi criado por API antes do ciclo, com tracker
`Feature` e o campo obrigatório `Cliente`.
