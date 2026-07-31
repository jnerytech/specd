---
capability: skills
retired: []
---

### REQ-SKL-001 — The package ships the skills of the cycle

**Statement.** The specd package SHALL include the skill sources of the explore, propose, apply and archive steps in its published tarball.

**Acceptance.**

- `npm pack` lista um diretório por skill, cada um com `SKILL.md`
- `files` do `package.json` inclui a árvore das skills
- Nenhum `SKILL.md` referencia caminho que suba do diretório do pacote
- O tarball continua sem `.env`, `.specd/`, `sandbox/` e `test/`

O statement afirma sobre as quatro skills e a âncora alcançava uma: apagar
qualquer das outras três não movia o gate. A lista de âncoras passa a declarar o
conjunto que o statement quantifica, e o gate resolve cada entrada — apagar
qualquer uma reprova.

O critério que dizia "nenhuma skill referencia caminho fora do pacote" não tinha
teste, e não tinha porque não dizia o que observar. Reescrito para o que se
observa: caminho relativo que sobe de diretório. Critério que ninguém consegue
verificar é prosa com marcador, e este era.

```yaml anchors
- file: package.json
  symbol: "\"files\""
- file: skills/specd-explore/SKILL.md
- file: skills/specd-propose/SKILL.md
- file: skills/specd-apply-change/SKILL.md
- file: skills/specd-archive-change/SKILL.md
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

A âncora era `src/init/skills.ts :: SKILL_MANIFEST`, que resolve e não realiza: o
manifesto instala as skills, e a parada que o statement descreve mora no texto de
cada uma delas. Âncora que resolve sem realizar o comportamento é pior que âncora
ausente — ela resolve para sempre, o gate nunca reclama, e o requisito passa a
afirmar verificação que ninguém faz, enquanto a ausente ao menos aparece no
`coverage` e no `anchor suggest`.

O statement não muda: ele já estava certo. Muda para onde ele aponta.

```yaml anchors
- file: skills/specd-explore/SKILL.md
- file: skills/specd-propose/SKILL.md
- file: skills/specd-apply-change/SKILL.md
- file: skills/specd-archive-change/SKILL.md
```

### REQ-SKL-004 — A skill reads the spec through the CLI

**Statement.** Every specd skill that needs the effective specification SHALL obtain it from the specd spec command.

**Acceptance.**

- Nenhum `SKILL.md` instrui a ler `.specd/specs/` e os deltas para montar o overlay
- Cada skill que precisa da spec efetiva cita `specd spec --json`
- Ler um arquivo que `specd spec` apontou continua permitido; reconstruir o overlay não

O statement dizia `Every specd skill` e o comportamento não é de todas: a skill
de archive entrega a change ao `specd archive`, que calcula o overlay sozinho. A
quantificação passa a nomear a condição — precisar da spec efetiva — e as âncoras
declaram exatamente as três skills em que isso acontece.

A fronteira entre as duas camadas é esta linha. A skill prepara material e lê o
veredito; ela não recalcula o que o CLI decide. Overlay reconstruído por LLM é
decisão de LLM no caminho do ciclo, com a agravante de ser invisível — ninguém vê
que a spec que a skill leu não é a que o gate lê.

```yaml anchors
- file: skills/specd-explore/SKILL.md
- file: skills/specd-propose/SKILL.md
- file: skills/specd-apply-change/SKILL.md
```

### REQ-SKL-005 — A decision goes to the author through the question tool

**Statement.** WHEN a specd skill reaches a decision it cannot take from the configuration or from the CLI, the skill SHALL ask the author through the host's question tool.

**Acceptance.**

- Cada `SKILL.md` nomeia a ferramenta de pergunta do host nos seus pontos de decisão
- Nenhuma skill instrui a escolher o candidato mais provável
- Card ambíguo, duas changes abertas sobre o mesmo requisito e delta que contradiz a capability param o ciclo e viram pergunta

O statement quantifica sobre qualquer skill do ciclo, e o comportamento é mesmo
das quatro. O que faltava era a âncora cobrir o que ele afirma.

Pergunta em prosa no meio de uma resposta longa se perde e volta respondida pela
metade. A ferramenta força opções mutuamente exclusivas e registra a escolha — e
o que não é apresentado para decisão explícita não foi decidido, foi assumido.

```yaml anchors
- file: skills/specd-explore/SKILL.md
- file: skills/specd-propose/SKILL.md
- file: skills/specd-apply-change/SKILL.md
- file: skills/specd-archive-change/SKILL.md
```

### REQ-SKL-006 — A configured board that cannot be reached stops the skill

**Statement.** IF a board is configured and cannot be reached, THEN every specd skill that talks to the board SHALL stop and report the failure.

**Acceptance.**

- Cada `SKILL.md` do passo que fala com o board declara a parada
- Nenhuma skill instrui a seguir como se não houvesse board configurado
- Falha de credencial, falha de rede e card não encontrado têm o mesmo desfecho
- A rodada hostil da validação prova a parada

O statement dizia `the specd skill`, no singular indefinido, e a âncora alcançava
uma. O comportamento é das três que tocam o board: a skill de apply não fala com
ele por decisão — o board recebe intenção e resultado, não ruído de execução — e
afirmar sobre ela seria contradizer a matriz de escrita.

Board configurado e inalcançável é falha, não ausência. Cair para o modo sem
board transforma "não consegui verificar" em "verifiquei e está tudo certo", que
são resultados diferentes e um deles nunca é verde.

```yaml anchors
- file: skills/specd-explore/SKILL.md
- file: skills/specd-propose/SKILL.md
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

**Statement.** WHEN the specd archive skill runs, the skill SHALL ask whether the anchors realize the behaviour the statement describes, of every requirement whose current state differs from the one the proposal recorded, and of every requirement of the change when no proposal record exists.

**Acceptance.**

- Requisito cujo statement ou critérios mudaram desde o registro entra na revisão
- Requisito ausente do registro entra na revisão
- Âncora registrada como pendurada e que hoje resolve entra na revisão, mesmo com a declaração inalterada
- Requisito idêntico ao registro, com as mesmas âncoras resolvendo, fica fora
- Sem registro na change, todo requisito dela entra, e a skill diz que o recorte foi largo por ausência de marco
- Registro ilegível, ou de versão que a skill não conhece, tem o mesmo desfecho que registro ausente
- Âncora que resolve para símbolo que não realiza o comportamento enunciado vira pergunta ao autor, e o arquivamento espera
- A skill não reescreve âncora por conta própria

O recorte tinha um referente que não existia. "O que mudou desde o propose"
supunha um marco, e nenhuma change desta sequência o produziu: `delta.md` e o
trabalho do apply entraram no mesmo commit, nas três conferidas. A única fonte
para datar era a memória de quem estava na sessão, que é o que esta revisão
existe para não aceitar — e na prática o recorte virou largo por precaução, que é
justamente a revisão cara que esta posição não sustenta.

Com o registro de REQ-SKL-009 o recorte passa a ser lido. As três entradas
continuam as mesmas, agora com como observar cada uma: texto que difere do
registrado, requisito que não está lá, âncora que o registro anotou pendurada e
que hoje resolve.

A ausência de registro tem resposta declarada em vez de acidente: recorte largo,
dito em voz alta. Registro ilegível cai no mesmo lugar — arquivo corrompido ou de
versão desconhecida é informação que não se tem, e tratá-lo como "nada mudou"
seria a mesma troca que este requisito recusa. Change antiga, ou escrita sem passar pela skill, não fica sem
revisão — fica com a revisão cara, e sabendo que é por isso. Falhar para o lado
largo é a direção segura; a alternativa que fracassaria para o lado vazio foi
medida e recusada na exploração desta change.

O escopo continua estreito porque o archive é o pior momento para descobrir
enunciado ruim — gate verde, tasks fechadas, e voltar ao delta custa. Revisão
cara nesta posição é revisão que alguém pula, e revisão pulada é pior que revisão
ausente, porque parece existir.

```yaml anchors
- file: skills/specd-archive-change/SKILL.md
```

### REQ-SKL-009 — The proposal leaves a record of what it wrote

**Statement.** WHEN the specd propose skill finishes writing a delta, the skill SHALL leave the proposal record in the change by running the command that writes it.

**Acceptance.**

- A skill roda `specd propose-record` e não monta o arquivo por conta própria
- O registro é gravado depois de o delta estar escrito
- Delta reescrito enquanto toda task está `pending` regrava o registro
- Registro existente não é regravado depois que qualquer task saiu de `pending`
- Nenhuma outra skill do ciclo escreve no registro

O registro é escrito uma vez, e a janela em que ele pode ser reescrito fecha
quando a implementação começa. Sem isso, rodar a skill de propose de novo depois
do apply grava o estado pós-apply, o recorte sai vazio, e a revisão devolve "nada
mudou" para uma change onde tudo mudou — que é a saída descartada na exploração,
entrando por outra porta. `pending` é o marcador porque é o que separa proposta de
implementação sem inventar estado novo.

Pela mesma razão nenhuma outra skill escreve ali. Se o apply reescrevesse o
registro, o recorte daria vazio sempre e o mecanismo inteiro viraria decoração.

O registro não depende de git, não força commit e não abre rede. Quem o computa é
o CLI, por REQ-EFF-005; a skill só decide **quando** rodá-lo, que é a divisão que
o ciclo inteiro pratica — a camada determinística calcula, a camada de julgamento
orquestra e lê.

Precedente de forma nos dois lados. `explore/manifest.json` já é artefato de
máquina dentro da change, versionado junto do trabalho que justifica, lido
depois. E o `synced_hash` já é estado gravado ao lado da coisa que descreve, para
responder exatamente "mudou desde a última vez".

O estado de resolução da âncora entra por uma razão que as outras saídas não
alcançavam: nada no repositório registra que uma âncora **esteve** pendurada. O
relatório do gate mostra o estado de agora, e o de ontem não é recuperável — sem
este registro, o critério de REQ-SKL-008 sobre âncora que passou a resolver é
inverificável, por mais bem escrito que esteja.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```

### REQ-SKL-010 — A board with nothing collected stops the exploring skill

**Statement.** IF a board is configured and the explore bundle collected nothing, THEN the specd explore skill SHALL stop and report it.

**Acceptance.**

- A parada vale mesmo com o comando saindo 0, porque nenhuma fonte obrigatória falhou
- Sem board configurado, um bundle que coletou `none` não para nada
- A skill não declara fonte por conta própria para resolver o caso: ela nomeia o que falta e pergunta
- A mensagem distingue "nenhuma fonte declarada" de "as declaradas falharam", lendo a lista do manifest

Board declarado e nada coletado é a configuração que se lê como "tenho board" e
se comporta como se não tivesse. A run 013 mediu as duas metades: com fonte
obrigatória declarada, o board fora do ar derruba o comando; sem fonte declarada,
o mesmo board fora do ar produz saída verde. A skill é o lugar onde essa
diferença tem que parar de passar, porque o comando está certo nas duas — o que
ele não podia era dizer que coletou.

A skill não corrige a configuração. Declarar fonte por conta própria seria
resolver por inferência um problema que é de configuração do repositório, e o que
`no-guessing-on-conflict` pede aí é nomear e perguntar.

```yaml anchors
- file: skills/specd-explore/SKILL.md
```
