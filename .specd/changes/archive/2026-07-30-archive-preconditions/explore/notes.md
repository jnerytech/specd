# Exploração — archive-preconditions

## Origem do escopo

Sem board neste repositório: `[board] provider` não está declarado em
`.specd/config.toml`. O escopo veio do achado 2 da run 013 e da decisão do autor
tomada em 2026-07-30: pré-condição do `archive` passa a ser as cinco camadas
offline configuradas, escopadas à change; `project` fica fora; arquivar a change
`2026-07-29-cycle-skills` só depois desta.

## Escopo

Ampliar as pré-condições de `specd archive` e declarar o escopo do diagnóstico
que elas leem.

## Não-escopo

- Achado 1 (`sync` quebrando no propose quando a change cria capability nova)
- Achado 3 (`explore` dizendo `usable` sem source declarada)
- A camada `project` como pré-condição
- Qualquer mudança no `verify`

Os achados 1 e 3 são decisões de desenho independentes. Misturá-las aqui impede
julgar qualquer uma.

## Mapa do código, com símbolos conferidos

- `src/archive/index.ts` :: `assertArchivable` — âncora atual de REQ-ARC-002.
  Roda `assertAllAnchorsResolved`, depois `coverageLayer` e `evidenceLayer` sobre
  um contexto com `effective.changes` reescrito para `[change]`.
- `src/verify/index.ts` :: `LAYER_ORDER` é `VERIFY_LEVELS`; `IMPLEMENTED` mapeia
  nome para camada; `selectLayers` filtra por `verify.levels` na ordem fixa.
  É daqui que sai a lista que o `archive` precisa passar a respeitar.
- `src/verify/layers/provenance.ts` :: `provenanceLayer` itera
  `ctx.effective.changes` e só cobra quando `requiresProvenance(config)`.
  Escopa limpo.
- `src/verify/layers/schema.ts` :: `schemaLayer` devolve
  `ctx.effective.diagnostics` inteiro, mais `checkRetiredReuse` (global sobre
  capabilities) e `checkDeclaredCard` (itera changes, escopa limpo).
- `src/parser/diagnostics.ts` :: `Diagnostic` tem `file` — "absolute or
  repository-relative path". É o campo pelo qual o escopo pode ser cortado.
- `src/archive/apply.ts` :: `planApplication` já sabe quais capabilities o delta
  toca; é de lá que sai a lista de arquivos que continuam valendo no corte.

## Requisitos existentes que tocam a área

Conferidos em `specd spec --json`, todos `origin: specs`:

- REQ-ARC-002 — declara as três pré-condições. É o requisito a modificar.
- REQ-ARC-009 — validação precede toda escrita; o movimento do diretório é a
  última operação. Não muda, e a mudança aqui roda antes dele.
- REQ-VER-001 — ordem fixa das camadas, parando na primeira que falha.
- REQ-VER-002 — só rodam as camadas de `verify.levels`.

REQ-ARC-014 e REQ-SYNC-017 existem hoje com `origin: delta`, na change
`2026-07-29-cycle-skills`, ainda aberta. Nenhuma das duas é tocada aqui — não há
conflito de reivindicação.

## Lacunas e riscos

- O corte de diagnóstico por `file` depende de o caminho ser relativo à raiz.
  `effectiveSpecs` é chamado com `pathsRelativeTo` em `verify`, `status` e
  `archive`; o comentário de `Diagnostic.file` admite as duas formas. Comparar
  por prefixo sem normalizar é a maneira óbvia de o corte errar em silêncio.
- Uma camada nova acrescentada ao `verify` no futuro passa a valer como
  pré-condição sem ninguém decidir, porque a lista vem de `verify.levels`. É o
  comportamento desejado — mas é uma decisão, não um efeito colateral, e por isso
  vira critério de aceite.
- `archive` sem `--sync` não toca a rede. Nenhuma das camadas offline muda isso;
  `project` mudaria, o que é uma razão a mais para deixá-la fora.

## Perguntas em aberto

Nenhuma. As duas que existiam — quais camadas, e o que fazer com a cycle-skills —
foram decididas pelo autor antes desta exploração.
