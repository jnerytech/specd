---
change: 2026-07-fatia-9
status: active
---

# Fatia 9 — a superfície de primeiro contato, que ninguém reivindicou

## Por quê

`specd --help` já existe. `-h`, `help`, `--version` e `-v` também. Estão em
`src/cli.ts:22-29` e em `src/cli/index.ts:417-424`, funcionam, e o README manda
rodar um deles como **primeiro comando executável do projeto** (README.md:26).

Nenhum requisito os reivindica. `.specd/specs/cli.md` tem REQ-CLI-001 a 007 e
nenhum menciona help, version ou texto de uso. Grep de `help|USAGE|--version`
nas capabilities: zero.

Essa é a direção de drift que o specd **não detecta**. Âncora pendurada ele
acha; código órfão de requisito, não — é exatamente por isso que CLAUDE.md
proíbe `/feature-dev` neste repositório. O detalhe que torna o caso instrutivo é
que o código não está mal-feito. Está bem-feito e não-declarado, e portanto
invisível para o gate que valida este próprio repositório.

## Os três buracos, e por que são o mesmo

**1. Ninguém declara.** Acima.

**2. `USAGE` é literal, desacoplado da tabela.** `Command.summary`
(`src/cli/index.ts:29`) está definido em nove comandos e é lido em zero lugares.
Campo morto. O texto de uso é uma string de 44 linhas escrita à mão ao lado.
Comando novo entra no `Map` e passa em tudo sem aparecer no help — nenhum teste
amarra os dois.

O drift **já aconteceu e ninguém viu**: `--version` e `-h` funcionam e não estão
no texto de uso. Quem lê o help não descobre que existem. E a causa é precisa —
esses dois são tratados em `main()` **antes** do dispatch, então nem uma geração
a partir do `Map` os pegaria. Os pontos de entrada que escapam da tabela são
justamente os que derivaram. É o argumento de que a tabela precisa enumerar a
superfície inteira, não só os comandos.

**3. `--help` por escopo explode.**

```
$ specd verify --help
Unknown option "--help". Valid options: --fast, --json.
exit 2
```

Idem `explore`, `archive`, `anchor`, `hooks install`. Convenção universal de
CLI, quebrada em 100% dos subcomandos.

Os três são o mesmo buraco: **não há uma fonte única do que a superfície é.** Há
uma tabela que dispara, um literal que descreve, e strings de uso espalhadas
pelos `throw`.

## A descoberta que muda o desenho

O texto de uso por escopo **já está escrito** — dentro das `UsageError`:

```
"Usage: specd explore <card> --change <name> — exactly one card identifier or URL."
"Usage: specd anchor suggest <capability> [--json], or specd anchor fix <requirement>."
"Usage: specd hooks uninstall — takes no arguments."
```

Nove strings, uma por escopo, que só aparecem quando o autor erra. São a ajuda
do escopo, com outro nome e escondidas atrás de uma falha.

Daí a forma: **uma string por escopo, dois caminhos de saída.** Pedida, sai em
stdout com exit 0. Violada, sai em stderr com exit 2. Nunca duas cópias, porque
duas cópias divergem — que é o mecanismo do buraco 2 aplicado a um objeto
menor.

Consequência de tabela: os blocos `Options for verify:`, `Options for init:` e
os outros quatro saem do texto global. Eles são a terceira cópia. O global
encolhe de 44 para ~20 linhas e o detalhe passa a viver no escopo a que
pertence, alcançável por `specd verify --help`.

## Escopo

### 1. Declarar o que já roda

Requisito e teste para help e version. Zero mudança de comportamento. Vem
primeiro para que 2 e 3 refatorem sob rede.

### 2. O texto global é renderizado da superfície registrada

Lista de comandos gerada de `name` + `summary`; opções globais geradas dos
pontos de entrada anteriores ao dispatch. Cabeçalho, rodapé e a ressalva do
`hooks run` continuam prosa à mão.

**Híbrido e não geração total, deliberadamente.** O rodapé explica por que
`hooks run` responde no contrato de exit code do host e não no do specd. Isso é
julgamento, não lista, e nenhuma metadata o produziria. Gera-se o que é
enumeração; declara-se o que é argumento.

**O limite está declarado.** Com a lista gerada, "todo comando registrado
aparece no help" vira verdade por construção, e o teste que a afirma é em parte
tautológico. Ele não guarda o invariante — guarda a costura: alguém voltando o
texto para literal, ou acrescentando ponto de entrada em `main()` sem
registrá-lo. É rede menor que a de um teste sobre código não-gerado, e está dita
aqui para não ser confundida com rede maior.

### 3. Todo escopo responde `--help`

`--help` precede a validação de opções e imprime o uso do escopo corrente, exit
0, sem executar trabalho nenhum. Dois níveis: `specd anchor suggest --help` e
`specd anchor fix --help` são textos diferentes.

## Por que `<cmd> --help` e não `help <cmd>`

Duas portas para o mesmo cômodo. Escolher uma agora custa uma linha; depreciar
depois custa uma change.

`--help` ganha por três razões, e a terceira é a que decide. É a convenção que o
usuário tenta primeiro — hoje ele tenta e leva exit 2. Funciona em qualquer
profundidade sem gramática nova, enquanto `help anchor suggest` precisaria
resolver dois níveis de posicional. E é a única das duas que compartilha fonte
com a `UsageError`: a recusa já diz `Usage: specd anchor suggest ...`, então
`--help` imprimindo o mesmo texto fecha um par que já existe. `help <cmd>` seria
uma terceira cópia — a doença que esta fatia trata.

`specd help` sem argumento continua existindo, porque já existe e REQ-CLI-008 o
declara.

## P2, P8 e P9

**P2.** Toda essa superfície sai 0 ou 2, nunca 1. Está escrito como critério e
não como suposição, porque `--help` é onde alguém um dia enfia validação e o
único gate ganha uma segunda porta sem que ninguém repare.

**P8 é o motivo do buraco 1 estar nesta fatia e não numa lista de melhorias.**
Help que não menciona `--version` não mente sobre estado — ele omite superfície,
e a omissão é lida como "não existe". Mesma família: o silêncio tem aparência de
resposta completa.

**P9 não morde.** Help não escreve, não toca rede, não custa. É a operação mais
barata do produto, e é por isso que ela pode sair 0 sem cerimônia.

## Fora de escopo

`completion` para bash e zsh: custo alto, e o pacote nem está publicado.
`--no-color` e `--quiet`: grep confirma zero ANSI em `src/`, e `--json` já cobre
pipe — P5 corta os dois, sem dois clientes divergindo. `--cwd` global: o README
resolve com `cd`, e mexer na origem do `cwd` é vizinhança de P8 instância 1
(rodar do diretório errado virava aprovação), que não se toca de passagem.
"Did you mean" em comando desconhecido: não fere P4 — sugerir não é
auto-resolver, e `anchor suggest` é precedente — mas é conveniência, não buraco.

`propose`, `apply` e memória, como sempre.

## Achado lateral, não desta fatia

`package.json` declara `"@jnerytech/specd": "^0.0.2"` em `dependencies`. O
pacote depende de si mesmo sob o nome escopado, provável resíduo de teste de
publicação, e vai no tarball do cliente. Não é help e não entra aqui. Fica
registrado para não se perder.
