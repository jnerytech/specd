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
