---
change: 2026-07-29-read-aloud
status: active
---

# read-aloud — a spec como coisa que se escuta

## Por quê

A spec deste repositório tem 13.745 palavras em dez capabilities. Ela é lida
por máquina o tempo todo — `verify` a percorre inteira a cada gate — e por
pessoa quase nunca, porque ler 1h30 de prosa técnica sentado na frente do
editor compete com escrever código, e perde.

O read-aloud do navegador resolve isso: a spec passa a caber num deslocamento,
numa caminhada, num intervalo em que ninguém abriria o editor. O que falta é o
degrau entre `.specd/` e uma página que o navegador aceite ler em voz alta.

Existe uma ferramenta pronta que faz quase isso — `md-server`, do mesmo autor,
648 linhas — e a tentação é portá-la. A medição mostrou que portar dá a coisa
errada em dois pontos, e os dois são de desenho, não de detalhe.

## O que a medição mudou no desenho

```
.specd/ inteiro          43.407 palavras   85 arquivos   ≈ 4h50 @150wpm
├─ specs/                13.745 palavras   10 arquivos   ≈ 1h30
├─ changes/archive/      29.662 palavras   75 arquivos   ≈ 3h20   ← 68%
└─ changes/ abertas           0 palavras    0 arquivos

specs/: 2.170 linhas, das quais 448 são bloco ```yaml anchors  ← 21%
        107 blocos, um por requisito
```

**Primeiro: apontar para `.specd/` cru é a resposta errada.** Dois terços do
volume são task de change encerrada. Ninguém escuta `003-task-parser.md` de
uma change fechada no mês passado, e o custo de incluí-la não é espaço em
disco — é 3h20 de áudio entre a pessoa e o que ela queria ouvir. O default
coleta verdade realizada e o que está em voo; o arquivo morto entra por `--all`.

**Segundo: o modo leitura subtrai, onde o `--speech` do `md-server` adiciona.**
Lá, código virava `<p>` para o TTS ler linha a linha, e fazia sentido: o
objetivo era ouvir código. Aqui, cada requisito termina com um bloco de âncora
que lido em voz alta vira *"file dois pontos src barra cli barra index ponto ts,
symbol dois pontos register commands"* — cento e sete vezes, 21% do áudio.

A âncora responde **onde no código**, e essa pergunta não existe para quem está
ouvindo longe do editor. É anchor-necessary-not-sufficient pelo lado de que
pouco se fala: a âncora não é a spec, é o índice remissivo dela. Índice
remissivo não se lê em voz alta.

Subtrair, porém, não pode ser silencioso. Omissão sem marca é
absence-is-not-compliance na forma auditiva: quem ouve um requisito sem âncora
nenhuma não distingue "este requisito não tem âncora" de "a ferramenta tirou a
âncora daqui". Cada omissão deixa um marcador curto. `--full` desliga tudo.

## Um documento, não dez

O read-aloud do navegador para no fim da página. Dez arquivos servidos como dez
páginas são dez ciclos manuais de clicar-e-dar-play, o que destrói o uso
inteiro: a proposta é escutar, e escutar não sobrevive a interrupção a cada oito
minutos.

Um documento contínuo, com sumário no topo para saltar. A sidebar do
`md-server` vira sumário; a navegação entre páginas some.

## Servidor, e o que ele não é

Servidor local, com a URL impressa no terminal para clicar. A alternativa —
arquivo estático aberto em `file://` — foi descartada por incerteza: o
read-aloud de alguns navegadores é mais restrito em `file://` do que em `http`,
e não vale desenhar em cima de uma dúvida que só o uso resolve.

Isto é a coisa mais próxima de daemon que o specd já teve, e a distância
importa: processo em foreground, morre no Ctrl-C, não sobrevive à sessão, não
guarda estado. `read` não toca `verify`, então gate-no-network segue intacto —
e o servidor não fala com a rede de qualquer modo, só com o loopback.

Três restrições vêm junto e são requisito, não zelo:

- **Bind em `127.0.0.1`, nunca em `0.0.0.0`.** Servir spec de repositório
  privado numa interface que a rede local alcança é vazamento, e vazamento
  silencioso porque nada na tela distingue os dois binds.
- **Documento em memória, sem rota que leia arquivo.** Não é otimização: é o
  que torna travessia de caminho impossível por construção, em vez de
  impossível por sanitização correta. Servidor que aceita `/file/<path>` tem
  que acertar sempre; servidor sem rota de arquivo não tem o que errar.
- **Abrir navegador é `--open`.** Lançar aplicação fora do processo é operação
  que custa, e costly-ops-are-not-silent diz que ela se nomeia. O default
  imprime a URL — que é exatamente o que o autor pediu: clicar no terminal.

## Dependências: uma, não quatro

`md-server` usa `express`, `marked`, `ignore` e `open`. O specd tem duas deps
hoje, e triplicar a superfície para servir um HTML seria pagar caro por
conveniência:

| dep       | decisão                          | por quê                                                          |
| --------- | -------------------------------- | ---------------------------------------------------------------- |
| `express` | trocar por `node:http`           | servir um documento de memória são ~20 linhas de stdlib           |
| `ignore`  | não entra                        | `.specd/` é rastreado; pasta arbitrária pula `.git`/`node_modules` |
| `open`    | não entra                        | `child_process` com o abridor do sistema, atrás de `--open`        |
| `marked`  | **entra**                        | GFM correto não se improvisa, e errar render de tabela é ruído no áudio |

Uma dependência nova, declarada aqui porque dependência é custo e
costly-ops-are-not-silent vale para o `package.json` também.

## Escopo

### 1. Coleta

Default sem argumento: `.specd/specs/` mais as changes abertas, sem o archive.
Caminho explícito — arquivo ou diretório, um ou vários — substitui o default.
Conjunto vazio sai 2 em vez de servir página em branco.

### 2. Render de leitura

Frontmatter, bloco `yaml anchors` e fenced code saem, cada um deixando
marcador. Tabela vira lista, porque TTS lê tabela célula a célula sem
estrutura e o ouvinte perde o cabeçalho na terceira linha. `--full` desliga.

### 3. Documento único

Um HTML, ordem determinística, sumário no topo, heading por arquivo. O
cabeçalho diz quantos arquivos e quantas palavras — quem vai escutar merece
saber o tamanho antes de começar.

### 4. Servidor

`node:http` em `127.0.0.1`, documento de memória, `--port` troca a porta,
porta ocupada sai 2 nomeando a flag, SIGINT libera.

### 5. Comando

`specd read` na tabela de comandos, `--all`, `--full`, `--port`, `--open`.
Exit 0 ou 2, nunca 1: single-gate, e `read` não emite veredito sobre nada.

## Fora de escopo

**O grafo.** Âncora clicável indo ao símbolo, estado de resolução na tela,
cobertura visual — a exploração levantou isso e é um produto diferente, com
requisito diferente, que pertence a `verify` e não a `read`. `read` renderiza
prosa; não consulta o repositório, não resolve âncora, não sabe se a spec está
verde.

**Arquivo de código.** As trinta extensões do `md-server` não entram. Ouvir
código não é o caso de uso, e whitelist de extensão é superfície que só se
justifica com cliente real pedindo — config-only-on-divergence.

**Export estático.** `--out` gerando HTML no disco tem apelo — commitável,
publicável — e nada nesta change o impede depois. Não entra agora porque o
único uso declarado é escutar, e escutar já está atendido pelo servidor.

## O que fica aberto

**Idioma misto.** A prosa é portuguesa e o statement EARS é inglês por
REQ-EARS-002 — keyword é sintaxe, não prosa. O TTS escolhe uma voz por página e
vai ler `SHALL NOT invoke any language model` com fonética portuguesa. Marcar o
statement com `lang="en"` faz alguns leitores trocarem de voz, e outros
ignorarem.

Fica aberto por honestidade: não sei quais leitores respeitam, e não vou
escrever requisito sobre comportamento de terceiro que não medi —
absence-is-not-compliance vale para a evidência que sustenta um requisito, não
só para o dado que ele lê. Vira requisito quando o uso disser que incomoda, e
aí com medição junto.

**Ordem de escuta.** A ordem determinística é por caminho, que é arbitrária
para quem ouve — `anchors` antes de `cli` não é a ordem em que alguém quer
entender o produto. Ordem declarada em configuração seria a saída, e é botão
sem dois clientes divergindo até que alguém reclame.
