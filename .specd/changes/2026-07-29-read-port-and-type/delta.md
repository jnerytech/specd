---
change: 2026-07-29-read-port-and-type
target: [read]
---

# Delta — read-port-and-type

O segundo `specd read` sobe junto com o primeiro, porque quem escolhe a porta
passa a ser o sistema operacional. E o documento passa a ter a cara de um
Markdown renderizado, que é o que o leitor já reconhece.

## ADDED

### REQ-READ-009 — The operating system chooses the port unless one is asked for

**Capability.** read

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

**Capability.** read

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

## MODIFIED

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

## REMOVED

Nenhum.
