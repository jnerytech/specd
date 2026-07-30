---
capability: skills
retired: []
---

### REQ-SKL-001 — The package ships the skills of the cycle

**Statement.** The specd package SHALL include the skill sources of the explore, propose, apply and archive steps in its published tarball.

**Acceptance.**

- `npm pack` lista um diretório por skill, cada um com `SKILL.md`
- `files` do `package.json` inclui a árvore das skills
- Nenhuma skill referencia caminho fora do pacote
- O tarball continua sem `.env`, `.specd/`, `sandbox/` e `test/`

Skill que mora só neste repositório serve a este repositório. O ciclo é o
produto, e produto que só o autor consegue rodar não foi entregue.

```yaml anchors
- file: package.json
  symbol: "\"files\""
- file: skills/specd-explore/SKILL.md
```

### REQ-SKL-002 — Installing the skills is asked for and never silent

**Statement.** WHERE the `--skills` flag is given, the specd init command SHALL write the packaged skills into `.claude/skills/` and report every path it wrote.

**Acceptance.**

- Sem a flag, nenhuma skill é escrita
- Arquivo existente com conteúdo diferente do empacotado não é sobrescrito sem `--force`
- Arquivo idêntico é reportado como inalterado e não reescrito
- Cada caminho escrito aparece na saída

Escrita fora de `.specd/` é escrita no território de outra ferramenta. Ela para
e nomeia a escolha, ou deixa o resultado onde a revisão passa antes de virar
história — que é costly-ops-are-not-silent. Sobrescrever skill que alguém
editou sem perguntar é as duas coisas erradas de uma vez.

```yaml anchors
- file: src/init/skills.ts
  symbol: "export function installSkills"
```

### REQ-SKL-003 — A skill declares the CLI version it needs

**Statement.** IF the installed specd executable is older than the minimum version a skill declares, THEN the skill SHALL stop before acting.

**Acceptance.**

- A frontmatter de cada `SKILL.md` declara `requires_specd`
- O primeiro passo de cada skill lê `specd --version` e para se a versão for menor
- Versão maior ou igual prossegue
- A mensagem de parada nomeia a versão instalada e a exigida

A skill viaja no pacote e o pacote é instalado em versão qualquer. Skill nova
citando comando que a CLI instalada não tem falha de um jeito específico e
ruim: o comando não existe, a skill improvisa, e improvisar aqui significa
reconstruir a spec efetiva por conta própria.

```yaml anchors
- file: src/init/skills.ts
  symbol: "SKILL_MANIFEST"
```

### REQ-SKL-004 — A skill reads the spec through the CLI

**Statement.** Every specd skill SHALL obtain the effective specification from the specd spec command.

**Acceptance.**

- Nenhum `SKILL.md` instrui a ler `.specd/specs/` e os deltas para montar o overlay
- Cada skill que precisa da spec efetiva cita `specd spec --json`
- Ler um arquivo que `specd spec` apontou continua permitido; reconstruir o overlay não

A fronteira entre as duas camadas é esta linha. A skill prepara material e lê o
veredito; ela não recalcula o que o CLI decide. Overlay reconstruído por LLM é
decisão de LLM no caminho do ciclo, com a agravante de ser invisível — ninguém
vê que a spec que a skill leu não é a que o gate lê.

```yaml anchors
- file: skills/specd-explore/SKILL.md
```

### REQ-SKL-005 — A decision goes to the author through the question tool

**Statement.** WHEN a specd skill reaches a decision it cannot take from the configuration or from the CLI, the skill SHALL ask the author through the host's question tool.

**Acceptance.**

- Cada `SKILL.md` nomeia a ferramenta de pergunta do host nos seus pontos de decisão
- Nenhuma skill instrui a escolher o candidato mais provável
- Card ambíguo, duas changes abertas sobre o mesmo requisito e delta que contradiz a capability param o ciclo e viram pergunta

Pergunta em prosa no meio de uma resposta longa se perde e volta respondida pela
metade. A ferramenta força opções mutuamente exclusivas e registra a escolha —
e o que não é apresentado para decisão explícita não foi decidido, foi assumido.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```

### REQ-SKL-006 — A configured board that cannot be reached stops the skill

**Statement.** IF a board is configured and cannot be reached, THEN the specd skill SHALL stop and report the failure.

**Acceptance.**

- Cada `SKILL.md` do passo que fala com o board declara a parada
- Nenhuma skill instrui a seguir como se não houvesse board configurado
- Falha de credencial, falha de rede e card não encontrado têm o mesmo desfecho
- A rodada hostil da validação prova a parada

Board configurado e inalcançável é falha, não ausência. Cair para o modo sem
board transforma "não consegui verificar" em "verifiquei e está tudo certo", que
são resultados diferentes e um deles nunca é verde.

```yaml anchors
- file: skills/specd-archive-change/SKILL.md
```

### REQ-SKL-007 — The proposing skill reviews every statement it writes

**Statement.** WHEN the specd propose skill writes a requirement into a delta, the skill SHALL check that the statement carries one subject, that its quantification stays inside the reach of its anchors, and that every acceptance criterion names something a test can verify.

**Acceptance.**

- Statement com mais de um `SHALL`, ou com critério que descreve comportamento fora do assunto do statement, é apontado
- Statement que quantifica sobre um conjunto que as âncoras declaradas não alcançam é apontado
- Critério de aceite que nenhum teste conseguiria verificar é apontado
- Critério que proíbe uma ação futura do agente é isento do teste, e a revisão o nomeia como não-testável por construção em vez de deixá-lo passar calado
- O que a skill não consegue decidir vira pergunta ao autor, por REQ-SKL-005
- A skill não reescreve enunciado por conta própria

Corrigir aqui é gratuito: o requisito ainda é `origin: delta`, nenhuma task o
cita, nenhuma âncora tem histórico. Depois do archive o mesmo conserto é change
própria com MODIFIED, e trocar âncora vira churn de identificador.

A revisão é mecânica de propósito. Contar `SHALL`, comparar o que o statement
quantifica com o que as âncoras alcançam, e perguntar de cada critério se existe
teste que o verifique — três perguntas com resposta observável.

A terceira tem um limite, e o limite é estreito de propósito. Critério que diz
que a instrução está no `SKILL.md` é verificável por asserção sobre o texto —
fraca, e real. O que não tem verificação nenhuma é critério que **proíbe** uma
ação futura do agente: nenhuma asserção prova que algo não será feito. Só essa
forma é isenta.

A isenção larga — "requisito sobre comportamento de skill" — seria portão aberto,
e a população que o atravessaria é conhecida: três dos quatro enunciados fracos
deste repositório vivem na capability `skills` e se declarariam isentos. A exceção
engoliria a regra que este requisito existe para instituir.

Em troca de não ter teste, o critério isento é nomeado dentro da própria revisão
como não-testável por construção. Isenção anotada é diferente de isenção
implícita: a primeira deixa rastro de que alguém olhou, a segunda é indistinguível
de descuido — que é `absence-is-not-compliance` outra vez, agora sobre a revisão. O que sobra vai
ao autor em vez de virar juízo da skill, que é REQ-SKL-005 fazendo o trabalho que
já era dele.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```

### REQ-SKL-008 — The archiving skill reviews what changed since the proposal

**Statement.** WHEN the specd archive skill runs, the skill SHALL ask of every requirement that did not exist at proposal time, or whose text or anchor resolution changed since it, whether its anchors realize the behaviour the statement describes.

**Acceptance.**

- Requisito reescrito durante o apply entra na revisão
- Requisito que não existia no propose entra na revisão
- Âncora que passou de pendurada a resolvida entra na revisão, mesmo com a declaração inalterada
- Requisito inalterado e com âncora já resolvida no propose fica fora
- Âncora que resolve para símbolo que não realiza o comportamento enunciado vira pergunta ao autor, e o arquivamento espera
- A skill não reescreve âncora por conta própria

No propose essa pergunta não tem resposta: o requisito é `origin: delta` e o
símbolo pode não existir, então "a âncora realiza o comportamento?" só produziria
resposta inventada. No archive ela tem — o apply escreveu o código, e a âncora
que estava pendurada agora resolve.

Requisito que nasce durante o apply é a terceira entrada, e ele escapava das duas
janelas pela letra: não passou pelo propose, seu texto nunca foi *reescrito*, e a
âncora que ele declara aponta para código que já existe naquele instante, então
nunca esteve *pendurada*. É também o caminho mais provável de enunciado ruim —
escrito sob pressão de implementação, sem a cerimônia do propose. O passo de
`specd-apply-change` que manda escrever no delta o que a execução descobriu é a
razão de o delta ser a superfície de escrita, e era a porta por onde requisito
entrava sem ninguém ler.

O critério sobre requisito reescrito durante o apply não é exercitado por
nenhum dos quatro enunciados fracos, e fica assim mesmo, com a instância real
escrita ao lado: REQ-ARC-014 teve a âncora reescrita durante o apply, no mesmo
commit em que o símbolo nasceu — `export function` virou `export async function`
porque a resolução é literal. Critério cuja única evidência vem de fora do
conjunto de avaliação é mais fraco que os outros, e está declarado como tal.

Âncora que passou a resolver conta como mudança mesmo com a declaração intacta, e
essa leitura é o requisito inteiro. A âncora errada de REQ-SKL-003 nunca mudou de
texto: mudou de estado, e foi ao mudar de estado que virou observável. Ler "o que
mudou" como diferença de texto deixaria a segunda janela quase vazia.

O escopo é estreito porque o archive é o pior momento para descobrir enunciado
ruim — o gate está verde, as tasks estão fechadas, e voltar ao delta custa. Uma
revisão cara nesta posição é uma revisão que alguém pula, e revisão pulada é pior
que revisão ausente, porque parece existir.

```yaml anchors
- file: skills/specd-archive-change/SKILL.md
```
