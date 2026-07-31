# Run 001 — diagnóstico contra a Fatia 3

- **Quando:** 2026-07-28
- **Versão avaliada:** specd ao fim da Fatia 3
- **Alvo:** `sandbox/sample05` — ERP .NET real, 206 arquivos, 171 `.cs`, 1 `.sln`,
  12 `.csproj`, par `legacy/` + `modernized/` com tipos de mesmo nome nos dois lados.
- **Veredito:** dentro de `sandbox/` a busca de fallback vê zero arquivos, e o gate
  fica verde com a rede de segurança desligada sem dizer nada.

> Registro imutável. Descreve o que foi observado naquele momento, com aquela
> versão. O que foi resolvido depois está registrado no run que resolveu.

---

## Resumo

| # | O que | Veredito |
| --- | --- | --- |
| 1 | `specd init` detecta a stack | **Falhou.** Não reconhece `.sln` nem `.csproj` |
| 2 | 10 requisitos EARS escritos a partir do código | Passam no `schema` sem ajuste |
| 3 | `specd anchor suggest` | **Inútil.** 15 candidatas, 0 utilizáveis, 15 ambíguas |
| 4 | `specd verify` com âncoras confirmadas à mão | **Verde**, 10/10 resolvem |
| 5 | Ambiguidade legacy/modernized | Recusa a sugestão — **certo**, mas ver §"por acidente" |

E o achado que engole os outros: **dentro de `sandbox/`, a busca de fallback vê
zero arquivos.** O gate ficou verde com a rede de segurança desligada e não
disse nada.

---

## 1. `specd init` — REQ-CFG-005 reprova

```
$ specd init
Wrote .specd/config.toml
Created .specd/specs/
Created .specd/changes/
Created .specd/archive/
No build manifest recognised — fill in verify.validation_command by hand.
```

**Deixou o campo comentado**, e o repositório tem `GymErp.sln` na raiz e 12
`.csproj`. `src/init/detect-stack.ts` conhece exatamente cinco manifestos:
`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`. Não conhece
`.sln`, `.csproj`, `Makefile`, `build.gradle`, `*.cabal`, `mix.exs`.

REQ-CFG-005 diz *"SHALL propose a `validation_command` matching the build
manifests found in the repository"*. Havia manifesto; ele não propôs. É
reprovação do requisito, não lacuna de escopo — e a mensagem *"No build manifest
recognised"* é factualmente falsa.

Deixar comentado em vez de chutar é a decisão certa depois de falhar. O erro é
falhar.

### Dois defeitos que apareceram no mesmo comando

**`init` cria `.specd/archive/`; `archive` escreve em `.specd/changes/archive/`.**
`src/init/index.ts:24` cria um diretório que nada lê, e o destino real
(REQ-ARC-006, `ARCHIVE_DIRECTORY` em `src/verify/changes.ts:10`) fica dentro de
`changes/`. Todo projeto novo nasce com uma pasta órfã.

**O template do config descreve política que não existe mais.** O comentário
gerado diz:

```
# graduated — a dangling anchor is a warning while its requirement is in the
#             active change delta, and an error otherwise
```

REQ-ANC-006 foi reescrito na Fatia 2: gradua por origem, e "active change delta"
deixou de existir. O `init` ensina o Modelo A a todo projeto que ele cria.

**E o template oferece três camadas de seis.** `levels = ["schema", "anchors",
"project"]`. `provenance`, `coverage` e `evidence` estão implementadas desde a
Fatia 3 e não são oferecidas. Projeto novo nasce com metade do gate desligado e
sem saber.

---

## 2. Dez requisitos EARS a partir do código

Escritos lendo `modernized/GymErp/Tenant/`, o agregado `Enrollment`, a máquina
de estados e `HttpRetryPolicy`. Prosa em português, keywords em inglês.

| ID | Comportamento | Onde |
| --- | --- | --- |
| REQ-TEN-001 | Contexto EF por requisição, registrado e limpo no fim | `TenantEFMiddleware.cs` |
| REQ-TEN-002 | Tenant resolvido por HTTP com bearer | `HttpTenantLocatorStrategy.cs` |
| REQ-TEN-003 | Accessor solta o tenant no dispose | `TenantAccessor.cs` |
| REQ-TEN-004 | Connection string vem da seção `DatabaseConnection` | `PostgresTenantStringConnection.cs` |
| REQ-ENR-001 | Cliente validado antes da matrícula existir | `Enrollment.cs` |
| REQ-ENR-002 | Matrícula nasce suspensa, com evento de criação | `Enrollment.cs` |
| REQ-ENR-003 | Transição delegada ao objeto de estado | `EnrollmentState.cs`, `SuspendedState.cs` |
| REQ-ENR-004 | Repositório legado carrega aluno e plano junto | `legacy/.../EnrollmentRepository.cs` |
| REQ-RES-001 | Só 408/502/503/504 são repetidos | `HttpRetryPolicy.cs` |
| REQ-RES-002 | Backoff exponencial, no máximo cinco tentativas | `HttpRetryPolicy.cs` |

A camada `schema` aceitou os dez sem retoque: cinco padrões EARS, um `SHALL`
por statement, prefixos `TEN`/`ENR`/`RES` casando com `tenancy`/`enrollment`/
`resilience` pela regra de subsequência. Nada a relatar — funcionou.

---

## 3. `anchor suggest` — inútil neste repositório

```
REQ            cand únicas  ambíg
REQ-TEN-001       1      0      1
REQ-TEN-002       1      0      1
REQ-TEN-003       3      0      3
REQ-TEN-004       2      0      2
REQ-ENR-001       1      0      1
REQ-ENR-002       2      0      2
REQ-ENR-003       3      0      3
REQ-ENR-004       0      0      0
REQ-RES-001       1      0      1
REQ-RES-002       1      0      1
TOTAL            15      0     15
```

**Zero sinal.** Quinze candidatas, nenhuma com match único, todas descartadas
como ambíguas. Uma delas: o termo `GymErp` com **119 matches**, incluindo
`.cursor/rules/architecture-rule.mdc`, `GymErp.sln` e vinte arquivos de teste.

O extrator de termos pega o nome do produto do statement e busca por ele. Num
repositório onde o nome do produto é o namespace raiz, isso casa com tudo. Não é
ruído no relatório — é o relatório inteiro.

REQ-ENR-004 teve **zero** candidatas: o statement fala de "Gymerp legacy
enrollment repository" e nenhum termo extraído sobreviveu ao filtro.

---

## 4. `specd verify` com âncoras à mão — verde

```
ok   schema: passed (0 errors, 0 warnings)
ok   anchors: passed (0 errors, 0 warnings)
verify: passed
```

Dez âncoras, dez resolvidas, todas no passo 3 (grep no arquivo declarado).
`specd status`: `3 capabilities, 10 requirements, 0 dangling anchors`.

---

## 5. O par legacy/modernized

Quebrei duas âncoras de propósito para forçar o passo 5.

**REQ-ENR-004 — ambiguidade verdadeira.** `public class EnrollmentRepository`
existe em `legacy/Gymerp.Infrastructure/Repositories/` e em
`modernized/GymErp/Domain/Subscriptions/Aggreates/Enrollments/`. Dois matches
genuínos:

```
error [REQ-ENR-004] … (ladder step 5). The symbol was not found anywhere
in the repository, or matched in more than one place.
```

Recusou a sugestão. **Correto, e pelo motivo certo.** É exatamente o cenário que
REQ-ANC-003 descreve, e o único caso da rodada em que a ferramenta se comportou
como o desenho previa sob pressão.

**REQ-TEN-003 — recusou também, e não devia.** `public class TenantAccessor` é
único no repositório. Deveria produzir `dangling-with-suggestion` apontando
`modernized/GymErp/Tenant/TenantAccessor.cs`. Produziu `dangling` puro, porque a
busca achou **dois**:

```
modernized/GymErp/Tenant/TenantAccessor.cs:3
  public class TenantAccessor : IDisposable
modernized/GymErp/Tenant/TenantAccessorRegisterMiddleware.cs:6
  public class TenantAccessorRegisterMiddleware(
```

`TenantAccessor` é **prefixo** de `TenantAccessorRegisterMiddleware`. A busca
casa substring, não identificador.

---

## O que a ferramenta fez errado

1. **`detect-stack` não conhece .NET.** Cinco ecossistemas conhecidos, e nenhum
   deles é o do repositório. REQ-CFG-005 reprovado com manifesto na raiz.

2. **A busca de fallback vê zero arquivos dentro de `sandbox/`.**
   `sandbox/*` está no `.gitignore` do specd e sample05 não tem `.git` próprio.
   `git ls-files --cached --others --exclude-standard` devolve **0**. O fallback
   manual em `walk()` só dispara quando o git *falha*; aqui ele sucede e devolve
   vazio. Resultado: passo 5 morto, `anchor suggest` mudo, e o gate verde sem
   avisar que a rede de segurança não existe.

   Mesma família da passagem vazia que a Fatia 2 corrigiu: ausência de dados
   apresentada como conformidade. Só que agora dentro do diferencial do produto.

3. **A busca casa substring, não identificador.** `TenantAccessor` colide com
   `TenantAccessorRegisterMiddleware`. Concreto, não hipotético, e num repo de
   171 arquivos há mais colisões esperando.

4. **A busca casa menção, não declaração.** Num teste isolado, procurar
   `ApplicationDbContext` devolveu `private readonly ApplicationDbContext
   _context;` — um uso — como localização do símbolo. E procurar um símbolo C#
   inexistente sugeriu um arquivo `.ts` que continha o nome numa string. Não há
   nenhuma noção de "arquivo de código na linguagem certa".

5. **`anchor suggest` produz 15 candidatas e 0 utilizáveis.** O extrator pega o
   nome do produto e casa com o repositório inteiro.

6. **`init` cria `.specd/archive/`, que nada lê.** O archive real mora em
   `.specd/changes/archive/`.

7. **O template do `init` documenta a política de âncora do Modelo A** e oferece
   três das seis camadas.

---

## O que ela fez certo por acidente

**A recusa de sugestão em REQ-TEN-003.** O resultado é o que se quer — não
sugerir quando não há certeza — mas a causa é a colisão de prefixo, não
ambiguidade real. Se a busca fosse consciente de fronteira de palavra, teria
sugerido corretamente. A ferramenta acertou porque erra de um jeito conservador.

**O verde do `verify` dentro do `sandbox/`.** As dez âncoras resolvem de fato,
no passo 3, lendo o sistema de arquivos direto. Mas o verde não distingue "todas
as âncoras resolvem" de "todas resolvem e, se alguma quebrasse, eu saberia onde
procurar". Nesse diretório a segunda metade é falsa e o relatório não diz.

**A ambiguidade legacy/modernized.** Certa e pelo motivo certo — registro aqui
só porque é o único caso da rodada em que isso aconteceu.

---

## Onde ela pediu decisão que a spec deveria ter tomado

**Qual é a raiz do repositório.** REQ-ANC-001 diz que `file` é resolvido a partir
da raiz. Nada define raiz. Na prática é o `cwd`, e a busca de fallback usa
`git ls-files` a partir dele — duas definições diferentes de "repositório" no
mesmo comando, e elas divergem exatamente no caso deste sandbox. A spec deveria
dizer se a raiz é o `cwd`, o diretório com `.specd/`, ou o toplevel do git.

**O que a busca de fallback deve enxergar.** REQ-ANC-003 tem um único critério
sobre isso — *"a busca respeita `.gitignore`"* — e nenhum sobre o que fazer
quando o resultado é vazio, nem sobre quais extensões contam como código. Aqui
"respeitar o `.gitignore`" e "enxergar o repositório" entraram em conflito
direto, e o requisito não diz qual ganha.

**O que conta como match.** Substring, identificador, ou declaração? A spec não
escolhe. `EXTENSION_STRATEGIES` fixa grep para formatos de dado e delega o resto
ao `anchors.default`, mas nenhum requisito diz o que grep significa.

**Se o gate deve reportar capacidade degradada.** Zero arquivos visíveis é um
estado que a ferramenta conhece e não conta. Nenhum requisito pede.

---

## `.cs` precisa de treesitter?

**Não. Grep dá conta, e o que falta não é sintaxe de C#.**

No passo 3 — presença do símbolo no arquivo declarado — grep acertou 10 de 10,
inclusive nos casos que o C# moderno tem de irregular:

- construtor primário: âncora `public class TenantEfMiddleware` casa
  `public class TenantEfMiddleware(` na linha seguinte
- `record` posicional: `public record GetTenantResponse(...)` casa
- sobrecarga: `public static Result<Enrollment> Create` aparece duas vezes no
  mesmo arquivo e o passo 3 só precisa de presença
- namespace com escopo de arquivo e com chaves: irrelevante para grep

Os dois defeitos reais não são de linguagem:

| defeito | corrige com | precisa de treesitter? |
| --- | --- | --- |
| `TenantAccessor` casa `TenantAccessorRegisterMiddleware` | fronteira de palavra na busca | não |
| uso confundido com declaração | prefixo de declaração já embutido na âncora, ou filtro de extensão | não |

O primeiro é uma linha de regex. O segundo já é mitigado pela convenção que este
repositório adotou sem requisito: a âncora carrega `public class X`, não `X`. Em
sample05, todas as dez âncoras seguem essa forma e nenhuma casou uso.

Onde treesitter ganharia de verdade: `partial class` espalhada por vários
arquivos, e distinguir declaração de menção sem exigir que o autor escreva o
prefixo. Nenhum dos dois aparece aqui. Cobrar uma dependência de gramática WASM
por isso contraria REQ-CLI-006, e o ganho seria menor que o de consertar a
fronteira de palavra.

**Recomendação:** manter grep como única estratégia e gastar o esforço na busca
de fallback — que é onde os quatro defeitos moram.

---

## Ordem que eu atacaria

1. **Visibilidade de arquivos na busca.** Sem isso o diferencial não funciona em
   nenhum diretório ignorado pelo repositório pai, e ninguém é avisado.
2. **Fronteira de palavra.** Uma linha, e mata a colisão de prefixo.
3. **`detect-stack` para .NET e Makefile.** É a primeira coisa que um usuário
   novo vê falhar.
4. **`init` — `.specd/archive/`, template do graduated, camadas oferecidas.**
   Três correções de texto e uma de caminho.
5. **`anchor suggest` — extrator de termos.** O mais caro, e o menos urgente:
   ele não bloqueia ninguém, só não ajuda.

