# Run 006 — onboarding, do `init` ao `sync`

- **Quando:** 2026-07-29
- **Versão avaliada:** specd em `88fb03e`, fim da Fatia 6
- **Alvo:** cópia limpa de `sandbox/sample05` (.NET, 208 arquivos), sem `.specd/`
- **Board:** Redmine 6.1.3 local, semeado
- **Regra do exercício:** partir só da documentação; anotar toda vez que for
  preciso saber algo que não está escrito; **não consertar nada**
- **Veredito:** o caminho `init → verify → sync` funciona e é curto. A
  documentação **não leva ninguém até ele**: o primeiro comando do README não
  existe, o config que o `init` gera não menciona `sync`, e metade da
  ferramenta — `changes/` — não tem formato documentado em lugar nenhum. Quem
  chegou até o fim foi ensinado por mensagem de erro, não por documento.

> Registro imutável. Diagnóstico, não conserto.

---

## 1. O que aconteceu, na ordem

| # | Passo | Resultado |
| - | ----- | --------- |
| 1 | `npx specd --version` | **404**, pacote não publicado |
| 2 | `node .../dist/cli.js init` | ok, detectou `dotnet` pelo `GymErp.sln` |
| 3 | `verify` | **exit 1**, `dotnet` não instalado |
| 4 | capability copiada do README | erro: falta frontmatter |
| 5 | capability com frontmatter | **passa**, âncora resolve contra C# real |
| 6 | `[board]` do README + token | `sync` **cria Epic + Story** |
| 7 | `sync` de novo | 2 `unchanged`, nada duplicado |
| 8 | delta escrito por adivinhação | 3 voltas até passar |
| 9 | task escrita por adivinhação | 3 voltas até passar |
| 10 | `sync` com change aberta | colapso da task funcionou |

Dez passos. Cinco deles exigiram conhecimento que não está escrito.

---

## 2. Onde quase desisti

**Passo 1, e é o pior lugar possível para isso acontecer.**

```
$ npx specd --version
npm error 404 Not Found - GET https://registry.npmjs.org/specd
```

O README abre com `npx specd` e usa `specd <comando>` em todos os exemplos. O
pacote não está publicado — o próprio README diz isso na seção "Primeiros
passos", mas diz como pendência de *publicação*, não como "por enquanto rode
assim".

E não há "assim". Busca por `npm install`, `npm ci`, `npm run build`,
`dist/cli`, `node dist`, `npm link` ou `clone` no README **e** no AGENTS.md:
**zero ocorrências**. Nenhum dos dois documentos diz como executar a
ferramenta a partir do fonte.

Assumi `node /caminho/do/repo/dist/cli.js`. Isso é conhecimento de quem
construiu, não de quem leu. Sem ele o run termina no passo 1, e quem termina no
passo 1 não vira usuário.

Esse é o item que mata o produto hoje. Todo o resto é atrito; este é parede.

**Segundo lugar onde quase desisti**, muito depois: escrevendo o `delta.md` às
cegas, o frontmatter vazio devolveu a mesma frase do arquivo sem frontmatter
nenhum:

```
$ printf -- '---\n---\n...' > delta.md
error ... Missing YAML frontmatter; a delta file opens with "---".
```

O arquivo *abre* com `---`. A mensagem estava certa sobre o efeito e errada
sobre a causa, e a leitura natural é "a ferramenta não está me ouvindo". Levei
uma volta inteira sem entender, e só saí porque sabia que a chave `change:`
existia.

---

## 3. Conhecimento que só existe na cabeça de quem construiu

Um item por vez, com o que teve que ser assumido.

**Como executar.** Coberto acima. Não documentado em lugar nenhum.

**O config que o `init` gera não conhece `sync`.** O template abre com:

```
# Every section below is supported; values shown are the recommended defaults.
```

Isso é **falso**, e dá para provar mecanicamente. Comparando `ConfigSchema` com
o texto do template, seis chaves suportadas não aparecem:

```
board.mapping.capability
board.mapping.collapse
board.mapping.closed_status
board.fields.constant
explore.sources.tool
explore.sources.arguments
```

As quatro primeiras são o `sync` inteiro. As duas últimas são do transporte MCP
e já estavam faltando **antes da Fatia 6** — ninguém percebeu por três fatias.

Quem roda `init` e lê o arquivo gerado — que é o comportamento esperado, o
arquivo é escrito para ser lido — conclui que `sync` não é configurável. A
seção existe no README, então dá para recuperar; mas o artefato que a
ferramenta escreve mente sobre a ferramenta.

**Onde se obtém o token do board.** `token_env` é bem explicado — o nome da
variável, nunca o valor. Nada diz de onde sai o valor. No Redmine é
`/my/account` → "Chave de acesso API". Assumi por saber.

**Que `board.url` existe.** O template comenta `url_template`, que é do
`explore`. `url`, que é o que o `sync` usa, não aparece nem comentado. Peguei
do README.

**Formato de `delta.md` e de `tasks/*.md`.** Não documentado. O README cita
`delta.md # ADDED / MODIFIED / REMOVED` num comentário dentro do desenho de
árvore, e `tasks/` sem uma palavra. As chaves de frontmatter de task — `id`,
`change`, `req`, `status`, `evidence.commits` — não aparecem no README.

Foram **seis voltas de tentativa e erro** para escrever uma change de um
requisito e uma tarefa. Todas resolvidas por mensagem de erro. Documentação
contribuiu zero para essa metade da ferramenta.

**Que `collapse = ["task"]` não faz nada sem change aberta.** Copiei do README,
rodei `sync`, não vi efeito nenhum, e não havia como saber por quê. Só apareceu
depois que existiu uma task — porque o único nível colapsável vem de
`changes/`, não de `specs/`. Nada diz isso.

---

## 4. Comando cujo `--help` não explica o que ele faz

`specd --help` lista uma linha por comando e é razoável. O que não existe é
ajuda por comando:

```
$ specd sync --help
Unknown option "--help". Valid options: --dry-run, --json.
exit=2
```

`--help` é reflexo universal. A resposta é útil por acidente — ela lista as
opções válidas —, mas responde "opção desconhecida" a algo que não é opção
desconhecida, é o pedido de ajuda.

---

## 5. Erro que diz o que aconteceu e não o que fazer

**O caso do `dotnet`**, e ele é mais grave do que parece:

```
fail  project: failed (1 error, 0 warnings)
  error .specd/config.toml:1 verify.validation_command exited with code 127: dotnet test
  | spawn dotnet ENOENT
verify: failed
exit=1
```

Duas coisas erradas aqui.

Primeira, a mensagem não diz o que fazer. Há três saídas — instalar o
`dotnet`, trocar `validation_command`, ou tirar `project` de `levels` — e
nenhuma é mencionada. O `init` propôs esse comando sozinho, então a pessoa nem
escolheu conscientemente rodar `dotnet test`.

Segunda, e essa é de contrato: **`dotnet` não instalado sai 1.** O README
vende exatamente esta distinção:

> CI precisa distinguir "spec reprovou" de "ferramenta quebrou".

Executável ausente é ferramenta quebrou. Saiu como spec reprovou. É o mesmo
formato do P8 — "não consegui verificar" apresentado como "verifiquei e está
errado" —, só que uma casa acima: não é verde onde deveria ser vermelho, é
vermelho do tipo errado. O CI que confia na distinção age errado.

**Contraste, para ser justo:** os erros de schema são excelentes. O de
capability nomeia as chaves exigidas; o de task nomeia **todas** as que faltam
de uma vez; o de delta com lista de identificadores explica o Modelo B e por
que a lista não diz nada. Foram eles que ensinaram tudo o que a documentação
não ensinou. A assimetria é que a mensagem de delta sem frontmatter, ao lado
delas, não nomeia chave nenhuma.

---

## 6. Ordem que não é óbvia

**`sync` exige capability em `.specd/specs/`.** Um repositório recém-iniciado
não tem nenhuma, e `sync` num projeto vazio não faz nada e não explica.
Escrever a spec vem antes; nada diz.

**Token antes de config completo.** `sync` falha na variável de ambiente antes
de reclamar de `board.mapping` ausente. A ordem de validação é razoável, mas
significa que a pessoa corrige um erro de cada vez, sem ver a lista.

**A ordem que ninguém adivinha:** `[board.mapping]` e `[[board.fields]]` são
subseções de `[board]`, e o template as põe no meio do arquivo. Colei os blocos
do README **no fim** do `config.toml`, depois de `[memory]`. Funcionou — TOML
não liga —, mas o arquivo ficou com `[board]` em dois pedaços separados por
trinta linhas. Um leitor futuro não encontra a configuração de board olhando
para `[board]`.

---

## 7. Coisa que exigiu abrir o código-fonte

Nada, neste percurso — e é um resultado bom, que vale registrar como tal.

Com uma ressalva: **eu não precisei abrir porque já tinha aberto.** As duas
coisas que teriam exigido — a lista de chaves de configuração suportadas e o
esquema de frontmatter de task — eu sabia de cor. Um recém-chegado abriria
`src/config/schema.ts` e `src/parser/task.ts`, porque não há outro lugar onde
essa informação exista.

---

## 8. A tensão que o `sync` criou e ninguém documentou

Achado que não estava na lista pedida, e é o mais interessante.

O AGENTS.md diz, como política:

> **Requisito é maleável em voo e congela ao ser realizado.** Dividir, renomear
> ou reescrever requisito que está num delta não custa nada.

Medido:

```
$ sed -i 's/REQ-ENR-002/REQ-ENR-003/g' delta.md tasks/001-cancel.md
$ specd sync
  create    REQ-ENR-003 [Story] http://localhost:18080/issues/8
  closed    REQ-ENR-002 []      http://localhost:18080/issues/7
```

Renomear custou um card fechado e um card novo no board do cliente. O
comportamento está correto pelas regras do `sync` — ligação é por chave, chave
sumiu, item fecha —, mas **contradiz a política** que diz que renomear é grátis.

A política foi escrita quando `sync` não existia. Continua no arquivo, sem
ressalva, e agora está errada para qualquer projeto que sincronize antes de
arquivar. Ninguém percebeu porque prosa não tem gate.

---

## 9. AGENTS.md: o que mais está desatualizado

Auditado como documento, não como configuração.

**Errado hoje:**

- "sem instalação (`npx specd`)" — o pacote não existe no registry. Mesma
  falsidade do README, e a mesma que para o run no passo 1.
- A política de requisito maleável, pela §8.

**Errado no README, mesmo defeito de classe:**

- "`.specd/specs/` tem 7 capabilities e 48 requisitos" — hoje são **10 e 93**.
  Congelado na Fatia 3.
- A tabela do Ciclo lista `propose` e `apply` como fases, sem marca de que
  nenhum dos dois existe como comando. A Roadmap diz "Não especificada" oitenta
  linhas depois; quem lê a tabela de cima para baixo não chega lá antes de
  tentar.
- "`coverage` | Todo requisito tem tarefa" — a camada só cobra tarefa para
  requisito declarado em delta aberto. `REQ-ENR-001` em `specs/` passou sem
  tarefa nenhuma. A tabela dá o modelo mental errado.

**Já corrigido na Fatia 6**, e citado porque é o precedente: o escopo mandava
não implementar `sync` nem hooks depois dos dois entregues, e apontava a Fatia
4 como próxima. Ficou errado por três fatias sem nada acusar.

---

## 10. O que seria gatilhável mecanicamente

O padrão dos três defeitos acima é o mesmo: **afirmação verificável escrita em
prosa, sem nada verificando.** A Fatia 4 registrou isso como "conteúdo de
template não tem contrato" e resolveu um caso — a lista de camadas do `init`
virou derivada de `VERIFY_LEVELS`. O defeito voltou em cinco lugares novos.

Candidatos, do mais mecânico ao menos:

| Afirmação | Fonte de verdade | Custo |
| --------- | ---------------- | ----- |
| "Every section below is supported" no template do `init` | toda chave de `ConfigSchema` aparece no template | trivial — o teste que escrevi neste run é um `node -e` de seis linhas |
| "N capabilities e M requisitos" no README | `specd status`, que já imprime exatamente isso | trivial |
| Comandos citados em prosa existem | `registerCommands()` | fácil — pega `propose`/`apply` |
| "As Fatias 1 a N estão arquivadas" | listagem de `.specd/changes/archive/` | fácil |
| Linha da Roadmap "Entregue" | change correspondente arquivada | médio, exige convenção de nome |
| Descrição de camada na tabela do gate | nada de máquina — é semântica | não é gatilhável |

O primeiro é o que mais paga: já falhou duas vezes, já custou três fatias de
mentira silenciosa, e a verdade está num objeto exportado a dois `import` de
distância.

O último está na tabela de propósito. Nem tudo é gatilhável, e fingir que é
produz teste que passa sem checar nada — que é P8 dentro do próprio CI.

---

## 11. Quanto tempo levou

**Relógio de comando: 197 s.** Esse número é honesto e inútil sozinho — não
inclui leitura, nem hesitação, nem procurar no README, e quem executou já sabia
todas as respostas.

O que dá para medir sem distorção:

| Métrica | Valor |
| ------- | ----- |
| Passos até `sync` funcionando | 10 |
| Voltas de tentativa e erro por formato não documentado | 7 |
| Momentos em que assumi conhecimento não escrito | 5 |
| Momentos em que teria travado de vez | **1** (passo 1) |

**Estimativa para quem não sabe** — e é estimativa, marcada como tal: as sete
voltas de formato são de dois a quatro minutos cada, com leitura; encontrar a
seção `sync` do README depois de o config gerado não mencioná-la, mais dez;
descobrir de onde vem o token, mais cinco. Entre **60 e 90 minutos**, e só para
quem já resolveu o passo 1 — que não é resolvível a partir do que está escrito.

**Com a documentação completa: 10 a 15 minutos.** O caminho em si é curto e as
mensagens de erro são boas. Quase tudo o que custou tempo foi ausência de
frase, não complexidade de produto.

**O custo de onboarding do specd hoje é, portanto, "infinito com probabilidade
alta e uma hora no melhor caso".** O infinito não é retórica: sem saber
compilar o repositório, não há caminho.

---

## 12. As três que mais atrapalharam

Só o topo, ordenado.

**1. Não há como executar a ferramenta.** O README manda `npx specd`, que dá
404, e nenhum documento diz como rodar do fonte. É a única parede absoluta do
percurso, está no primeiro passo, e some com três linhas de README. Tudo o mais
nesta lista é atrito depois de uma porta que não abre.

**2. O config que o `init` escreve não conhece `sync`, e diz que conhece.**
Quatro chaves de `board.*` ausentes, sob uma linha afirmando que tudo o que é
suportado está ali. O artefato que a ferramenta gera para ser lido descreve uma
ferramenta menor do que ela é — e o defeito é da classe que já reincidiu duas
vezes e é mecanicamente checável.

**3. `changes/` não tem formato documentado.** Delta e task são metade do
produto: são o que alimenta as camadas `coverage` e `evidence`, e são o Modelo
B inteiro. Custaram seis voltas de adivinhação, ensinadas exclusivamente por
mensagem de erro. Sem `propose`, escrever à mão é o **único** caminho, e é o
caminho não descrito.

O quarto lugar, que fica de fora por pouco: `dotnet` ausente saindo 1 em vez de
2. Não atrapalha o onboarding — atrapalha o CI de quem adotar, que é pior, mas
é outro run.

---

## 13. O que este run não cobriu

- **Conflito de verdade.** Nunca editei dos dois lados no percurso de
  onboarding, então a mensagem de conflito não foi lida com olhos de novato.
- **Repositório com histórico.** `sample05` é cópia sem git próprio. Camadas
  `evidence` e `provenance` mal foram exercitadas.
- **`explore`.** Não entrou no caminho `init → sync` e não foi tocado.
- **Segundo par de olhos.** Continua sendo o mesmo autor lendo a própria
  documentação. O run reduz a premissa de autoria, não a elimina: eu sei o que
  procurar, e um recém-chegado tropeça em coisas que eu leio sem ver.
