---
change: 2026-07-30-propose-mark
target: [skills, effective-spec]
---

# Delta — propose-mark

O propose passa a deixar um registro do que escreveu, e o recorte do archive
passa a ser lido dele em vez de deduzido.

## ADDED

### REQ-EFF-005 — The proposal record is computed, not transcribed

**Capability.** effective-spec

**Statement.** The specd propose-record command SHALL write, for every requirement a named change declares, its statement, its acceptance criteria, its anchors and whether each anchor resolves at the moment of the write.

**Acceptance.**

- Requisito de outra change, ou de `.specd/specs/`, não entra no arquivo
- `resolved` é calculado resolvendo cada âncora declarada, e não lido do relatório de nenhuma camada
- O resultado não muda quando `anchors` está fora de `verify.levels`
- Change inexistente sai 2 nomeando as changes abertas
- Change com alguma task fora de `pending` sai 2 nomeando a task, sem escrever
- Change que declara requisito e não tem task sai 2, sem escrever
- Change cujo delta só remove escreve, porque não declara requisito nem precisa de task
- O comando informa e nunca julga: sai 0 com âncora pendurada, 2 quando não consegue escrever

O registro precisava ser dado, não transcrição. Nenhuma saída deste CLI afirma
que uma âncora **resolve**: `verify --json` e `status --json` listam as
penduradas, e derivar o resto por ausência produz "tudo resolvido" quando a
camada `anchors` está desligada — inferência por ausência devolvendo verde, que é
o que `absence-is-not-compliance` recusa. O comando resolve cada âncora
declarada e responde pelo que resolveu.

Uma skill copiando campo a campo do JSON de dois comandos erraria em silêncio, e
erro em `resolved` produz recorte vazio, que é a direção perigosa. Persistir aqui
é persistir cálculo que `resolveAnchor` já faz.

A janela também é imposta aqui, e não só pedida no texto da skill. Ela foi furada
na primeira oportunidade de aplicá-la, nesta mesma change: o comando rodou com uma
task já `done` e gravou o estado pós-apply sem reclamar, que é precisamente o
recorte vazio contra o qual a regra existe. Regra que vive só na camada que
esquece é regra que será esquecida, e "existe task fora de `pending`" é condição
que o parser já sabe responder.

Ausência de task não é janela aberta. Ela não prova que nada foi implementado, e
ler assim é inferir conformidade de dado que não existe — o caminho perigoso fica
alcançável por simplesmente não criar tasks: implementar, gravar o registro sem
elas, criá-las depois como `pending`, e o recorte do archive sai vazio para uma
change onde tudo mudou. No caminho feliz a pergunta nem aparece, porque a skill
escreve as tasks antes de gravar o registro.

Change cujo delta só remove é a exceção, e é exceção por não ter o que a regra
protege: ela não declara requisito, não precisa de task por REQ-VER-004, e seu
registro é vazio de qualquer forma.

```yaml anchors
- file: src/spec/record.ts
  symbol: "export function proposeRecord"
```

### REQ-SKL-009 — The proposal leaves a record of what it wrote

**Capability.** skills

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

## MODIFIED

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
