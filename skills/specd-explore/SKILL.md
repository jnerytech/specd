---
name: specd-explore
description: Abre uma change do specd e explora o que ela vai encostar — escopo, mapa do código, requisitos existentes, lacunas — gravando o resultado em explore/notes.md e, havendo board, coletando o card com `specd explore`. Use quando o usuário quiser começar uma mudança, investigar antes de propor, ou entender o que já existe sobre um assunto antes de escrever requisito.
requires_specd: ">=0.3.0"
---

# specd-explore

Primeiro passo do ciclo `explore → propose → apply → archive`. Abre a change e
produz o registro da exploração. **Não escreve delta, não altera código, não
transiciona nada no board.**

## Antes de qualquer coisa

```bash
specd --version
```

Se a versão for menor que a declarada em `requires_specd`, **pare** e diga qual
está instalada e qual é necessária. Uma skill que segue contra uma CLI velha
acaba reconstruindo à mão o que o comando ausente decidiria — que é exatamente o
erro que ela existe para evitar.

## 1. Ler o modo do repositório

```bash
specd status --json
```

O modo vem da configuração, nunca da aparência do repositório:

- `[board] provider` definido → **modo com board**
- ausente → **modo sem board**

`[board] card` diz se toda change precisa declarar o card de onde nasceu:
`required` (padrão onde há board) ou `optional`.

Nunca conclua "parece que aqui tem board". Isso é decidir o ciclo por
semelhança, e o princípio `no-guessing-on-conflict` proíbe.

## 2. Estabelecer o escopo

**Com board.** Resolver a tarefa é obrigatório quando `card = "required"`. Sem
card resolvido não há change. Se a busca devolver mais de um candidato plausível
ou nenhum, **pare e pergunte pela ferramenta de pergunta do host**, com os
candidatos como opções — não escolha "o mais parecido" nem siga sem card.

**Sem board.** O escopo vem da descrição de quem roda a skill, e é registrado em
`explore/notes.md` com a mesma cerimônia que uma issue teria. Escopo dito de
boca e não escrito não sobrevive à próxima sessão (`memory-is-ephemeral`).

## 3. Abrir a change

O nome é kebab-case com prefixo de data: `AAAA-MM-DD-escopo`. Crie
`.specd/changes/<nome>/proposal.md` com a frontmatter:

```yaml
---
change: 2026-08-01-escopo
status: active
card:
  ref: "4821"
  url: "https://board.example/issues/4821"
---
```

`card` só entra quando existe card. Onde `[board] card = "required"`, a camada
`schema` do gate reprova a change sem ele.

## 4. Ler a spec efetiva

```bash
specd spec --json
```

Isto é `.specd/specs/` com os deltas das changes abertas aplicados por cima.
Cada requisito traz `origin` (`specs` ou `delta`), `change` quando vem de delta,
e `source`.

**Nunca leia `.specd/specs/` e os deltas soltos para montar o overlay.** Ler um
arquivo que `specd spec` apontou é permitido; reconstruir a sobreposição não —
isso é reimplementar decisão fora da camada determinística.

## 5. Coletar o card, havendo board

```bash
specd explore <card> --change <nome>
```

O comando grava `explore/manifest.json` e um arquivo por fonte configurada.
Se a change declara um card e o argumento nomeia outro, ele para e cita os dois.

Board configurado e inalcançável — rede caída, credencial recusada, card
inexistente — é **falha**, não ausência. **Pare.** Não caia para o modo sem
board: "não consegui verificar" não é "verifiquei e está certo"
(`absence-is-not-compliance`).

Depois de rodar, leia o que o bundle diz ter coletado — a saída traz
`collected all | partial | none`, e o manifest carrega o mesmo campo.

**Com board configurado e `collected: none`, pare**, mesmo que o comando tenha
saído 0. Sair 0 ali significa só que nenhuma fonte declarada obrigatória falhou,
e isso é vacuamente verdadeiro quando nenhuma foi declarada. O repositório diz
ter board e o bundle não traz nada dele.

Diga qual dos dois casos é, lendo a lista de fontes do manifest:

- **nenhuma fonte declarada** — a configuração não pede coleta de board nenhuma;
  o problema é de `[[explore.sources]]`, não desta execução
- **as declaradas falharam** — nomeie o erro de cada uma

Não declare fonte por conta própria para resolver. Isso é configuração do
repositório, e o que cabe aqui é nomear o que falta e perguntar ao autor pela
ferramenta de pergunta do host.

Sem board configurado, `collected: none` não para nada: não há o que coletar, e
o escopo vem da descrição de quem roda a skill.

## 6. Explorar o código

Arquivos e símbolos que existem de fato, requisitos que já cobrem a região,
âncoras que já apontam para lá. Verifique cada REQ-ID no repositório antes de
citá-lo: identificador que não existe é pior que identificador ausente.

## 7. Escrever `explore/notes.md`

No diretório do bundle, ao lado do `manifest.json`. Registra:

- origem do escopo — referência do card, ou a descrição recebida
- escopo e **não-escopo**
- mapa do código, com símbolos verificados e caminho de arquivo
- requisitos existentes que tocam a área, citados por ID conferido
- lacunas, riscos e perguntas em aberto

Não carregue contagem — número de requisitos, de capabilities, de testes fica
errado na fatia seguinte. A fonte é `specd status`.

**Armadilha:** não achar requisito cobrindo a área não significa que a área está
descoberta. Lacuna encontrada é hipótese, e vale nas duas direções.

## Quando parar e perguntar

Use a ferramenta de pergunta do host, com opções concretas, sempre que:

- mais de um card plausível, ou nenhum
- duas changes abertas mexendo no mesmo requisito
- o escopo pedido contradiz requisito já realizado
- o nome da change colide com uma existente

Conflito para o ciclo. A skill não escolhe.
