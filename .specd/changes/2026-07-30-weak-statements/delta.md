---
change: 2026-07-30-weak-statements
target: [effective-spec, skills]
---

# Delta — weak-statements

Os seis enunciados promovidos abaixo do padrão, reescritos. A ancoragem dos que
falam de mais de uma skill passa a ser lista, uma entrada por skill alcançada.

## ADDED

### REQ-EFF-004 — The spec command reads the disk and nothing else

**Capability.** effective-spec

**Statement.** The specd spec command SHALL read the specification from the filesystem without opening a network connection.

**Acceptance.**

- Nenhum módulo alcançável a partir do comando importa transporte de rede
- O teste de grafo de importação cobre o mesmo conjunto de transportes que o do gate

Isto era um critério de aceite de REQ-EFF-003, pendurado num requisito sobre
código de saída — dois comportamentos escritos como um. Separar é o conserto, e
não alargamento: o comportamento já era afirmado e já era testado, só estava no
lugar errado.

O requisito existe pela mesma razão que `gate-no-network` existe para o
`verify`: `spec` é feito para rodar dentro de hook, de prompt e de skill, e um
comando que abre rede nesses lugares falha por motivo que não é do repositório.

```yaml anchors
- file: test/spec/exit-contract.test.ts
  symbol: "reaches no network module"
```

## MODIFIED

### REQ-EFF-003 — The spec command informs and never judges

**Statement.** The specd spec command SHALL exit 0 whenever it can read the specification.

**Acceptance.**

- Âncora pendurada não muda o código de saída
- Requisito sem critério de aceite não muda o código de saída
- Falha de leitura sai 2, nunca 1

O statement dizia `regardless of anchors, coverage or evidence` — nomes de
camada que este comando não roda. A frase se lia como se ele as executasse e
ignorasse o resultado, quando o que ela queria dizer é que nada do que o gate
julga altera o código de saída daqui. O que sobrou diz isso sem nomear máquina
que não está em cena, e os critérios mostram as duas formas concretas.

O critério sobre rede saiu para REQ-EFF-004, que é o comportamento que ele
descrevia.

Mesma disciplina do `status`: comando que resume estado precisa ser seguro de
rodar dentro de hook, de prompt e de skill. Um segundo comando capaz de sair 1
quebra single-gate mesmo que ninguém o coloque no CI — porque alguém coloca.

```yaml anchors
- file: test/spec/exit-contract.test.ts
  symbol: "spec informs and never judges"
```

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
