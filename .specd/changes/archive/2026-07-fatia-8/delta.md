---
change: 2026-07-fatia-8
target: [sync]
---

# Delta — Fatia 8

Fechar o caminho que a Fatia 7 isentou — órfã declarada cujo corpo reaparece —
e dar resultado próprio à morte que ainda é proposta.

## ADDED

### REQ-SYNC-016 — A proposed death leaves the board item alone

**Capability.** sync

**Statement.** IF the identifier of a board link is declared under REMOVED by an open change, THEN the specd sync command SHALL leave the board item untouched and report it as pending retirement.

**Acceptance.**

- Identificador sob REMOVED de change aberta não fecha o item e não remove a ligação
- A execução não é recusada por causa dele
- O resultado aparece no relatório com contagem própria, inclusive em `--json`
- Depois do `archive`, o mesmo identificador está em `retired` e volta a fechar por REQ-SYNC-014
- O sinal é lido das changes abertas em disco, sem consultar o board

A morte está proposta e não declarada, e as duas coisas exigem ações
diferentes. Fechar no proposto perderia o card de uma change abandonada; recusar
no proposto trava `sync` durante toda uma change de remoção, que é o que o run
007 §4 mediu.

Silenciar seria a terceira saída errada, e é P8 pela definição: verificou,
encontrou algo, e não contou. Quem roda `sync` no meio de uma remoção precisa
saber por que o card continua aberto sem deduzir do que não foi impresso.

O sinal já estava no disco. `buildSpecTree` chama `readOpenChanges` para montar
as tasks e não olhava `delta.removed` — mesma forma da correção anterior, em que
`retired` existia e não era lido.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export function findOrphanedLinks"
```

## MODIFIED

### REQ-SYNC-014 — Closing a board item requires a declared death and no reappearing body

**Capability.** sync

**Statement.** The specd sync command SHALL close a board item only when the identifier that links it is listed as retired in the capability frontmatter and no planned item without a link carries the same body.

**Acceptance.**

- Identificador em `retired`, sem corpo reaparecendo, fecha o item e remove a ligação
- Identificador em `retired` cujo corpo reaparece em item planejado sem ligação não fecha nada
- Identificador em `retired` renomeado com edição no corpo fecha o item, e isso é o limite declarado
- Identificador ausente da spec e ausente de `retired` não fecha nada
- `retired` é lido do arquivo de capability que declara a ligação, não de configuração
- Nenhuma escrita no board ocorre para órfã que não satisfaz as duas condições, nem para os itens sadios da mesma execução

O sinal já existia e o `sync` não o lia: `archive` acrescenta a `retired` todo
identificador sob REMOVED, então morte declarada é um fato registrado no
arquivo. Comparar chave ligada contra chave planejada e chamar toda diferença
de morte foi a ferramenta ignorando o próprio modelo.

A segunda condição é a correção desta fatia. Renomear requisito já realizado se
escreve `REMOVED: REQ-002` mais `ADDED: REQ-009` com o mesmo corpo, porque o
delta não tem vocabulário para renomear — e isso satisfazia a primeira condição
sozinha, fechando o card em silêncio. O autor declarou uma morte na única
vocabulário disponível para dizer outra coisa.

Pela letra de P9 havia declaração; pelo teste de P9 não havia, porque escrever
um identificador numa lista não exibe o preço. Declaração que não mostra o custo
não é declaração — é a mesma frase com aparência melhor.

**O limite está declarado, na disciplina de REQ-ARC-013.** A proteção é por
corpo, então ela pega renomeação que não toca o corpo e não pega renomeação que
ajusta uma palavra do statement no mesmo delta. Nesse caso o corpo não bate,
sobra só o `retired`, e o card fecha — exatamente o que este requisito existe
para evitar, no caso que ele não alcança.

Não é descuido nem coisa a consertar depois: é o preço de detectar por conteúdo
em vez de exigir declaração, e a alternativa que fecharia o buraco — vocabulário
de transição no delta — é a que P1 estendido rejeita, porque poria escrita
destrutiva em board de cliente sob decisão de quem escreve o delta. Rede com
buraco conhecido e medido vale mais que rede que se supõe inteira; o caso está
no teste de integração, contra o servidor, para que o buraco tenha tamanho.

O que se perde ao fechar por engano não é o card: é o comentário, o anexo e o
apontamento de hora que alguém pendurou nele, e que a spec não sabe que
existem.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export async function classifyOrphans"
```

### REQ-SYNC-015 — An orphan specd was not told to close stops the command and names the candidate

**Capability.** sync

**Statement.** IF a board link has no requirement in the spec, is not declared under REMOVED by an open change, and does not satisfy both conditions for closing, THEN the specd sync command SHALL exit with code 2 naming the link, the board item and every planned item without a link whose body matches the board item's body.

**Acceptance.**

- Órfã sem declaração sai 2 nomeando identificador, `ref` e URL do item
- Órfã declarada em `retired` cujo corpo reaparece sai 2 nomeando os dois identificadores
- Item planejado ainda sem ligação e com corpo idêntico ao do card órfão é nomeado como rename provável, sem ser aplicado
- Mais de um candidato com o mesmo corpo lista todos e não escolhe
- Nenhum candidato é reportado como tal, e a recusa continua valendo
- A mensagem diz as saídas disponíveis para o caso: trocar a chave da ligação, ou declarar o identificador em `retired`
- Nada é escrito no board nem na spec, nem para os itens sem problema

P4 na forma que interessa: há dois estados possíveis — o requisito morreu ou
mudou de nome — e a diferença entre eles é destrutiva numa direção. O corpo
idêntico é indício forte e não é prova, então ele informa e não decide.

Corpo reaparecendo vence declaração, e essa precedência é a decisão desta
fatia. Uma morte declarada cujo corpo aparece sob outro identificador é o par de
estados mais ambíguo que existe no modelo, não o menos: o autor escreveu REMOVED
porque não há vocabulário para renomear, então a declaração não distingue as
duas leituras. Confiar nela ali é ler intenção onde só há vocabulário faltando.

A comparação é pelo **corpo**, não pela projeção inteira, e isso é decisão de
desenho e não detalhe. O título de um item deriva do identificador — renomear
muda o título por construção —, então projeção idêntica nunca casaria justamente
no caso que este requisito existe para pegar. O corpo é o que sobrevive à
renomeação, e é por isso que ele é o sinal.

Renomear deixa de ser grátis e passa a ser barato e recusado até ser declarado,
que é P9 aplicado: o custo aparece no momento em que é pago, e não três semanas
depois num card fechado que ninguém procurou.

```yaml anchors
- file: src/sync/errors.ts
  symbol: "export class UndeclaredOrphanError"
```

## REMOVED

Nenhum.
