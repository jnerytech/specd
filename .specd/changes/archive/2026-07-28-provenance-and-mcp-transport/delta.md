---
change: 2026-07-28-provenance-and-mcp-transport
target: [verify, explore, spec-format, anchors]
---

# Delta — provenance-and-mcp-transport

Fecha os três buracos que a change `archive-cycle-and-effective-specs` deixou: a camada `provenance` ampla demais
para ligar, o transporte MCP sem requisito, e o delta ilegível lido como delta
vazio.

Primeira change do specd gerenciada só pelo specd.

## ADDED

### REQ-VER-003 — Provenance layer

**Capability.** verify

**Statement.** WHEN a change directory exists and the configuration declares at least one required source, the specd verifier SHALL reject the change if `explore/manifest.json` is absent or if any required source has a status other than `ok`.

**Acceptance.**
- Configuração sem nenhuma fonte `required` não exige manifest de change nenhuma
- Manifest ausente com fonte required configurada reprova
- Fonte required com status diferente de `ok` reprova e é nomeada no erro
- Fonte opcional falhada não reprova
- Change escrita à mão, sem bundle, passa quando nada foi declarado como obrigatório

A condição de guarda é o que faltava. Como o requisito estava escrito, ele
exigia `explore/manifest.json` de toda change, o que reprova qualquer change
que não tenha nascido de um card — inclusive as duas que construíram esta
ferramenta. Provenance é sobre a procedência que o projeto declarou querer, e
projeto que não declarou fonte obrigatória não pediu procedência nenhuma.

```yaml anchors
- file: src/verify/layers/provenance.ts
  symbol: "export const provenanceLayer"
```

### REQ-EXP-009 — MCP collector reads the JSON response mode

**Capability.** explore

**Statement.** The specd explore command SHALL collect an `mcp` source over the JSON response mode only, reporting a source failure for any other transport.

**Acceptance.**
- Resposta `application/json` é coletada e persistida
- Resposta `text/event-stream` marca a fonte como falha e nomeia o transporte
- A mensagem diz que o modo não é suportado nesta versão, em vez de sugerir nova tentativa
- Nenhum payload parcial é gravado a partir de um stream

**SSE está fora de escopo, e este requisito é o registro disso.** Ler um stream
exigiria decidir quando ele terminou e o que fazer com resposta parcial — duas
decisões que valem uma change própria. Meia-implementação gravaria um payload
em que ninguém pode confiar, e anchor-necessary-not-sufficient diz que o pior sinal é o falso positivo de
trabalho pronto.

```yaml anchors
- file: src/explore/sources/mcp.ts
  symbol: "export const mcpCollector"
```

### REQ-FMT-009 — Unreadable delta content is rejected, never ignored

**Capability.** spec-format

**Statement.** IF a delta section contains content that is neither a requirement block nor a requirement identifier, THEN the specd parser SHALL reject the delta.

**Acceptance.**
- Seção `ADDED` ou `MODIFIED` com conteúdo e nenhum bloco de requisito reprova
- Item de lista citando identificador fora de qualquer bloco, em `ADDED` ou `MODIFIED`, reprova
- Seção `REMOVED` com linha que não é identificador reprova
- Seção sem conteúdo algum é aceita
- Marcador explícito de vazio — `Nenhum.` ou `None.` — é aceito em qualquer seção
- Prosa antes do primeiro bloco é aceita quando a seção tem ao menos um bloco

A distinção entre seção legitimamente vazia e seção que o parser não entende é
o requisito inteiro. Uma change sem remoções escreve `REMOVED` vazio e isso é
verdade; uma change cujo `ADDED` lista quarenta identificadores em bullets tem
conteúdo que o parser lê como nada, e ler nada como conformidade é o modo de
falha que a change `archive-cycle-and-effective-specs` expôs ao arquivar a change `verify-gate-and-anchor-ladder` sem verificar coisa alguma.

Mesma família da passagem vazia: ausência de dados apresentada como aprovação.

```yaml anchors
- file: src/parser/delta.ts
  symbol: "assertSectionReadable"
```

## MODIFIED

### REQ-ANC-003 — Repository-wide fallback search

**Statement.** WHEN a symbol is not found in its declared file, the specd anchor resolver SHALL search the repository for that symbol and attach the location as a suggestion if exactly one match exists.

**Acceptance.**
- Exatamente um match produz `dangling-with-suggestion` contendo o caminho encontrado
- Zero ou múltiplos matches produzem `dangling` sem sugestão
- A busca respeita `.gitignore`
- A busca ignora as árvores de spec, de change e de documentação do próprio repositório

O último critério documenta comportamento que já existia sem requisito. Toda
âncora com símbolo escreve esse símbolo literalmente na capability que a
declara, e um documento de desenho o cita de novo; sem a exclusão, uma âncora
pendurada é "encontrada" no arquivo que a declarou, e um match verdadeiro passa
por ambíguo. Código sem requisito é o começo de drift na direção contrária.

```yaml anchors
- file: src/anchors/search.ts
  symbol: "export function findSymbolInRepo"
- file: src/anchors/resolve.ts
  symbol: "SEARCH_EXCLUDE_PREFIXES"
```

## REMOVED

Nenhum.
