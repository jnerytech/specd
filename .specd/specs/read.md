---
capability: read
retired: []
---

### REQ-READ-001 — The default selection leaves the archive out

**Statement.** WHEN invoked with no path argument, the specd read command SHALL collect the capability files under `.specd/specs/` together with the Markdown of every open change, leaving the archived changes out.

**Acceptance.**

- Todo `.md` de `.specd/specs/` entra
- Todo `.md` de change não arquivada entra
- Nada sob `.specd/changes/archive/` entra sem `--all`
- `--all` inclui o archive na coleta
- Diretório sem `.specd/` sai 2 nomeando o caminho procurado

Dois terços do volume de `.specd/` são task de change encerrada: 29.662
palavras contra 13.745 das capabilities. O default ingênuo põe 3h20 de áudio
entre a pessoa e o que ela queria ouvir, e o custo de errar aqui não é uma
listagem feia — é a ferramenta ser inútil para o único uso que a justifica.

O archive continua alcançável, porque quem quer ouvir a história de uma change
encerrada tem um motivo legítimo. Ele deixa de ser o default, que é diferente de
deixar de existir.

```yaml anchors
- file: src/read/collect.ts
  symbol: "export function collectDefault"
```

### REQ-READ-002 — Explicit paths replace the default selection

**Statement.** WHERE one or more paths are given, the specd read command SHALL collect the Markdown from those paths instead of the default selection, accepting a file or a directory in any position.

**Acceptance.**

- Caminho de arquivo `.md` entra sozinho, sem varredura de diretório
- Caminho de diretório entra recursivamente, e só arquivos `.md`
- Vários caminhos entram na ordem em que foram escritos
- Caminho inexistente ou ilegível sai 2 nomeando o caminho
- Conjunto coletado vazio sai 2, e nenhum documento é servido
- `--all` não tem efeito quando há caminho explícito

Conjunto vazio saindo 2 é absence-is-not-compliance: servir uma página em
branco responde "pronto, aqui está" a uma pergunta que a ferramenta não
conseguiu responder. Quem apontou para a pasta errada precisa saber que apontou
para a pasta errada, e um documento sem conteúdo lê como pasta sem conteúdo.

`--all` não fazer nada aqui é deliberado: ele nomeia uma exclusão que só o
default aplica. Flag que muda de significado conforme o argumento é botão que
mente.

```yaml anchors
- file: src/read/collect.ts
  symbol: "export function collectPaths"
```

### REQ-READ-003 — One document, in deterministic order

**Statement.** The specd read command SHALL render every collected file into a single HTML document in a deterministic order, each file preceded by a heading naming its path relative to the repository.

**Acceptance.**

- Documento único: ouvir tudo não exige navegar entre páginas
- Duas execuções sobre o mesmo conjunto produzem HTML idêntico
- No default, `.specd/specs/` vem antes das changes abertas; dentro de cada grupo, ordem de caminho
- Sumário no topo com um link por arquivo
- O topo declara quantos arquivos e quantas palavras o documento tem

Documento único é o requisito inteiro, não uma preferência de layout: o
read-aloud do navegador para no fim da página, então dez arquivos em dez páginas
são dez interrupções, e escutar não sobrevive a isso. A sidebar que a ferramenta
de origem tinha vira sumário, e a navegação some.

A contagem de palavras existe porque quem vai escutar está decidindo se cabe no
tempo que tem. Número de arquivos não responde isso — 85 arquivos podem ser vinte
minutos ou cinco horas.

```yaml anchors
- file: src/read/document.ts
  symbol: "export function buildDocument"
```

### REQ-READ-004 — What is not prose is replaced by a marker

**Statement.** The specd read command SHALL replace the YAML frontmatter, the `yaml anchors` blocks and every other fenced code block with a short marker naming what was left out.

**Acceptance.**

- Frontmatter não aparece como texto lido
- Bloco marcado `yaml anchors` não aparece como texto lido
- Qualquer outro fenced code não aparece como texto lido
- Cada omissão deixa marcador curto dizendo o que foi tirado
- Tabela vira lista, um item por linha, cada item nomeando as colunas
- `--full` desliga toda omissão e renderiza o Markdown inteiro

21% das linhas das specs são bloco de âncora — 448 de 2.170, em 107 blocos. Em
voz alta viram `file dois pontos src barra cli barra index ponto ts` uma vez por
requisito. A âncora responde **onde no código**, e essa pergunta não existe para
quem ouve longe do editor: é anchor-necessary-not-sufficient pelo lado menos
citado, o de que âncora é índice remissivo da spec, e índice remissivo não se lê
em voz alta.

O marcador é o que separa isto de mentir. Requisito lido sem nenhuma âncora e
requisito cuja âncora foi removida pela ferramenta soam idênticos, e um deles é
falso — absence-is-not-compliance na forma auditiva, onde o ouvinte não tem o
diff para conferir.

Tabela vira lista porque TTS lê célula a célula sem repetir o cabeçalho: na
terceira linha ninguém lembra qual coluna está ouvindo.

```yaml anchors
- file: src/read/render.ts
  symbol: "export function renderForReading"
```

### REQ-READ-005 — The server binds to loopback and serves from memory

**Statement.** The specd read command SHALL serve the document over HTTP bound to the loopback address, from memory, without exposing any route that reads the filesystem at request time.

**Acceptance.**

- Bind em `127.0.0.1`; nunca em `0.0.0.0` nem em endereço de interface
- Nenhuma rota lê arquivo durante o atendimento da requisição
- Porta pedida por `--port` e já ocupada sai 2, nomeando a porta e a flag
- SIGINT encerra o processo e libera a porta
- Nenhuma requisição sai da máquina

O bind é requisito e não configuração porque os dois modos são
indistinguíveis na tela e muito distintos na consequência: `0.0.0.0` publica a
spec de um repositório privado para a rede local, e nada na saída do comando
denunciaria isso.

Servir de memória não é otimização. É o que torna travessia de caminho
impossível por construção em vez de impossível por sanitização correta — uma
rota `/file/<path>` precisa acertar todas as vezes, e uma ausência de rota não
tem o que errar. A ferramenta de origem tinha essa rota; aqui ela não é
necessária, porque o documento é um só.

O critério de porta ocupada passa a valer só quando a porta foi **pedida**.
Pedir uma porta específica e não conseguir é falha, e o comando tem que dizer.
Não pedir nenhuma e o sistema escolher não é falha nenhuma, e era o que
REQ-READ-009 destravou.

```yaml anchors
- file: src/read/server.ts
  symbol: "export function serveDocument"
```

### REQ-READ-006 — Opening the browser is asked for, never assumed

**Statement.** WHERE the `--open` flag is given, the specd read command SHALL launch the system browser on the served URL after that URL has been printed.

**Acceptance.**

- Sem `--open`, nenhum navegador é lançado e a URL é impressa em stdout
- Com `--open`, a saída nomeia a abertura antes de ela acontecer
- A URL é impressa também quando `--open` é usado
- Falha ao lançar o navegador não derruba o servidor: reporta e segue servindo

Lançar aplicação fora do processo é operação que custa, e
costly-ops-are-not-silent diz que ela para e se nomeia em vez de acontecer de
lado. O default imprime a URL para clicar no terminal, que é o gesto pedido — e
que já resolve o caso sem lançar nada.

Falha de abertura não derrubar o servidor é a mesma regra de REQ-ARC-012 numa
escala menor: o trabalho bom já está feito, o documento está servido e a URL
está na tela. Desistir dele porque o abridor do sistema não existe destrói o que
funcionou por causa do que era conveniência.

```yaml anchors
- file: src/read/server.ts
  symbol: "export function openInBrowser"
```

### REQ-READ-007 — The EARS statement is marked as English

**Statement.** The specd read command SHALL mark every statement paragraph with an English language attribute, inside a document declared as Portuguese.

**Acceptance.**

- Parágrafo iniciado por `**Statement.**` sai com `lang="en"`
- O elemento raiz do documento declara `lang="pt-BR"`
- Prosa em volta do statement não recebe marcação
- A marcação vale nos dois modos, com e sem `--full`
- Leitor que ignora o atributo recebe o mesmo texto, sem nada a mais para ler

REQ-EARS-002 diz que a keyword é sintaxe e não prosa: o statement é inglês por
contrato, dentro de um documento cuja prosa é portuguesa. O TTS escolhe uma voz
por página, então sem marcação `SHALL NOT invoke any language model` sai com
fonética portuguesa uma vez por requisito.

O parágrafo é reconhecido pelo marcador `**Statement.**` que REQ-FMT-006 já
exige — não por detecção de idioma, que seria julgamento semântico e é
exatamente o que no-llm-in-decision-path mantém fora daqui. O marcador existe,
é obrigatório, e é determinístico.

**O que este requisito não promete.** Trocar de voz é decisão do leitor de
terceiro, e nem todos honram o atributo. O critério de aceite é sobre o que o
specd escreve, não sobre o que o navegador faz com isso —
absence-is-not-compliance aplicado à própria evidência: prometer troca de voz
seria reivindicar um comportamento que este repositório não pode verificar. O
leitor que ignora não perde nada, e é isso que torna a marcação segura de
escrever sem a medição.

**Medido em 2026-07-29: o leitor testado ignora o atributo.** A voz não mudou
no statement. A marcação fica, e fica exatamente pelo motivo que este parágrafo
já dava antes de haver medição: ela não acrescenta nada audível, então o custo
de manter é zero e o benefício aparece em qualquer leitor que a honre. O que a
medição mostra não é que o requisito estava errado — é que o requisito estava
escrito no escopo certo. Um critério de aceite sobre troca de voz teria acabado
de reprovar por comportamento de terceiro.

```yaml anchors
- file: src/read/render.ts
  symbol: "markStatementLanguage"
```

### REQ-READ-008 — The reader chooses light or dark, without scripting

**Statement.** The specd read command SHALL render a theme control that switches the document between light and dark without any scripting.

**Acceptance.**

- O documento abre no tema declarado pelo sistema
- O controle troca para claro e para escuro sem recarregar a página
- Nenhum JavaScript é usado para a troca
- O controle aparece uma vez, no cabeçalho, antes do conteúdo
- Trocar o tema não acrescenta nem remove nada do texto que será lido

Seguir o sistema sozinho não é ajustável: quem lê de noite num sistema claro, ou
de dia num sistema escuro, não tem como pedir o contrário — e ler texto longo é
exatamente onde essa preferência deixa de ser estética.

Sem JavaScript pelo mesmo motivo de REQ-READ-003: o leitor de tela opera sobre o
DOM entregue, e página que muda de estado por script é página cuja leitura
depende de o script ter rodado. A troca sai de estado de formulário e seletor
CSS, que o navegador resolve antes de entregar.

O controle acrescentar zero ao texto lido é critério e não detalhe: um seletor
de tema no meio do conteúdo seria lido em voz alta a cada arquivo, que é a mesma
falha que REQ-READ-004 corrige nos blocos de âncora.

```yaml anchors
- file: src/read/document.ts
  symbol: "themeControl"
```

### REQ-READ-009 — The operating system chooses the port unless one is asked for

**Statement.** WHEN no port is given, the specd read command SHALL bind to a port assigned by the operating system.

**Acceptance.**

- Sem `--port`, o comando sobe mesmo com outra instância do `specd read` viva
- A porta efetivamente ligada aparece na URL impressa
- Duas execuções simultâneas recebem portas diferentes e ambas respondem
- Nenhum intervalo de portas é sorteado, e nenhuma tentativa é repetida
- `--port` continua ligando exatamente na porta pedida

Ler duas coisas ao mesmo tempo é o uso normal: a spec num terminal e uma pasta
de notas no outro. Com porta fixa o segundo comando morre em `EADDRINUSE`
mandando escolher outra à mão — um erro correto e inútil, porque nomeia um
problema que a máquina resolve sozinha.

Sorteio num intervalo foi recusado: mesma URL imprevisível da efêmera, mais
código, e ainda podendo falhar por azar. Sortear onde existe resposta
determinística é adivinhar com passos extras, e no-guessing-on-conflict é a
disciplina de que a ferramenta não escolhe no escuro quando há uma resposta
certa disponível.

**O que se perde, declarado:** a URL muda a cada execução, então bookmark não
sobrevive a reiniciar. É preço aceito e não descuido — a URL é impressa toda
vez por REQ-READ-006, e o gesto é clicar no terminal.

```yaml anchors
- file: src/read/server.ts
  symbol: "EPHEMERAL_PORT"
```

### REQ-READ-010 — The document is typeset like a rendered Markdown page

**Statement.** The specd read command SHALL typeset the document with the system interface font stack that Markdown previews use, and monospace only where the source was monospace.

**Acceptance.**

- O corpo usa pilha de fonte de sistema sem serifa, com fallback declarado
- Trecho que era `código` no Markdown sai em monoespaçada
- Nenhuma fonte é buscada na rede: só famílias instaladas ou genéricas
- A escolha de fonte não depende de qual das duas pilhas o sistema tem — o
  fallback termina em `sans-serif` e em `monospace`

Ler a spec no navegador e ler o mesmo arquivo no preview do GitHub têm que
parecer a mesma atividade. Serifa não é errado, e é diferente o bastante para
custar meio segundo de reorientação a cada arquivo — que é caro num documento
que existe para ser percorrido.

Nenhuma fonte vem da rede, e isso é requisito e não zelo: `read` serve no
loopback e nada sai da máquina por REQ-READ-005. Um `@font-face` remoto abriria
exatamente o furo que aquele requisito fecha, e abriria pelo caminho que
ninguém inspeciona, que é o CSS.

**O que este requisito não promete.** Igualdade com o GitHub. A pilha de fontes
deles muda quando eles quiserem, e afirmar paridade seria reivindicar um fato de
terceiro que este repositório não verifica — a mesma linha que REQ-READ-007
traçou sobre troca de voz. O critério é sobre a pilha que o specd escreve, que é
local, é checável, e é a que os previews de Markdown usam.

```yaml anchors
- file: src/read/document.ts
  symbol: "FONT_STACK"
```
