# Exploração — usable-vacuous

## Origem do escopo

Sem board neste repositório. O escopo veio do achado 3 da run 013, registrado em
`sandbox/RELATORIO.md`: `explore` sem source declarada e com board fora do ar sai
0 dizendo `usable`.

## Escopo

O que `usable` afirma, e o que ele deve afirmar quando nada foi declarado.

## Não-escopo

- A saída A do achado 1 e a lista de skills em três lugares
- A decisão pendente sobre o método de sandbox no ciclo
- Qualquer mudança na camada `provenance` que não decorra do conserto

## O que `usable` afirma hoje, literalmente

`src/explore/index.ts`: `usable: requiredFailures(sources).length === 0`, onde
`requiredFailures` filtra as fontes com `required: true` e `status: "failed"`.

Em português: **nenhuma fonte declarada obrigatória falhou.** Com zero fontes
declaradas, a lista é vazia, e vazio satisfaz "nenhuma falhou" — verdade
vacuamente verdadeira.

`src/explore/manifest.ts` documenta o campo como "True when every required source
reported `ok`", que é a mesma afirmação e a mesma vacuidade.

O que um leitor entende ao ver `bundle: usable` na saída do comando é outra
coisa: que o bundle serve para trabalhar em cima — que o contexto foi coletado.
A distância entre as duas leituras é o defeito inteiro. O nome promete
suficiência; o cálculo entrega ausência de falha declarada.

Requisitos conferidos em `specd spec --json`, todos `origin: specs`:

- REQ-EXP-003 — `IF any source declared as required fails to collect, THEN … exit
  non-zero without marking the bundle as usable`. É o requisito que define o
  campo, e ele fala só do caso de falha.
- REQ-EXP-004 — o manifest registra tipo, nome, flag de obrigatória, status,
  saída e erro de **toda fonte configurada**. Com zero fontes, registra zero.
- REQ-EXP-008 — o manifest é escrito antes de a falha ser reportada.
- REQ-VER-003 — a camada `provenance` só cobra manifest quando a configuração
  declara ao menos uma fonte obrigatória, e lê exatamente este campo.

## As configurações e seus desfechos

Enumeradas, com o comportamento medido na run 013 e lido no código:

| board | fonte declarada | board no ar | exit | `usable` | o que um leitor conclui |
| --- | --- | --- | --- | --- | --- |
| configurado | alguma `required` | sim | 0 | `true` | coletou — e coletou mesmo |
| configurado | alguma `required` | **não** | 2 | `false` | falhou — correto |
| configurado | só opcionais | não | 0 | `true` | coletou — **e não coletou nada** |
| configurado | **nenhuma** | não | 0 | `true` | coletou — **e nem tentou** |
| configurado | **nenhuma** | sim | 0 | `true` | coletou — **e nem tentou** |
| não configurado | nenhuma | — | 0 | `true` | coletou — e não havia o que coletar |

As duas linhas do meio são o defeito. A última linha é o caso do modo sem board,
onde `usable: true` é a resposta certa por outra razão: não existe fonte a
coletar, e o escopo vem da descrição de quem roda a skill.

`[board] card = required | optional` **não interage**. Conferido em REQ-CFG-012:
ele governa se a change declara card, é lido pela camada `schema`, e não toca
`explore` nem o manifest. A única relação é indireta — o mesmo `[board]` que o
torna exigível é o que torna a ausência de fonte suspeita.

## Onde o conserto pode morar

### No requisito: `usable` deixa de ser vácuo

REQ-EXP-003 fala só do caso de falha; falta dizer o que o campo afirma quando
não há o que falhar. A forma mínima é `usable` exigir que **alguma** coleta tenha
acontecido com sucesso — nenhuma obrigatória falhou **e** existe fonte declarada.

Custo: repositório sem board nenhum passaria a receber `usable: false`, o que é
errado — lá não há fonte porque não há o que coletar, e o modo sem board é
legítimo por decisão registrada. Ou seja, a condição não pode ser só "existe
fonte"; precisa olhar se havia board.

### No default de configuração: `required` por padrão quando há board

Se toda fonte de tipo `board` nascesse `required` quando `[board]` está
configurado, a linha "só opcionais" desaparece e a linha "nenhuma" continua.
Não resolve sozinha, e é config nova.

Encosta em `config-only-on-divergence`: exige nomear dois clientes reais
divergindo. **Não tenho a divergência observada.** O que existe é um repositório
com board e sem fonte declarada — este, na run 012 — e nenhum caso de alguém
querer fonte de board opcional. Sem a divergência, a saída é descartável por
princípio, e a registro como descartada e não como opção viva.

### Nos dois: campo novo em vez de mudar o significado do velho

`usable` continua com o significado que a camada `provenance` já lê, e o manifest
ganha o que hoje não existe — a distinção entre "nada falhou porque nada foi
declarado" e "nada falhou porque tudo coletou". O CLI reporta a diferença; a
skill de explore lê e para.

Custo: campo novo no manifest, que é artefato versionado — e o manifest tem
`version`, então a mudança é declarável.

## O caso degenerado: board configurado, alcançável, nenhuma fonte declarada

É a pergunta que separa as saídas, porque nele **nada está errado** — ninguém
declarou fonte, ninguém falhou, e o board responderia se alguém perguntasse.

Três respostas possíveis para `usable`, e cada uma implica um desenho diferente:

- **`true`, como hoje** — o campo afirma só ausência de falha declarada, e a
  correção tem que vir de outro lugar, porque este caso é indistinguível do
  board fora do ar.
- **`false`** — o campo passa a afirmar que houve coleta, e um repositório com
  board sem fonte declarada nunca produz bundle usável até declarar uma.
- **nem um nem outro** — o campo deixa de ser booleano ou ganha um vizinho, e o
  bundle passa a ter um terceiro estado: nada foi coletado, e isso não é falha
  nem sucesso. É a forma que `absence-is-not-compliance` pede em outros lugares
  do repositório, onde "não consegui verificar" é o terceiro resultado.

## Um defeito que a exploração encontrou e não conserta

`bundle: usable` é impresso pelo CLI mesmo quando o repositório não configura
board nenhum e nenhuma fonte existe — no modo sem board, a saída afirma algo que
não tem conteúdo. Não é o achado 3, é o mesmo vácuo aparecendo onde ele não
incomoda ninguém. Registrado em `sandbox/RELATORIO.md` para não voltar como
surpresa quando o campo mudar de significado.

## Perguntas em aberto

Uma, e ela decide as outras: **o que `usable` deve dizer no caso degenerado.** As
saídas de conserto dependem disso, não o contrário.
