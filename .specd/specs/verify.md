---
capability: verify
retired: []
---

# Verify — o gate

Seis camadas ordenadas. As cinco primeiras são offline e agnósticas de stack; a última delega ao projeto.

### REQ-VER-001 — Ordered layer execution

**Statement.** The specd verifier SHALL execute layers in the fixed order provenance, schema, coverage, anchors, evidence, project, stopping at the first failing layer.

**Acceptance.**
- Falha em schema impede a execução de coverage
- Relatório indica a camada em que parou

```yaml anchors
- file: src/verify/index.ts
  symbol: "export const LAYER_ORDER"
```

### REQ-VER-002 — Layers are individually disableable

**Statement.** The specd verifier SHALL execute only the layers listed in `verify.levels` of the resolved configuration.

**Acceptance.**
- Camada ausente da lista não roda nem aparece no relatório
- Lista vazia faz `verify` sair com código 2 e mensagem de configuração inválida

```yaml anchors
- file: src/config/schema.ts
  symbol: "VerifyLevelsSchema"
```

### REQ-VER-003 — Provenance layer

**Statement.** WHEN a change directory exists, the specd verifier SHALL reject it if `explore/manifest.json` is absent or if any source marked required has a status other than `ok`.

**Acceptance.**
- Manifest ausente reprova
- Fonte required com status `failed` reprova e é nomeada no erro
- Fonte opcional falhada não reprova

```yaml anchors
- file: src/verify/layers/provenance.ts
  symbol: "export const provenanceLayer"
```

### REQ-VER-004 — Coverage layer

**Statement.** The specd verifier SHALL reject any change in which a requirement listed under ADDED or MODIFIED has no task referencing it.

**Acceptance.**
- REQ sem task apontando reprova
- Task apontando para REQ inexistente reprova na camada schema, não aqui

```yaml anchors
- file: src/verify/layers/coverage.ts
  symbol: "export const coverageLayer"
```

### REQ-VER-005 — Evidence layer

**Statement.** IF a task declares status `done`, THEN the specd verifier SHALL reject it when `evidence.commits` is empty.

**Acceptance.**
- Task `done` sem commits reprova
- SHA listado é validado como existente no repositório

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "export const evidenceLayer"
```

### REQ-VER-006 — Project layer delegates by argv

**Statement.** The specd verifier SHALL execute the configured `validation_command` as an argv array without a shell, propagating its exit code.

**Acceptance.**
- Comando é executado sem interpretação de shell
- Exit code diferente de zero reprova a camada

```yaml anchors
- file: src/verify/layers/project.ts
  symbol: "export const projectLayer"
```

### REQ-VER-009 — Project layer output reaches the report

**Statement.** The specd verifier SHALL record the stdout and stderr of the validation command in the layer report.

**Acceptance.**
- Saída do comando aparece no relatório mesmo quando a camada aprova
- Camada reprovada carrega a saída que explica a reprovação
- Nada é truncado em silêncio

```yaml anchors
- file: src/verify/layers/project.ts
  symbol: "export const projectLayer"
- file: src/verify/report.ts
  symbol: "export interface LayerReport"
```

### REQ-VER-007 — Fast mode

**Statement.** WHERE the `--fast` flag is present, the specd verifier SHALL skip the project layer.

**Acceptance.**
- `--fast` não executa `validation_command`
- Relatório marca a camada como pulada, não como aprovada

```yaml anchors
- file: src/verify/index.ts
  symbol: "export async function verify"
```

### REQ-VER-008 — Machine-readable report

**Statement.** WHERE the `--json` flag is present, the specd verifier SHALL emit the full result as JSON on stdout.

**Acceptance.**
- JSON contém camadas executadas, violações e severidade por item
- Saída humana vai para stderr quando `--json` está ativo

```yaml anchors
- file: src/verify/report.ts
  symbol: "export interface VerifyReport"
```
