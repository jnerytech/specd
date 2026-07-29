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
````

Todo requisito do delta precisa de pelo menos uma task que o cite, ou a camada
`coverage` reprova.

## 5. Conferir

```bash
specd verify --fast
```

Verde com warnings de âncora é o estado esperado de uma proposta: os símbolos
ainda não existem. Vermelho é problema de formato, e volta para o passo 3.

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
