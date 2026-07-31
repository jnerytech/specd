---
change: 2026-07-31-mark-enforced
target: [archive, skills]
---

# Delta — mark-enforced

O marco deixa de ser opcional na prática: toda change grava, e o archive cobra.

## ADDED

### REQ-ARC-016 — Archiving requires the proposal record

**Capability.** archive

**Statement.** IF the change carries no readable proposal record, THEN the specd archive command SHALL exit with code 2 without writing anything.

**Acceptance.**

- Change sem `propose.json` sai 2 nomeando o comando que o grava
- Registro presente arquiva, mesmo quando a lista de requisitos está vazia
- Registro ilegível, ou de versão desconhecida, recusa igual e nomeia o arquivo
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- A recusa acontece junto das outras pré-condições, antes de qualquer escrita

O `archive` caía para recorte largo quando o marco faltava. É o comportamento
certo diante da ausência, e é o que tornava a ausência indolor — fallback seguro
que ninguém sente é fallback que vira permanente. A saída escolhida para o marco
decaía sozinha para a que tinha sido descartada, por erosão e não por decisão.

Isso já aconteceu, e o registro dessa change não existirá nunca: a
`2026-07-31-usable-vacuous` foi arquivada sem marco, e a janela dela fechou antes
de alguém notar.

A cobrança não é "o marco era possível", é "não há marco" — porque com
REQ-SKL-009 toda change grava, inclusive a que não tem o que registrar. Predicado
composto seria uma segunda regra a manter sincronizada com a do
`propose-record`, e a assimetria entre as duas é onde o furo voltaria.

Registro ilegível recusa junto com registro ausente porque "não consegui ler" e
"não existe" são a mesma informação para quem depende dele — e tratar o primeiro
como se fosse marco válido seria `absence-is-not-compliance` na direção
perigosa.

Sem flag de dispensa. A válvula é por onde o descuido volta, e foi a razão de
descartar a recusa dura sem condição.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function assertProposalRecord"
```

## MODIFIED

### REQ-SKL-009 — The proposal leaves a record of what it wrote

**Statement.** WHEN the specd propose skill finishes writing a delta, the skill SHALL leave the proposal record in the change by running the command that writes it, whatever the delta declares.

**Acceptance.**

- A skill roda `specd propose-record` e não monta o arquivo por conta própria
- O registro é gravado depois de o delta estar escrito
- A skill roda o comando também quando o delta só remove requisito; o registro vazio que resulta é o marco daquela change
- Delta reescrito enquanto toda task está `pending` regrava o registro
- Registro existente não é regravado depois que qualquer task saiu de `pending`
- Nenhuma outra skill do ciclo escreve no registro

O caso que faltava é estreito e real: change que abre declarando só `REMOVED`
não precisa de marco nem de task, a janela fecha quando a primeira task fecha, e
o passo 4 da skill de apply autoriza um requisito a nascer durante a
implementação. No archive ela declararia requisito, não teria marco, e não
poderia mais gravar um.

Gravar sempre fecha isso por não deixar o caso existir. A change teria
`propose.json` vazio desde a abertura, e o requisito nascido no apply fica
**ausente do registro** — que é a segunda entrada do recorte de REQ-SKL-008. Ele
entra na revisão em vez de encalhar o arquivamento.

O ganho maior é do outro lado: com toda change gravando, a cobrança do archive
não precisa perguntar o que o delta declara. "Não há marco" basta, e a regra que
o `archive` aplica passa a ser a mesma que qualquer pessoa consegue verificar
olhando o diretório da change.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```
