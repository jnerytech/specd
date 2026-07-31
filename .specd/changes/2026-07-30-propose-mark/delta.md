---
change: 2026-07-30-propose-mark
target: [skills]
---

# Delta — propose-mark

O propose passa a deixar um registro do que escreveu, e o recorte do archive
passa a ser lido dele em vez de deduzido.

## ADDED

### REQ-SKL-009 — The proposal leaves a record of what it wrote

**Capability.** skills

**Statement.** WHEN the specd propose skill finishes writing a delta, the skill SHALL record inside the change directory, for every requirement the delta declares, its statement, its acceptance criteria, its anchors and whether each anchor resolved.

**Acceptance.**

- O registro fica no diretório da change, versionado com ela
- Cada requisito do delta aparece com statement, critérios, âncoras e o estado de resolução de cada âncora
- Os valores são copiados de `specd spec --json` e do relatório do gate; a skill não calcula nem resume
- Requisito que o delta não declara não entra no registro
- Delta reescrito ainda no propose reescreve o registro

O registro não depende de git, não força commit e não abre rede. Gravar estado é
registro, não decisão, então não encosta em `no-llm-in-decision-path` — a skill
copia o que dois comandos determinísticos produziram, e não resume nem interpreta
nenhum deles.

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

## MODIFIED

### REQ-SKL-008 — The archiving skill reviews what changed since the proposal

**Statement.** WHEN the specd archive skill runs, the skill SHALL ask whether the anchors realize the behaviour the statement describes, of every requirement whose current state differs from the one the proposal recorded, and of every requirement of the change when no proposal record exists.

**Acceptance.**

- Requisito cujo statement ou critérios mudaram desde o registro entra na revisão
- Requisito ausente do registro entra na revisão
- Âncora registrada como pendurada e que hoje resolve entra na revisão, mesmo com a declaração inalterada
- Requisito idêntico ao registro, com as mesmas âncoras resolvendo, fica fora
- Sem registro na change, todo requisito dela entra, e a skill diz que o recorte foi largo por ausência de marco
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
dito em voz alta. Change antiga, ou escrita sem passar pela skill, não fica sem
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
