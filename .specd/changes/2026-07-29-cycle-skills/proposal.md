---
change: 2026-07-29-cycle-skills
status: active
---

# cycle-skills — o ciclo deixa de ser emprestado

## Por quê

O ciclo `explore → propose → apply → archive` roda hoje com as skills do
OpenSpec. Elas apontam para `openspec/changes/`, chamam `openspec new change` e
só funcionam porque o `CLAUDE.md` sobrepõe os caminhos por instrução de projeto.
O commit que encerrou o rastreio duplo declarou que abrir change em
`openspec/changes/` é regressão — e as skills continuam mandando fazer isso.

Instrução de projeto corrigindo caminho de skill é a mesma classe de coisa que
âncora que não resolve: funciona enquanto alguém lembra. O specd existe para não
depender de alguém lembrar.

A change troca as skills emprestadas por skills próprias, e paga o preço que
elas cobram: quatro pontos onde a skill precisaria de um comando que não existe,
e escreveria à mão o que o CLI deveria decidir. É esse preço que o delta cobre.

## O que a exploração fixou

Sete decisões, todas tomadas com o repositório aberto na frente:

| Decisão | Escolha |
| --- | --- |
| `archive` no board | transição para `board.mapping.archived_status`, não fechamento |
| arquivo de explore | `explore/notes.md`, ao lado do `manifest.json` |
| spec efetiva | comando novo `specd spec`, com `origin` por requisito |
| identidade externa da change | campo `card` na frontmatter da change |
| quem abre a change | `explore` |
| dispensa de tarefa | `board.card = "required" \| "optional"`, por repositório |
| onde as skills moram | no tarball do npm, escritas por `specd init --skills` |

## O que a exploração encontrou no repositório

Quatro fatos que mudaram o desenho, verificados no código e não na lembrança:

**Não existe comando que emita a spec efetiva.** `effectiveSpecs` é consumida
por `verify`, `status`, `sync` e `anchor fix`, e por nenhum comando que a
imprima. Sem `specd spec`, a skill lê `.specd/specs/` e os deltas soltos e
reconstrói o overlay — que é reimplementar decisão fora do CLI, do lado errado
de no-llm-in-decision-path.

**O diretório `explore/` já é do bundle.** `specd explore` grava ali
`manifest.json` e um arquivo por fonte. A prosa da exploração passa a morar no
mesmo diretório, e o comando precisa saber que não é dono dele.

**O link com o board é do requisito, não da change.** Ele vive na frontmatter da
spec, chaveado por item, com `ref`, `url`, `synced_at` e `synced_hash`. Nada
declara de qual card a change nasceu — o card só aparece como argumento do
`explore` e dentro do manifest.

**`close` é a única transição que o adaptador sabe fazer.** Ela move o item para
`closed_status` e relê para provar que aplicou. Um board com `Em homologação` e
`Aguardando Deploy` entre `Em curso` e `Fechada` não tem como receber "a spec
avançou, o trabalho está pronto para homologar" — só "morreu".

## A dispensa por change deixou de existir

A exploração previa registro por change de "esta mudança não tem tarefa".
A decisão foi outra: `board.card` vale para o repositório inteiro.

O caso do meio — board sério, mas *esta* change é refactor interno — resolve
virando o repositório para `optional`, o que apaga a cobrança das outras. É uma
perda real e está registrada aqui de propósito.

Não vira botão agora porque config-only-on-divergence: o botão por change nasce
quando dois clientes reais divergirem, não quando um desenho antecipar que
poderiam. Enquanto isso, o modo por repositório é uma linha de config e uma
verificação de schema, e a alternativa seria um campo, uma validação e um caso
de exceção em cada uma das quatro skills.

## O risco que a decisão de empacotamento comprou

Skill no tarball cita comando do CLI. Instalação antiga escreve skill que chama
`specd spec --json` inexistente, e o modo de falha é a skill reconstruir o
overlay na mão — exatamente o que o comando novo existe para impedir.

Por isso cada skill declara a versão mínima que precisa e para antes de agir.
Uma skill que falha ruidosamente por versão velha é recuperável; uma que
degrada em silêncio produz proposta ancorada em spec que ela inventou.

## O que fica fora

`propose` e `apply` continuam sem comando de CLI. Esta change não os cria: o
que falta neles é julgamento, e julgamento é a camada da skill. O que o CLI
ganha aqui é só o que é determinístico — ler a spec efetiva, validar a
frontmatter da change, transicionar um item do board, instalar arquivo.

O adaptador continua sendo só o Redmine. `transition` entra na interface porque
`close` já estava lá e as duas são a mesma operação com alvo diferente; nenhum
segundo provider entra junto.

## Como isto se valida

Rodada de sandbox por modo, contra repositório que as skills não conhecem: com
board e card real, sem board, e — a que importa — board configurado e
indisponível, para provar que a skill para em vez de cair para o modo sem
board. Teste escrito por quem escreveu a skill codifica as premissas de quem
escreveu a skill.
