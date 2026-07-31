---
name: specd-propose
description: Converte a exploração de uma change do specd em delta — requisitos completos em EARS, critérios de aceite e âncoras — e, havendo board, sincroniza a proposta com `specd sync` depois de mostrar o dry-run. Use quando o usuário quiser transformar o que foi explorado em proposta, escrever ou revisar o delta de uma change, ou registrar requisito novo antes de implementar.
requires_specd: ">=0.3.0"
---

# specd-propose

Segundo passo do ciclo. Transforma `explore/notes.md` em `delta.md`. **Não toca
no código e não escreve em `.specd/specs/`.**

## Antes de qualquer coisa

```bash
specd --version
```

Menor que `requires_specd` → **pare**, nomeando a instalada e a exigida.

## 1. Ler a exploração

`explore/notes.md` da change. Se o código mudou desde que ele foi escrito, o
explore está vencido: volte para `specd-explore` antes de propor. Explore
vencido é a forma mais barata de produzir proposta ancorada em símbolo que já
não existe.

## 2. Ler a spec efetiva

```bash
specd spec --json
```

É daqui que sai o que já existe. Nunca reconstrua o overlay lendo
`.specd/specs/` e os deltas soltos.

Todo REQ-ID citado é conferido nesta saída antes de entrar em qualquer texto.

## 3. Escrever o delta

`.specd/changes/<nome>/delta.md`:

````markdown
---
change: 2026-08-01-escopo
target: [capability-a, capability-b]
---

## ADDED

### REQ-XXX-001 — Título curto

**Capability.** capability-a

**Statement.** The specd <sujeito> SHALL <comportamento>.

**Acceptance.**

- critério verificável
- outro critério verificável

Prosa explicando por que, e o que foi medido. Não é decoração: é o que impede
a próxima pessoa de desfazer a decisão sem saber que existiu.

```yaml anchors
- file: src/modulo/arquivo.ts
  symbol: "export function nome"
```
````

Regras que o gate cobra:

- **Um `SHALL` por statement.** Dois comportamentos são dois requisitos.
- EARS: ubiquitous, event-driven (`WHEN`), state-driven (`WHILE`),
  unwanted-behaviour (`IF … THEN`), optional-feature (`WHERE`).
- `ADDED` declara `**Capability.**`; `MODIFIED` pode omitir — o destino é a
  capability que já contém o ID.
- `MODIFIED` carrega o texto **completo**, não um patch.
- `REMOVED` aceita só a lista de identificadores.
- Identificador aposentado nunca é reusado.
- A âncora é `file` obrigatório e `symbol` opcional, e o símbolo é procurado
  **literalmente**: `export async function f` e `export function f` são strings
  diferentes.

Âncora pode apontar para símbolo que ainda não existe. Com `origin: delta` isso
é warning, e é esse afrouxamento que torna possível propor antes de implementar.

### Revisar cada statement antes de seguir

Três perguntas mecânicas, por requisito escrito. Corrigir aqui é gratuito: o
requisito ainda é `origin: delta`, nenhuma task o cita, nenhuma âncora tem
histórico. Depois do archive o mesmo conserto é change própria com `MODIFIED`.

1. **Um assunto?** Um `SHALL` por statement — o gate já cobra isso. E nenhum
   critério de aceite descrevendo comportamento que o statement não menciona:
   "sai 0 sempre que consegue ler" com um critério sobre requisição de rede são
   dois requisitos escritos como um.
2. **A quantificação cabe no alcance da âncora?** Statement que diz "toda skill"
   com âncora num arquivo de skill afirma quatro coisas e verifica uma — apagar
   as outras três não move o gate. Ou a âncora cobre o que o statement
   quantifica, ou o statement fala do que a âncora alcança.
3. **Todo critério tem teste possível?** Não o teste escrito — o teste que dá
   para escrever. Critério que ninguém consegue verificar é prosa com marcador.

   Requisito sobre comportamento de skill é a exceção declarada: nenhuma
   asserção verifica que uma skill _faz três perguntas_, porque quem executa é
   um agente lendo markdown. Nesses, o teste possível é sobre o texto do
   `SKILL.md` — verificação fraca e honesta. É a mesma razão que põe o
   comportamento numa skill e não no CLI: julgamento no caminho de decisão é o
   que `no-llm-in-decision-path` proíbe. Aponte a exceção; não reprove o
   requisito por ser o que é.

O que essas três não resolverem vai ao autor pela ferramenta de pergunta do
host, com as opções concretas. A skill aponta; ela não reescreve enunciado por
conta própria, e não decide sozinha o que é bom enunciado.

Uma pergunta que **não** cabe aqui: "a âncora realiza o comportamento?". No
propose o símbolo pode não existir, e perguntar produziria resposta inventada.
Ela é da `specd-archive-change`.

## 4. Escrever as tasks

`tasks/NNN-nome.md`, uma por unidade de trabalho:

```yaml
---
id: "001-nome"
change: 2026-08-01-escopo
req: [REQ-XXX-001]
status: pending
evidence:
  commits: []
---
```

Todo requisito do delta precisa de pelo menos uma task que o cite, ou a camada
`coverage` reprova.

## 5. Conferir

```bash
specd verify --fast
```

Verde com warnings de âncora é o estado esperado de uma proposta: os símbolos
ainda não existem. Vermelho é problema de formato, e volta para o passo 3.

### Gravar o registro do propose

Depois do gate, porque o estado de âncora só existe depois dele. Grave em
`propose.json`, no diretório da change, um registro por requisito que o delta
declara:

```json
{
  "version": 1,
  "requirements": [
    {
      "id": "REQ-XXX-001",
      "statement": "…",
      "acceptance": ["…"],
      "anchors": [{ "file": "src/…", "symbol": "…", "resolved": false }]
    }
  ]
}
```

`statement`, `acceptance` e `anchors` são **copiados** de `specd spec --json`;
`resolved` vem do relatório do `specd verify`, que diz quais âncoras estão
penduradas. Não calcule nada, não resuma nada, não reescreva texto — o valor
deste arquivo é ser cópia.

Delta reescrito ainda aqui reescreve o registro. Requisito que o delta não
declara não entra.

É isto que dá referente ao recorte da `specd-archive-change`: nada mais no
repositório registra que uma âncora **esteve** pendurada, e sem esse dado a
revisão de lá vira leitura de tudo, todo archive.

## 6. Sincronizar com o board, havendo board

```bash
specd sync --dry-run --json
```

Mostre o plano ao autor **antes** de escrever qualquer coisa. `sync` reconcilia
a spec efetiva inteira: o plano pode conter itens de outras changes abertas, e
isso é dito em voz alta, não escondido.

Peça confirmação explícita pela ferramenta de pergunta do host. Só depois:

```bash
specd sync
```

Escrita em sistema de terceiro é anunciada antes de acontecer
(`costly-ops-are-not-silent`).

Board configurado e inalcançável → **pare**. Não proponha "seguir sem
sincronizar por enquanto" como se fosse equivalente.

Sem board, o passo não existe, e o delta sozinho é a proposta completa — o que
o obriga a ser legível também por gente.

## Quando parar e perguntar

Use a ferramenta de pergunta do host, com opções, sempre que:

- o requisito proposto contradiz um já realizado
- duas changes abertas tocam o mesmo identificador
- não está claro se é `ADDED` ou `MODIFIED`
- a âncora não tem um símbolo honesto para apontar

O delta é contrato. Contrato escrito no chute é pior que contrato ausente.
