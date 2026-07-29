# Regras de Negócio — specd

## Sobre este documento

`specd` não é uma aplicação de negócio no sentido tradicional: não há
usuários finais, não há banco de dados de domínio, não há multi-tenant. É
uma CLI de spec-driven development cujo produto é um **gate determinístico**
— um comando que decide, com exit code, se um requisito de especificação
ainda está honestamente ligado ao código que o realiza.

Por isso as "regras de negócio" deste repositório são de uma natureza
específica: são as regras de **validação, workflow e integridade** que a
própria ferramenta impõe a si mesma e ao repositório que ela audita. Elas
estão documentadas com um rigor incomum para uma CLI porque são o produto —
descritas em `CLAUDE.md` como nove princípios invioláveis (P1–P9), cada um
testado por arquitetura ou por comportamento, e detalhadas requisito a
requisito em `.specd/specs/*.md` na notação EARS. Este documento consolida
essas regras nas categorias pedidas, com referência aos requisitos
(`REQ-XXX-NNN`) e símbolos de código que as realizam.

---

## 1. Regras de Validação / Validação de Entrada

### 1.1 Gramática EARS dos requisitos (capability `ears`)

Todo statement de requisito em `.specd/specs/` ou em `delta.md` de uma
change precisa casar com exatamente um dos cinco padrões EARS aceitos,
definidos em `src/ears/patterns.ts` (`EARS_PATTERNS`) e exigidos por
**REQ-EARS-001**:

| Padrão                   | Forma                                                |
| ------------------------ | ---------------------------------------------------- |
| Ubíquo                   | `The <system> SHALL <response>`                      |
| Orientado a evento       | `WHEN <trigger>, the <system> SHALL <response>`      |
| Orientado a estado       | `WHILE <state>, the <system> SHALL <response>`       |
| Comportamento indesejado | `IF <condition>, THEN the <system> SHALL <response>` |
| Feature opcional         | `WHERE <feature>, the <system> SHALL <response>`     |

Regras derivadas, todas verificadas na camada `schema` do `verify`:

- **Keywords são sintaxe, não prosa (REQ-EARS-002).** `WHEN`, `WHILE`,
  `IF`, `THEN`, `WHERE`, `SHALL` são sempre em inglês maiúsculo,
  independentemente do idioma da prosa do requisito (`KEYWORDS` em
  `src/ears/patterns.ts`). Uma keyword traduzida (`QUANDO`, `DEVE`,
  `ENTÃO`, etc. — listadas em `TRANSLATED_KEYWORDS`) é rejeitada com
  mensagem explicativa, não silenciosamente ignorada: o autor escreveu a
  intenção certa na sintaxe errada, e o erro precisa dizer isso.
- **Uma única cláusula `SHALL` por statement (REQ-EARS-003).** Dois
  `SHALL` no mesmo statement reprovam, com mensagem sugerindo dividir em
  requisitos separados (`assertSingleShall` em `src/ears/parse.ts`).
  `SHALL` entre crases (menção da keyword, não cláusula) não conta. A
  checagem é sintática por desenho — reconhece que não detecta dois
  comportamentos coordenados numa oração subordinada, porque isso exigiria
  julgamento semântico, e P1 proíbe julgamento semântico no caminho de
  decisão.
- **`SHALL` é obrigatório (REQ-EARS-004).** Statement descritivo sem
  `SHALL` reprova na camada `schema`, com mensagem listando os cinco
  padrões válidos (`assertShallPresent`).
- **O padrão identificado é registrado (REQ-EARS-005)**, para que
  `specd status` possa agregar requisitos por padrão.

### 1.2 Formato do identificador de requisito

`src/parser/requirement-id.ts` define o formato canônico e único aceito:

```
REQ_ID_PATTERN = /^REQ-[A-Z][A-Z0-9]*-\d{3}$/
```

Ou seja: `REQ-<PREFIXO>-<NNN>`, prefixo em maiúsculas começando por letra,
três dígitos no final (ex.: `REQ-AUTH-003`). Regras associadas:

- O prefixo não precisa ser igual ao nome da capability, mas divergência
  gera aviso. Um prefixo é aceito como abreviação da capability quando suas
  letras aparecem em ordem dentro do nome da capability
  (`isPrefixAbbreviationOf`) — isso aceita `ANC` para `anchors`, `CFG` para
  `config`, `FMT` para `spec-format`, mas sinaliza `AUTH` dentro de uma
  capability chamada `billing`.
- **Identificador retirado nunca é reutilizado (REQ-FMT-004).** A camada
  `schema` (`checkRetiredReuse` em `src/verify/layers/schema.ts`) varre
  toda a spec efetiva (specs + deltas de changes abertas) atrás de um
  identificador que alguma capability listou em `retired` reaparecendo como
  requisito ativo — seja na própria capability, seja em outra, seja num
  delta novo. Uma referência escrita antes da retirada não pode passar a
  resolver para comportamento diferente silenciosamente.

### 1.3 Validação da camada `provenance` (REQ-VER-003)

Se a configuração declara pelo menos uma fonte de exploração como
`required`, toda change precisa de `explore/manifest.json` presente e com
todas as fontes obrigatórias em status `ok` (`src/verify/layers/provenance.ts`,
`requiresProvenance`, `checkChange`). Fonte opcional falhada não reprova.
Change sem nenhuma fonte declarada como obrigatória não é exigida a ter
manifest algum — a condição de guarda existe precisamente para não reprovar
changes escritas à mão sem bundle de exploração.

### 1.4 Validação da camada `coverage` (REQ-VER-004)

Todo requisito listado sob `ADDED` ou `MODIFIED` no `delta.md` de uma
change precisa ter pelo menos uma task da mesma change referenciando-o pelo
campo `req` do frontmatter (`src/verify/layers/coverage.ts`). Regras
precisas:

- A referência é só o campo `req`; menção em prosa não conta.
- Task em qualquer status conta, inclusive `pending` — coverage pergunta se
  o trabalho está planejado, não se está concluído (isso é a camada
  `evidence`).
- Só tasks da própria change contam.
- Requisito sob `REMOVED` não exige task, porque remover é o que `archive`
  faz, não trabalho que alguém agenda.
- Task apontando para um `REQ` inexistente reprova na camada `schema`, não
  aqui.

### 1.5 Validação da camada `evidence` (REQ-VER-005, REQ-VER-010, REQ-VER-011)

Task com `status: done` precisa de `evidence.commits` não vazio
(`src/verify/layers/evidence.ts`). Um SHA listado que o histórico git não
alcança mais produz **warning**, não reprovação — squash, rebase e clone
raso podem tornar um commit inalcançável sem que o trabalho tenha sido
fraudado; o que continua reprovando é a ausência total de lastro
(`evidence.commits` vazio). Repositório sem `.git` acessível não produz
veredito algum: sai com código 2 (`requireGitHistory`), porque "não
consegui verificar" é operacionalmente diferente de "verifiquei e
reprovou".

### 1.6 Validação da camada `anchors`

Ver seção 3.3 (âncoras têm componente forte de workflow, não só de
validação de forma).

---

## 2. Autorização / Controle de Acesso

`specd` não tem modelo de autorização no sentido tradicional (não há
usuários, papéis, permissões por operação). É uma CLI local que roda com os
privilégios do processo que a invoca. O que existe de mais próximo de
"controle de acesso" está concentrado em dois pontos: **quem pode disparar
escrita em sistema externo** e **como o segredo dessa escrita é obtido**.

### 2.1 Segredo do board só vem de variável de ambiente (REQ-SYNC-008)

`specd sync` lê a credencial do board exclusivamente da variável de
ambiente nomeada por `board.token_env` na configuração
(`src/sync/adapters/redmine.ts`, `createRedmineAdapter`). Regras:

- Token literal escrito em `config.toml` é rejeitado já no carregamento da
  configuração, antes mesmo do `sync` rodar.
  variável de ambiente ausente sai com código 2 antes de qualquer
  requisição de rede.
- A mensagem de erro nomeia a variável, nunca imprime o valor.
- O token nunca aparece em relatório, log ou mensagem de erro.

A racional declarada em `CLAUDE.md`: a única forma confiável de um segredo
não vazar num arquivo versionado é ele nunca ter estado lá.

### 2.2 Escrita externa é sempre manual, nunca automática (REQ-SYNC-001, P9)

`specd sync` é o único comando que escreve num sistema de terceiro (board
de gestão, ex. Redmine), e ele só escreve quando invocado diretamente por
uma pessoa:

- Nenhum evento instalado por `specd hooks install` chama `sync`. Há um
  teste de arquitetura garantindo que nada alcançável a partir de
  `src/hooks/run.ts` importa `src/sync/`.
- Falha de `sync` sai com código **2**, nunca **1** — reprovação de
  qualidade (código 1) é exclusiva de `verify` (P2). `sync` não é gate.

A justificativa citada em `CLAUDE.md`: hook roda sem ninguém olhando, e
escrita em sistema de terceiro sem supervisão é equivalente a apagar
trabalho alheio e descobrir uma semana depois. Leitura (o gate) pode ser
automática porque é reversível por natureza; escrita externa exige que
alguém esteja olhando no momento em que ela acontece.

### 2.3 Superfície de acoplamento é a interface do adaptador (REQ-SYNC-002)

Nenhum módulo fora de `src/sync/adapters/` pode citar Redmine, endpoint ou
verbo HTTP — todo acesso ao board passa pela interface `BoardAdapter`
(`src/sync/adapter.ts`), que declara quatro escritas (`create`, `update`,
`link`, `close`) e duas leituras (`read`, `describeFields`). Isso não é
autorização no sentido de controle de acesso a dados, mas é o mecanismo que
impede que qualquer parte do código fora do adaptador decida, por conta
própria, o que escrever no sistema externo.

### 2.4 Propriedade de campo é declarada, não negociada (REQ-SYNC-003)

A spec é dona de título, conteúdo e hierarquia; o board é dono de situação,
responsável e iteração (`FIELD_OWNERSHIP` em `src/sync/merge.ts`). Um campo
do board alterado fora dessa lista nunca é sobrescrito por `sync`. A única
exceção — `close`, a única escrita de situação que `specd` realiza — só
ocorre para item cujo requisito foi arquivado, e ainda assim relê o board
depois de escrever para confirmar que a situação de fato mudou (ver seção
5.2, P8 aplicado à escrita).

---

## 3. Lógica de Negócio / Regras de Workflow

### 3.1 Contrato de exit code — a regra central do produto

| Código | Significado                                          |
| ------ | ---------------------------------------------------- |
| 0      | Sucesso                                              |
| 1      | Gate reprovou — a spec ou o código estão errados     |
| 2      | Falha operacional — rede, I/O, configuração inválida |

Este é o contrato mais estrito do produto, formalizado em dois princípios:

- **P2 — Um único gate.** Só `specd verify` retorna 1 por reprovação de
  qualidade. Qualquer outro comando (`sync`, `anchor fix`, `explore`) que
  falhe operacionalmente sai com 2, nunca 1.
- O contrato existe para que CI possa distinguir "a spec reprovou" de "a
  ferramenta quebrou" — **REQ-VER-013** é o exemplo mais concreto: um
  `validation_command` cujo executável não existe (ex.: `dotnet` não
  instalado) sai 2, não 1, porque a spec não está errada — a ferramenta que
  a verificaria é que não pôde rodar. Comando que existe e retorna
  não-zero, ao contrário, continua saindo 1, porque ali é veredito de
  verdade.

### 3.2 As seis camadas ordenadas do gate `verify` (REQ-VER-001, REQ-VER-002)

`src/verify/index.ts` (`LAYER_ORDER`) executa as camadas em ordem fixa,
parando na primeira que falhar:

1. **provenance** — a change tem a procedência que o projeto declarou
   exigir? (REQ-VER-003)
2. **schema** — spec e deltas obedecem à gramática (EARS, formato de ID,
   frontmatter de task)? (schema layer, REQ-FMT-004)
3. **coverage** — todo requisito `ADDED`/`MODIFIED` tem task que o
   reivindica? (REQ-VER-004)
4. **anchors** — toda âncora declarada ainda resolve no código? (REQ-ANC-*)
5. **evidence** — toda task `done` tem commit de lastro? (REQ-VER-005)
6. **project** — o `validation_command` do próprio projeto passa? (delega
   a `npm run verify`, `dotnet test`, etc. — REQ-VER-006)

As cinco primeiras são offline e agnósticas de stack (**P3** — o gate nunca
acessa rede, testado por arquitetura); só a sexta delega a uma ferramenta
externa do projeto auditado. Cada camada pode ser individualmente
desabilitada via `verify.levels` na configuração, mas uma lista vazia é
configuração inválida e sai com código 2 (REQ-VER-002) — desligar tudo não
é uma forma válida de "passar".

`--fast` pula só a camada `project` (REQ-VER-007), reportando-a como
"pulada", nunca como "aprovada" — distinção que importa porque um relatório
que confunde as duas mentiria sobre o que foi checado (instância de P8).
`--json` (REQ-VER-008) emite o relatório completo em stdout, com saída
humana redirecionada a stderr.

### 3.3 Escada de resolução de âncoras — o coração do produto (REQ-ANC-002)

Uma âncora (`{file, symbol?}`, **REQ-ANC-001**) é avaliada por uma escada
determinística de cinco passos, e a primeira que casar decide o resultado
(`src/anchors/resolve.ts`, `resolveAnchor`):

1. Arquivo não existe → `dangling`.
2. Âncora sem `symbol`, arquivo existe → `resolved`.
3. Estratégia grep encontra a string → `resolved`.
4. Estratégia treesitter encontra a declaração → `resolved` (mas v1 só
   implementa grep; pedir `treesitter` é erro de configuração legível,
   REQ-ANC-005 — nenhuma dependência de gramática WASM entra no bundle).
5. Busca no repositório inteiro → `dangling-with-suggestion` (exatamente um
   match) ou `dangling` (zero ou mais de um match).

Regras de workflow que decorrem da escada:

- **Match é por identificador, não substring (REQ-ANC-010).**
  `TenantAccessor` não casa `TenantAccessorRegisterMiddleware`; o símbolo
  precisa estar delimitado por caracteres que não pertencem a um
  identificador. Isso é medido contra um caso real que produzia falso
  conflito.
- **A busca de fallback (passo 5) exclui as árvores de spec, change e
  documentação do próprio repositório (REQ-ANC-003)** — sem isso, uma
  âncora pendurada "se encontra" no arquivo que a declarou, e um match
  verdadeiro em outro lugar vira ambíguo por engano.
- **Estratégia por extensão (REQ-ANC-004).** `.yml` sempre usa grep mesmo
  com `anchors.default = treesitter`; extensão não mapeada usa o default.
- **Política graduada por origem, não por consulta a "change ativa"
  (REQ-ANC-006).** Âncora pendurada em `.specd/specs/` é **erro** (drift em
  verdade realizada); a mesma âncora pendurada em delta de change aberta é
  **warning** (trabalho ainda em voo). `strict` força erro nos dois casos;
  `lenient` força warning nos dois. Nenhuma decisão consulta qual change
  está "ativa" — isso seria escolher entre várias changes abertas, e é
  adivinhação proibida por P4.
- **`archive` não tolera nada (REQ-ANC-007).** Independente da política
  configurada, `archive` rejeita a operação se qualquer âncora de qualquer
  requisito afetado (`ADDED`/`MODIFIED`) estiver pendurada. `lenient` não
  amolece isso.
- **`anchor fix` reescreve mas não commita (REQ-ANC-008, P9).** Quando o
  requisito tem sugestão da escada, `fixAnchor` reescreve o arquivo de
  capability no disco e deixa a mudança fora do índice git — nenhum commit
  automático. Âncora sem sugestão faz o comando sair 2: é recusa de agir,
  não veredito.
- **Listagem cai para varredura de filesystem quando git devolve zero
  arquivos (REQ-ANC-009).** `git ls-files` bem-sucedido com zero resultados
  não é "repositório vazio" — é o listador cego (ex.: diretório ignorado
  pelo repositório pai). Isso derrubaria o passo 5 inteiro sem acusar nada,
  então há fallback explícito para caminhada de filesystem, respeitando
  `.gitignore` e pulando `.git`, `node_modules`, diretórios de build.
- **Sugestão descarta termos que casam demais (REQ-ANC-011).** Termo que
  casa acima de `TERM_FILE_CEILING` arquivos não é símbolo, é namespace —
  não vira sugestão mesmo sem alternativa melhor.
- **`anchor suggest --file` lista declarações reais em vez de inventar
  nomes (REQ-ANC-012).** Nunca compõe um símbolo a partir de palavras da
  prosa do requisito (isso seria adivinhação, P4); lista o que o arquivo
  declara literalmente, e o autor escolhe.

### 3.4 Sincronização com board externo — merge de três vias

- **Hash sobre projeção normalizada, não payload bruto (REQ-SYNC-004).**
  `null`, `[]` e string vazia normalizam para "ausente", de forma que o
  formato que o servidor devolve não produz conflito falso quando o
  conteúdo não mudou.
- **Conflito nunca é resolvido automaticamente (REQ-SYNC-005, P4).** Se
  spec e board mudaram desde o hash sincronizado e mudaram de formas
  diferentes, `sync` sai 2 listando item, campo e os dois valores, sem
  escrever em nenhum lado — nem nos itens sem conflito da mesma execução
  (falha é tudo-ou-nada por change, não parcial).
- **Mapeamento de nível para tipo de item, com colapso explícito
  (REQ-SYNC-006).** Nível sem mapeamento e sem regra de colapso sai 2
  nomeando o nível — ausência de regra não é regra (aplicação direta de
  P4/P8). Configurável porque P5 exige: dois clientes reais (planejamento
  por capability vs. por requisito) realmente divergem.
- **Ligação vive no frontmatter da capability (REQ-SYNC-007).** `ref`,
  `url`, `synced_at`, `synced_hash` moram junto do requisito que
  descrevem, nunca num arquivo separado que se perderia.
- **Nome de campo por id e por name, divergência é conflito
  (REQ-SYNC-009).** Se ambos configurados e o board reporta nome diferente
  do `id` configurado, sai 2 mostrando os dois valores — sem escrever.
- **Rodar duas vezes seguidas não muda nada (REQ-SYNC-012).** Sem mudança
  desde o hash sincronizado, nenhuma escrita ocorre em nenhum lado, e
  `synced_at` não é reescrito à toa — reescrevê-lo sujaria o diff sem
  informar nada.
- **Timestamp do board só filtra a varredura, nunca decide (REQ-SYNC-013).**
  A decisão de mudança vem exclusivamente do `synced_hash`; o timestamp
  `updated_on` do Redmine move quando a hierarquia muda mesmo sem o
  conteúdo mudar, e usá-lo como base produziria conflito fantasma toda vez
  que alguém reordena o board.
- **Fechamento de item exige morte declarada e ausência de corpo
  reaparecendo (REQ-SYNC-014, REQ-SYNC-015, P9).** `sync` só fecha um item
  do board quando (a) o identificador que o liga está em `retired` no
  frontmatter da capability e (b) nenhum item planejado sem ligação carrega
  o mesmo corpo. Se um identificador retirado tem corpo idêntico
  reaparecendo em item planejado (renomeação disfarçada de remoção, porque
  o delta não tem vocabulário para renomear), `sync` **não fecha nada** —
  sai 2 nomeando os dois identificadores como candidatos a rename e listando
  as saídas disponíveis (trocar a chave da ligação, ou declarar retirada de
  verdade). Órfã não declarada de nenhuma forma também sai 2, nunca fecha
  por suposição.
- **Morte proposta (em change aberta, ainda não arquivada) deixa o item em
  paz (REQ-SYNC-016).** Identificador sob `REMOVED` de uma change aberta
  não fecha o card e não bloqueia a execução — é reportado como "pending
  retirement" no relatório. Só depois do `archive`, quando o identificador
  passa para `retired` de fato, é que REQ-SYNC-014 volta a valer.

---

## 4. Restrições de Dados

- **ID de requisito:** `^REQ-[A-Z][A-Z0-9]*-\d{3}$` — prefixo maiúsculo
  iniciando por letra, três dígitos finais (`src/parser/requirement-id.ts`).
- **Statement de requisito:** deve casar exatamente um dos cinco padrões
  EARS; exatamente uma cláusula `SHALL`/`SHALL NOT` fora de crases
  (`src/ears/patterns.ts`, `src/ears/parse.ts`).
- **Keywords EARS:** sempre em inglês maiúsculo — `WHEN`, `WHILE`, `IF`,
  `THEN`, `WHERE`, `SHALL` — independentemente do idioma da prosa.
- **Âncora:** `{file}` obrigatório, `{symbol}` opcional; `{symbol}` sem
  `file` é inválido (REQ-ANC-001). `file` é resolvido a partir da raiz do
  projeto.
- **`evidence.commits`:** obrigatoriamente não-vazio para toda task com
  `status: done` (REQ-VER-005); SHA precisa ser alcançável no histórico
  para não gerar warning (REQ-VER-010), mas ausência de histórico git é
  falha operacional (código 2), não veredito (REQ-VER-011).
- **Identificador retirado:** nunca reutilizável, checado tanto dentro da
  mesma capability (no parser) quanto entre capabilities e deltas abertos
  (na camada `schema`, REQ-FMT-004).
- **Token de board:** nunca em texto literal em `config.toml` — só via
  nome de variável de ambiente em `board.token_env` (REQ-SYNC-008).
- **`req` de task:** único mecanismo de cobertura reconhecido; menção em
  prosa não conta como referência a requisito (REQ-VER-004).
- **Campo de board (nome/id):** `id` e `name`, quando ambos configurados,
  precisam concordar com o que o board reporta; divergência é erro fatal
  de configuração, não resolução automática (REQ-SYNC-009).

---

## 5. Tratamento de Erros

O tratamento de erro do `specd` segue dois princípios que moldam toda
mensagem e todo caminho de falha:

### 5.1 Nunca adivinhar em conflito (P4)

Toda situação ambígua — âncora que casa em múltiplos lugares, merge de
três vias com os dois lados alterados de formas diferentes, campo de board
com `id`/`name` divergentes, órfã de board sem declaração clara de
destino — sai com erro e diagnóstico específico, listando as opções
disponíveis para a pessoa decidir. Nunca há resolução automática de
ambiguidade. Isso está espalhado por praticamente todo REQ-SYNC-* e
REQ-ANC-* citado acima.

### 5.2 Ausência de dado não é conformidade (P8)

Toda capacidade que lê estado externo — ou escreve nele — distingue três
resultados, nunca dois: **verificou e está certo**, **verificou e está
errado**, **não conseguiu verificar**. O terceiro nunca é reportado como
verde. Isso é imposto tanto no lado da leitura quanto no lado da escrita:

- Repositório sem `.git` acessível → código 2 na camada `evidence`
  (REQ-VER-011), não "zero violações".
- `validation_command` cujo executável não existe → código 2
  (`classifyCommandFailure`, REQ-VER-013), distinto de "comando rodou e
  reprovou".
- Zero arquivos vistos pela listagem do repositório → warning explícito na
  camada `anchors` (REQ-VER-012), mesmo que toda âncora declarada resolva —
  porque "toda âncora resolve" e "toda âncora resolve e eu saberia se
  quebrasse" são estados diferentes.
- Definições de campo do board inacessíveis → código 2 nomeando o status
  HTTP devolvido (REQ-SYNC-010), nunca assume tipo `string` por padrão.
- **No lado da escrita:** `close` de item de board relê o estado depois de
  escrever e falha se a situação não mudou de fato (REQ-SYNC-003) — porque
  resposta de sucesso HTTP (medido: 204 do Redmine para tracker sem linha
  de workflow) não é prova de que o efeito aconteceu. "Escrevi e o servidor
  disse OK" e "escrevi e o servidor aplicou" são resultados diferentes, e
  só o segundo é verde.

### 5.3 Recusa de servidor é relatada verbatim (REQ-SYNC-011)

Quando o board rejeita uma escrita, `specd` repassa a mensagem do servidor
sem interpretação nem comparação por substring — casar por substring é
frágil por construção (o exemplo citado nos requisitos é um erro 422 em
português do Redmine, `"Cliente cannot be blank"`, que não tem código
estruturado nem nome de campo). O item local afetado é nomeado ao lado da
mensagem; o status HTTP acompanha, porque ele é estruturado e a mensagem
não é. `sync` mostra; quem interpreta é a pessoa.

### 5.4 Operação que custa não acontece em silêncio (P9)

Toda operação com efeito irreversível ou fora do repositório para e nomeia
a escolha, ou deixa o resultado num estado revisável antes de virar
história permanente:

- `archive` reescreve capabilities e deixa tudo fora do índice git — não
  commita sozinho.
- `anchor fix` reescreve a âncora sugerida e também não commita.
- `sync` recusa em bloco quando os dois lados mudaram, em vez de escolher
  um lado.
- `sync` recusa fechar item de board de identificador retirado cujo corpo
  reaparece em item planejado (REQ-SYNC-015) — a alternativa de fechar
  silenciosamente destruiria comentários, anexos e apontamento de horas de
  terceiros no board de um cliente, e nenhuma declaração implícita
  (`REMOVED` num delta que não tem vocabulário para "renomeado") é
  suficiente para autorizar essa perda.

O padrão de erro do produto, portanto, não é apenas "reportar problemas" —
é recusar ativamente qualquer caminho em que a ferramenta decidiria por
inferência algo que só a pessoa que escreveu a spec ou opera o board pode
decidir com segurança.
