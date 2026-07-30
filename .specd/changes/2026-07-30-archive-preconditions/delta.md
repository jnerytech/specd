---
change: 2026-07-30-archive-preconditions
target: [archive]
---

# Delta — archive-preconditions

O `archive` passa a ler as camadas offline que o projeto configurou, e a declarar
de qual diagnóstico ele se responsabiliza.

## ADDED

### REQ-ARC-015 — The precondition reads this change and what it rewrites

**Capability.** archive

**Statement.** The specd archive command SHALL evaluate its preconditions over the diagnostics of the change being archived and of the capabilities its delta rewrites, ignoring the diagnostics of every other open change.

**Acceptance.**

- Delta ilegível de outra change aberta não impede este arquivamento
- Capability de destino ilegível impede, porque é nela que a escrita acontece
- Diagnóstico do diretório da change impede, qualquer que seja o arquivo dentro dele
- O corte compara caminhos normalizados, e um caminho absoluto casa com o mesmo caminho relativo à raiz

`assertArchivable` já entrega um contexto com uma change só, e `provenance` e a
checagem de card iteram a lista de changes — as duas escapam limpo. O que não
escapa é `effective.diagnostics`, que carrega o que os parsers acharam em todo
lugar. Passado como está, um delta quebrado numa change que ninguém está
arquivando bloqueia este arquivamento, e isso não é rigor: é acoplamento entre
trabalhos que o Modelo B deixou deliberadamente independentes.

O corte é simétrico ao que o comando faz. Ele escreve nas capabilities de destino
e move o diretório desta change; então exige que esses arquivos estejam legíveis,
e não julga os que não toca.

A normalização está no critério porque `Diagnostic.file` admite caminho absoluto
ou relativo à raiz, e comparar prefixo sem normalizar é a forma silenciosa de o
corte errar — deixando passar o que devia bloquear.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function scopedDiagnostics"
```

## MODIFIED

### REQ-ARC-002 — Preconditions gate the operation

**Statement.** The specd archive command SHALL exit with code 2 without writing anything when the change fails any offline layer listed in `verify.levels`.

**Acceptance.**

- Requisito em `ADDED` ou `MODIFIED` sem task apontando aborta, por REQ-VER-004
- Task `done` com `evidence.commits` vazio aborta, por REQ-VER-005
- Âncora pendurada de requisito afetado aborta, por REQ-ANC-007
- Change sem manifesto de explore aborta onde o projeto declara fonte obrigatória, por REQ-VER-003
- Change cuja frontmatter ou delta não passa no schema aborta, por REQ-FMT-011
- Camada ausente de `verify.levels` não é exigida, por REQ-VER-002
- A camada `project` nunca é exigida, mesmo listada em `verify.levels`
- A recusa por âncora pendurada vale mesmo com `anchors` fora de `verify.levels`, porque REQ-ANC-007 independe da política
- Requisito que a retomada já aplicou palavra por palavra não aborta, por REQ-ARC-010
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- Mensagem nomeia `specd verify` como o lugar do veredito

Arquivar promove requisito de `origin: delta` para `origin: specs`, e com isso
transforma warning de âncora em erro. É a operação mais cara do ciclo. Fazê-la
com três das seis camadas lidas é assumir dívida de manutenção sobre coisa que
ninguém verificou — e a run 013 mediu o caso: uma change sem manifesto de explore
foi arquivada enquanto o `verify`, no mesmo repositório e no mesmo instante,
reprovava por ela.

A lista vem de `verify.levels` em vez de ser escrita aqui de novo. Duas listas
das mesmas camadas são duas chances de discordar, e exigir no `archive` uma
camada que o projeto desligou seria um segundo portão entrando por outra porta —
o que single-gate proíbe.

REQ-ARC-010 continua valendo por cima desta checagem, e a implementação mediu por
quê: um `archive` interrompido entre escrever a capability e mover o diretório
deixa a change de volta em aberto com o requisito já em `.specd/specs/` — estado
que a camada `schema` reporta como "ADDED mas já existe". Ler o schema sem essa
exceção tornaria toda retomada impossível, trocando um defeito por outro pior.
O diagnóstico é dispensado só para o identificador cujo texto já está aplicado
palavra por palavra, que é o mesmo conjunto que REQ-ARC-010 chama de
`alreadyApplied`.

A âncora continua sendo checada por REQ-ANC-007 e não pela camada `anchors`: a
camada gradua por origem e devolve warning para requisito de delta, que é
exatamente o caso de toda change sendo arquivada. A checagem do `archive` é mais
dura de propósito, e por isso não depende de a camada estar ligada.

`project` fica fora, e fica fora por decisão. Ela executa o `validation_command`
do projeto: dentro do `archive` isso duplicaria o `verify` inteiro, cobraria
minutos numa operação que já é cara, e daria ao comando a única forma de falhar
que não é sobre a spec. Quem quer o veredito completo roda `specd verify`, que é
onde ele mora.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function assertArchivable"
```
