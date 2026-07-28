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

### REQ-VER-004 — Coverage layer

**Statement.** The specd verifier SHALL reject any change in which a requirement listed under ADDED or MODIFIED has no task referencing it.

**Acceptance.**
- REQ sem task apontando reprova
- Referência é o campo `req` do frontmatter da task, e nada mais
- Task em qualquer status conta como cobertura, inclusive `pending`
- Só tasks da própria change contam
- Requisito listado em `REMOVED` não exige task
- Task apontando para REQ inexistente reprova na camada schema, não aqui

```yaml anchors
- file: src/verify/layers/coverage.ts
  symbol: "export const coverageLayer"
```

### REQ-VER-005 — Evidence layer

**Statement.** IF a task declares status `done`, THEN the specd verifier SHALL reject it when `evidence.commits` is empty.

**Acceptance.**
- Task `done` sem commits reprova
- Task em qualquer outro status não é avaliada

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "export const evidenceLayer"
```

### REQ-VER-010 — Unreachable commit is reported, not rejected

**Statement.** IF a commit listed in `evidence.commits` is not reachable in the repository history, THEN the specd verifier SHALL report it as a warning.

**Acceptance.**
- SHA inalcançável produz warning e não reprova a camada
- Mensagem cita a task, o identificador e o SHA
- Squash, rebase e clone raso não reprovam o gate

Âncora prova que existe código agora; evidência prova que houve trabalho então.
São eixos diferentes, por P7. Um SHA que o histórico não alcança mais é sinal
degradado, não fraude: o fluxo de merge do projeto pode tê-lo reescrito. O que
permanece antifraude é `evidence.commits` vazio, que é declaração de trabalho
sem qualquer lastro, e esse continua reprovando por REQ-VER-005.

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "assertCommitsReachable"
```

### REQ-VER-011 — Evidence without history is operational

**Statement.** WHEN the repository history is unavailable, the specd verifier SHALL exit with code 2 instead of producing a verdict for the evidence layer.

**Acceptance.**
- Diretório sem `.git` acessível sai com código 2
- Mensagem distingue "não consegui verificar" de "verifiquei e reprovou"
- Nenhuma violação de evidência é reportada quando o histórico falta

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "requireGitHistory"
```

### REQ-VER-003 — Provenance layer

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
