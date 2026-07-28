---
capability: explore
retired: []
---

# Explore — coleta determinística de contexto

A CLI busca as fontes configuradas e grava um bundle auditável. A síntese em draft é responsabilidade da skill, não da CLI.

### REQ-EXP-001 — Card identifier or URL

**Statement.** The specd explore command SHALL accept either a board card identifier or a card URL as its argument.

**Acceptance.**
- Identificador puro é resolvido usando `board.project` da configuração
- URL tem provider e identificador extraídos do próprio endereço

```yaml anchors
- file: src/explore/index.ts
  symbol: "export async function explore"
- file: src/explore/card-ref.ts
  symbol: "export function parseCardRef"
```

### REQ-EXP-002 — Four source types

**Statement.** The specd explore command SHALL support source types `board`, `git`, `mcp` and `http`.

**Acceptance.**
- Cada tipo tem implementação registrada em um mapa de coletores
- Tipo desconhecido no TOML produz erro de configuração

```yaml anchors
- file: src/explore/sources/index.ts
  symbol: "export const COLLECTORS"
```

### REQ-EXP-003 — Required sources gate the bundle

**Statement.** IF any source declared as required fails to collect, THEN the specd explore command SHALL exit non-zero without marking the bundle as usable.

**Acceptance.**
- Fonte required com erro de rede aborta o comando
- Fonte opcional falhada não aborta

```yaml anchors
- file: src/explore/index.ts
  symbol: "assertRequiredSources"
```

### REQ-EXP-008 — Manifest survives a blocked run

**Statement.** The specd explore command SHALL write the manifest before reporting a required-source failure.

**Acceptance.**
- Manifest existe no disco depois de rodada bloqueada por fonte obrigatória
- Status real por fonte é preservado, inclusive o da fonte que falhou
- Ordem é gravar e então falhar, nunca falhar e então gravar

```yaml anchors
- file: src/explore/index.ts
  symbol: "export async function explore"
```

### REQ-EXP-004 — Manifest records per-source status

**Statement.** The specd explore command SHALL write a `manifest.json` recording type, name, required flag, status, output path and error for every configured source.

**Acceptance.**
- Toda fonte configurada aparece no manifest, inclusive as que falharam
- Timestamp de coleta é registrado

```yaml anchors
- file: src/explore/manifest.ts
  symbol: "export interface ExploreManifest"
```

### REQ-EXP-005 — Redaction before persistence

**Statement.** WHEN a source declares a `redact` list, the specd explore command SHALL remove those fields from the payload before writing it to disk.

**Acceptance.**
- Campo listado não aparece no arquivo persistido
- Remoção ocorre antes da escrita, nunca depois
- Caminho de campo aninhado é suportado

```yaml anchors
- file: src/explore/redact.ts
  symbol: "export function redactPayload"
```

### REQ-EXP-006 — Bundle is versioned

**Statement.** The specd explore command SHALL write the bundle inside the change directory so that it is tracked by git.

**Acceptance.**
- Nenhuma entrada de `.gitignore` é criada para o bundle
- `init` registra o padrão do bundle como conteúdo gerado em `.gitattributes`

```yaml anchors
- file: src/explore/paths.ts
  symbol: "export function bundlePath"
- file: src/init/gitattributes.ts
  symbol: "GENERATED_PATTERNS"
```

### REQ-EXP-007 — Draft is not validated

**Statement.** The specd verifier SHALL NOT validate the content of `draft.md`.

**Acceptance.**
- Draft ausente não reprova nenhuma camada
- Draft malformado não reprova nenhuma camada

**Sem âncora, deliberadamente.** O requisito é negativo: ele exige que nada
valide `draft.md`. Não existe caminho de código onde essa ausência seja
realizada, e âncora que apontasse para o verificador resolveria sem provar
coisa alguma — âncora decorativa é pior que âncora ausente, porque troca um
silêncio honesto por um sinal falso de cobertura. P7. REQ-ANC-001 já torna a
âncora opcional.

### REQ-EXP-009 — MCP collector reads the JSON response mode

**Statement.** The specd explore command SHALL collect an `mcp` source over the JSON response mode only, reporting a source failure for any other transport.

**Acceptance.**
- Resposta `application/json` é coletada e persistida
- Resposta `text/event-stream` marca a fonte como falha e nomeia o transporte
- A mensagem diz que o modo não é suportado nesta versão, em vez de sugerir nova tentativa
- Nenhum payload parcial é gravado a partir de um stream

**SSE está fora de escopo, e este requisito é o registro disso.** Ler um stream
exigiria decidir quando ele terminou e o que fazer com resposta parcial — duas
decisões que valem uma change própria. Meia-implementação gravaria um payload
em que ninguém pode confiar, e P7 diz que o pior sinal é o falso positivo de
trabalho pronto.

```yaml anchors
- file: src/explore/sources/mcp.ts
  symbol: "export const mcpCollector"
```
