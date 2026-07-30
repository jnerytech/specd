---
change: 2026-07-30-sync-unborn-capability
target: [sync]
---

# Delta — sync-unborn-capability

`sync` para antes de gastar quando a capability de um item planejado ainda não
existe em disco.

## ADDED

### REQ-SYNC-018 — A capability that exists only in a delta stops the run before the first write

**Capability.** sync

**Statement.** IF a planned item belongs to a capability that has no file under `.specd/specs/`, THEN the specd sync command SHALL exit with code 2 before writing anything to the board.

**Acceptance.**

- Nenhum item é criado no board antes da recusa
- A mensagem nomeia a capability, a change cujo delta a declara, e o caminho que faltou
- A mensagem diz que a capability nasce no `archive`, e que sincronizar a proposta dela exige arquivar antes
- `--dry-run` recusa do mesmo jeito
- A recusa não consulta o board, nem para ler definições de campo
- Requisito de delta cuja capability já existe continua sincronizando

REQ-SYNC-007 põe a ligação na frontmatter do arquivo da capability, e sob Modelo
B esse arquivo só nasce quando `archive` aplica o delta. Para capability nova, a
gravação da ligação encontrava um arquivo inexistente e o comando saía 2 **depois**
de ter criado os cards: escrita externa feita, nenhuma ligação registrada, e a
tentativa seguinte criando tudo de novo, porque ausência de ligação é "nunca
sincronizado" e não "já sincronizado sem registro". Gastar primeiro e verificar
depois é a ordem que costly-ops-are-not-silent inverte.

A recusa lê o disco e nada mais, então vem antes até do adaptador. A primeira
versão a colocou depois de `loadFieldBindings`, e o critério "não faz requisição
nenhuma" era falso em qualquer repositório com `[[board.fields]]` — o teste
passava porque a fixture não declarava campo nenhum, que é a premissa do ambiente
de autoria se verificando a si mesma. Ordenar por custo não é estética: com o
board fora do ar, a recusa tardia devolveria erro de definição de campo em vez do
motivo real.

Vale a mesma disciplina de REQ-SYNC-005: levantar antes da primeira escrita e não
escrever nem o que estaria bem, porque meia sincronização deixa o board num
estado que nenhum dos dois lados descreve.

Vale igual no `--dry-run` porque o plano é o que a pessoa lê antes de confirmar.
Plano que omite o impedimento colhe confirmação para uma coisa que não vai
acontecer, o que é pior do que não planejar.

Isto não conserta o caso: sincronizar a proposta de uma capability nova continua
não funcionando, e continua precisando que a ligação viaje com o bloco do
requisito. O que muda é o preço de descobrir — que passa a ser zero.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export function assertCapabilitiesExist"
```
