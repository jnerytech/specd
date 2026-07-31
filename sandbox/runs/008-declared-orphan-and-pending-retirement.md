# Run 008 — Fatia 8, o caminho isentado e o intervalo sem nome

- **Quando:** 2026-07-29
- **Versão avaliada:** specd em `07a88b7`, fim da Fatia 8
- **Alvo:** Redmine 6.1.3 local semeado, mais o próprio repositório
- **Veredito:** os três requisitos estão implementados e medidos. Um deles pediu
  decisão que a spec não tinha tomado, e ela apareceu como restrição de task
  impossível de cumprir, não como redação ambígua. Quatro revisões automáticas
  não acharam defeito acima de 80, e acharam três coisas de qualidade que
  valeram conserto — uma delas um bug de fixture com dois anos de latência.

> Registro imutável. 478 testes offline, 27 de integração.

---

## 1. O que a fatia fechou

**O buraco.** `assertNoUndeclaredOrphans` filtrava `!orphan.declared`, então
órfã declarada ia direto para `closed` sem passar pelo `bodyKey`. Renomear
requisito **já realizado** — `REMOVED: REQ-A` mais `ADDED: REQ-B` de mesmo
corpo, que é a única forma de dizer rename no delta — fechava o card e criava
outro em silêncio.

Era o achado do run 006 sobrevivendo no único caminho que a Fatia 7 isentou por
construção. Sintoma que migra sob a correção.

**O intervalo.** Requisito sob REMOVED saía da spec efetiva ao abrir a change e
só entrava em `retired` no archive. No meio, `sync` recusava. Agora tem estado
próprio.

A classificação final, quatro ramos ordenados:

```
órfã
 ├─ corpo reaparece em item planejado sem ligação ──► RECUSA, nomeia os dois
 ├─ identificador sob REMOVED de change aberta ─────► DEIXA EM PAZ, relata
 ├─ identificador em `retired` ─────────────────────► FECHA
 └─ nada corresponde ───────────────────────────────► RECUSA
```

Corpo vence declaração. O argumento está no requisito e não no código: uma morte
declarada cujo corpo reaparece é o par de estados **mais** ambíguo do modelo,
não o menos — o autor escreveu REMOVED porque não há vocabulário para renomear,
então a declaração não distingue as duas leituras. Confiar nela ali é ler
intenção onde só falta vocabulário.

---

## 2. A decisão que a spec não tomou

Uma, e ela não apareceu como redação ambígua no requisito. Apareceu como
**restrição de task que não dava para cumprir.**

A task 001, escrita antes de qualquer código, dizia:

> Nenhuma leitura do board para órfã que já se sabe fechável sem ambiguidade —
> quem não precisa da rede não a exige.

Impossível. Para saber que a órfã é fechável sem ambiguidade é preciso comparar
o corpo do card com os corpos dos itens sem ligação — e o requisito que morreu
**saiu da spec**, então a única cópia sobrevivente do corpo dele está no board.
Sem ler o card não há como distinguir morte de renomeação, que é a pergunta
inteira.

Corrigida antes de implementar, e a razão ficou escrita na própria restrição em
vez de virar comentário no código. A regra "quem não precisa da rede não a
exige" continua valendo; o que estava errado era a premissa de que aqui ela não
era necessária.

Vale registrar como o defeito nasceu, porque é o mesmo padrão da Fatia 7 numa
casa diferente: escrevi a restrição por **coerência com a regra que a fatia
anterior tinha acabado de enunciar**, e não por ter verificado que ela cabia
neste caso. Na Fatia 7 foi coerência de vocabulário — "projeção" porque o resto
da capability diz projeção. Aqui foi coerência de princípio.

A diferença entre os dois é que o primeiro sobreviveu até a implementação e o
segundo não podia sobreviver: uma restrição impossível para na primeira linha de
código, enquanto um requisito que nunca dispara passa em todos os testes. O
segundo é mais barato **porque é impossível**, e isso é sorte, não método.

Os outros dois requisitos não pediram decisão. REQ-SYNC-016 tinha uma pergunta
embutida — se corpo vence proposta — e a resposta já estava dita no proposal
antes de virar requisito.

---

## 3. As quatro revisões automáticas

Três em paralelo antes do commit, uma no diff que o `archive` deixou. Corte de
confiança em 80.

| Foco | Achados ≥80 | Aproveitado |
| --- | --- | --- |
| P1–P9 | 0 | 2 observações |
| Cadeia de classificação | 0 | 1 observação |
| Correção e convenções | 0 | 1 bug de fixture |
| Diff do `archive` | 0 | — |

Zero achados acima do corte, e isso é informação de dois gumes: ou o trabalho
estava certo, ou três revisores concordaram com a mesma leitura errada. O que
inclina para a primeira é que os três olharam de ângulos que não se sobrepõem e
**nenhum deles encontrou o mesmo item que outro** — se estivessem lendo a mesma
coisa, teriam repetido.

O que os três acharam abaixo do corte, e que virou conserto:

**O desempate inalcançável.** `findOrphanedLinks` resolve "declarada e proposta
ao mesmo tempo" a favor de declarada. O revisor da cadeia mostrou que o estado
não existe: `src/parser/capability.ts:78` recusa heading cujo identificador já
está em `retired`, então ele nunca entra em `capability.requirements`, e
`collectRetiring` só nomeia identificadores que estão lá. Os dois conjuntos são
disjuntos por construção.

O comentário descrevia um cenário impossível — que é o defeito de prosa sem
contrato, dentro do código desta vez. Corrigido, e a invariante virou **teste**
em `spec-tree.test.ts` em vez de continuar sendo frase. Se o parser afrouxar, o
teste cai.

**A leitura dupla.** `buildSpecTree` chamava `readOpenChanges` e depois
`effectiveSpecs`, que chamava `readOpenChanges` de novo. Duas observações do
mesmo diretório alimentando, uma o `roots` e outra o `retiring`. Nada quebrava
hoje; a discordância entre elas seria um card fechado ou recusado sem motivo
visível. Passou a ser uma leitura só.

**O `dropRequirement` do fixture.** O regex
`^### ${id} — [\s\S]*?(?=^### |\s*$)` com flag `m` só apagava a **heading**: sob
`m`, o `$` do lookahead é satisfeito no fim da própria linha do título. O corpo
ficava para trás e `splitRequirementSections` o anexava ao requisito **anterior**.

Inofensivo nos fixtures existentes — nada afirmava sobre o bloco contaminado — e
armadilha para o próximo, especialmente um que carregasse âncoras. Eu tinha
tropeçado nele escrevendo `copyRequirement` e o contornei em vez de consertar; o
revisor apontou que contornar num helper novo e deixar o velho quebrado é pior
que qualquer um dos dois sozinho. Consertado com a mesma fatia por índice.

**Uma coisa que ficou como está.** O revisor de princípios observou que a
comparação por corpo é igualdade exata e que alguém poderia "melhorá-la" para
difusa no futuro, reintroduzindo palpite. Não mudei o código — mudei o
comentário no ponto da comparação, dizendo por que exata é a propriedade e não o
detalhe. Não dá para impedir por máquina que alguém troque `===` por
similaridade; dá para deixar escrito ali que isso troca evidência por juízo.

---

## 4. O limite declarado, medido

REQ-SYNC-014 declara o buraco, na disciplina de REQ-ARC-013: a proteção é por
corpo, então renomear editando uma palavra do statement não gera candidato, e o
card fecha.

O teste `closes the card when the rename also edits the body` afirma
`is_closed: true` lido do Redmine. É a única afirmação da suíte cuja aprovação
significa "a ferramenta faz a coisa que ela existe para evitar" — e ela está lá
porque rede com buraco medido vale mais que rede que se supõe inteira.

A saída que fecharia o buraco — vocabulário de transição no delta — é a que P1
estendido rejeita. Registrado no requisito, não só no run.

---

## 5. Uma consequência do estado novo

O teste `syncs after applying when asked` mudou de forma, e a mudança conta uma
coisa que nenhum documento dizia.

Antes: `sync` com a change aberta recusava, então nada era criado, e o
`archive --sync` seguinte criava o card do requisito ADDED e fechava o do
REMOVED. `create: 1, closed: 1`.

Agora: `sync` com a change aberta **cria** o card do ADDED — porque o board
projeta o plano — e deixa o do REMOVED aberto. Depois, `archive --sync` não cria
nada e só fecha. `create: 0, closed: 1`.

Os dois momentos de virar real, num teste só, sem que ninguém tenha decidido a
pergunta. O requisito nasce no board quando a change abre e morre no board
quando a change arquiva, e o intervalo entre os dois agora tem nome — `retiring`
— em vez de ser uma recusa.

Isso não fecha a pergunta. Torna ela observável, que é diferente e é melhor: ela
deixou de ser argumento sobre modelo e virou duas linhas de contagem que alguém
pode ler.

---

## 6. Números

| | |
| --- | --- |
| Testes offline | 478 (eram 464) |
| Testes de integração | 27 (eram 22) |
| Requisitos em `.specd/specs/` | 103, em 10 capabilities |
| Âncoras penduradas | 0 |
| `npm run verify` | verde, seis camadas |
| `npm run test:integration` | verde |
| Revisões automáticas | 4, zero achados ≥80 |

---

## 7. O que este run deixa aberto

**A pergunta dos dois momentos continua aberta, e agora é observável.** A §5 é
ela aparecendo numa contagem em vez de num argumento. O relógio continua sendo
divisão de requisito virar operação comum.

**O candidato da ligação no bloco tem duas razões independentes.** A segunda
entrou nesta fatia: vocabulário de transição no delta põe escrita destrutiva sob
decisão de quem escreve o delta, e o escritor confiável desse campo seria
`propose`. Vale mesmo que ninguém divida requisito nunca. Continua candidato.

**`0/0 tasks done` continua na quarta reincidência.** O gatilho combinado vale:
quinta vez, vira trabalho próprio.

**Ainda um adaptador só.** Quarta fatia consecutiva registrando. E esta fatia
acrescenta um caso concreto ao que o segundo adaptador decidiria: o Azure DevOps
tem *Removed* como estado distinto de *Closed*, então "fechar" pode não ser o
verbo certo do outro lado, e a órfã declarada pode ter duas dispositivas em vez
de uma. Dedução, como sempre — mas dedução com nome agora.

**Zero achados ≥80 em quatro revisões é dado ambíguo.** Não sei se mede a
qualidade do trabalho ou o teto do método. Um jeito de descobrir seria rodar as
mesmas quatro revisões contra um commit antigo com defeito conhecido — o 204 do
Redmine, o `!orphan.declared` da Fatia 7 — e ver se elas o pegam. Não rodei.
