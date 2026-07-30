---
capability: effective-spec
retired: []
---

### REQ-EFF-001 — The effective spec is a command, not a reconstruction

**Statement.** The specd spec command SHALL emit every requirement of the effective specification, being the capabilities under `.specd/specs/` with the deltas of the open changes applied over them.

**Acceptance.**

- Requisito presente só em `.specd/specs/` aparece uma vez
- Requisito de `ADDED` de change aberta aparece
- Requisito de `MODIFIED` aparece com o texto do delta, e não com o de `.specd/specs/`
- Identificador listado em `REMOVED` não aparece
- Diretório sem `.specd/` sai 2 nomeando o caminho procurado

`effectiveSpecs` já existe e já é a fonte de `verify`, `status`, `sync` e
`anchor fix`. O que falta é a saída. Sem ela, quem precisa da spec efetiva lê os
arquivos soltos e aplica o overlay de cabeça — e passa a existir uma segunda
implementação da regra, na camada que não é determinística.

```yaml anchors
- file: src/spec/index.ts
  symbol: "export function specReport"
```

### REQ-EFF-002 — Every requirement says where it is written

**Statement.** The specd spec command SHALL report, for every requirement it emits, whether it comes from the capabilities or from a delta, and the path of the file it was read from.

**Acceptance.**

- `origin` pertence a `specs | delta`
- `origin: delta` acompanha o nome da change que o declara
- `source` é caminho relativo à raiz do projeto
- `--json` carrega a mesma informação que a saída de texto

Origem não é metadado decorativo: é o que decide se âncora pendurada é erro ou
warning. Quem consome a spec efetiva sem saber a origem de cada requisito não
consegue distinguir drift de trabalho em voo, e a distinção é o produto.

```yaml anchors
- file: src/spec/index.ts
  symbol: "export interface SpecRecord"
```

### REQ-EFF-003 — The spec command informs and never judges

**Statement.** The specd spec command SHALL exit 0 whenever it can read the specification.

**Acceptance.**

- Âncora pendurada não muda o código de saída
- Requisito sem critério de aceite não muda o código de saída
- Falha de leitura sai 2, nunca 1

O statement dizia `regardless of anchors, coverage or evidence` — nomes de
camada que este comando não roda. A frase se lia como se ele as executasse e
ignorasse o resultado, quando o que ela queria dizer é que nada do que o gate
julga altera o código de saída daqui. O que sobrou diz isso sem nomear máquina
que não está em cena, e os critérios mostram as duas formas concretas.

O critério sobre rede saiu para REQ-EFF-004, que é o comportamento que ele
descrevia.

Mesma disciplina do `status`: comando que resume estado precisa ser seguro de
rodar dentro de hook, de prompt e de skill. Um segundo comando capaz de sair 1
quebra single-gate mesmo que ninguém o coloque no CI — porque alguém coloca.

```yaml anchors
- file: test/spec/exit-contract.test.ts
  symbol: "spec informs and never judges"
```

### REQ-EFF-004 — The spec command reads the disk and nothing else

**Statement.** The specd spec command SHALL read the specification from the filesystem without opening a network connection.

**Acceptance.**

- Nenhum módulo alcançável a partir do comando importa transporte de rede
- O teste de grafo de importação cobre o mesmo conjunto de transportes que o do gate

Isto era um critério de aceite de REQ-EFF-003, pendurado num requisito sobre
código de saída — dois comportamentos escritos como um. Separar é o conserto, e
não alargamento: o comportamento já era afirmado e já era testado, só estava no
lugar errado.

O requisito existe pela mesma razão que `gate-no-network` existe para o
`verify`: `spec` é feito para rodar dentro de hook, de prompt e de skill, e um
comando que abre rede nesses lugares falha por motivo que não é do repositório.

```yaml anchors
- file: test/spec/exit-contract.test.ts
  symbol: "reaches no network module"
```
