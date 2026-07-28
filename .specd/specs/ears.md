---
capability: ears
retired: []
---

# EARS — gramática de statement

Validação sintática dos requisitos segundo os cinco padrões EARS.

### REQ-EARS-001 — Five accepted patterns

**Statement.** The specd EARS parser SHALL accept exactly five statement patterns: ubiquitous, event-driven, state-driven, unwanted-behaviour and optional-feature.

**Acceptance.**
- `The X SHALL Y` aceito como ubiquitous
- `WHEN a the X SHALL Y` aceito como event-driven
- `WHILE a the X SHALL Y` aceito como state-driven
- `IF a THEN the X SHALL Y` aceito como unwanted-behaviour
- `WHERE a the X SHALL Y` aceito como optional-feature

```yaml anchors
- file: src/ears/patterns.ts
  symbol: "export const EARS_PATTERNS"
```

### REQ-EARS-002 — Keywords are syntax, not prose

**Statement.** The specd EARS parser SHALL match keywords in English regardless of the language configured for requirement prose.

**Acceptance.**
- Statement com keywords inglesas e prosa em português é aceito
- Keyword traduzida (`QUANDO`, `DEVE`) é rejeitada com mensagem explicativa

```yaml anchors
- file: src/ears/patterns.ts
  symbol: "KEYWORDS"
- file: src/ears/parse.ts
  symbol: "export function parseStatement"
```

### REQ-EARS-003 — One SHALL clause per statement

**Statement.** IF a statement contains more than one `SHALL` clause, THEN the specd EARS parser SHALL reject it and report that the requirement must be split.

**Acceptance.**
- Dois `SHALL` no mesmo statement reprovam
- Mensagem sugere a divisão em requisitos separados
- `SHALL` entre crases é menção da keyword, não cláusula, e não conta
- A checagem conta cláusulas `SHALL` e nada mais

**O que esta checagem não prova.** Ela é sintática. Statement de cláusula única pode descrever mais de um comportamento e passar — basta coordenar o segundo comportamento numa oração subordinada. O parser não detecta isso, e nenhuma checagem determinística detectaria sem julgamento semântico, que P1 mantém fora do caminho de decisão.

O sinal humano é a razão entre critérios de aceite e cláusulas do statement: critério que não se apoia em nenhuma cláusula é comportamento que o requisito não reivindica. Vale revisão, não reprovação automática.

```yaml anchors
- file: src/ears/parse.ts
  symbol: "assertSingleShall"
```

### REQ-EARS-004 — Missing SHALL is rejected

**Statement.** The specd EARS parser SHALL reject any statement that does not contain the keyword `SHALL`.

**Acceptance.**
- Statement descritivo sem `SHALL` reprova na camada schema
- Mensagem lista os cinco padrões válidos

```yaml anchors
- file: src/ears/parse.ts
  symbol: "assertShallPresent"
```

### REQ-EARS-005 — Pattern is reported

**Statement.** WHEN a statement is successfully parsed, the specd EARS parser SHALL record which of the five patterns matched.

**Acceptance.**
- Modelo interno do requisito carrega o padrão identificado
- `specd status` consegue agregar requisitos por padrão

```yaml anchors
- file: src/ears/parse.ts
  symbol: "export interface ParsedStatement"
```
