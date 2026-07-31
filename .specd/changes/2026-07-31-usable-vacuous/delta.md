---
change: 2026-07-31-usable-vacuous
target: [explore, skills]
---

# Delta — usable-vacuous

O bundle passa a dizer quanto coletou, e não só que nada obrigatório falhou.

## ADDED

### REQ-EXP-012 — The manifest says how much was collected

**Capability.** explore

**Statement.** The specd explore command SHALL record in the manifest how much of the declared collection succeeded, as one of `all`, `partial` or `none`.

**Acceptance.**

- `all` quando existe fonte declarada e toda fonte terminou com status `ok`
- `partial` quando alguma fonte terminou `ok` e alguma não
- `none` quando nenhuma fonte terminou `ok`, inclusive quando nenhuma foi declarada
- O campo é independente de `usable`: um bundle pode ser `usable` e ter coletado `none`
- A saída do comando nomeia o estado, e não apenas `usable`

`usable` afirma uma coisa só, e afirma corretamente: nenhuma fonte declarada
obrigatória falhou. Com zero fontes declaradas isso é verdade vacuamente
verdadeira — a lista está vazia, e vazio satisfaz "nenhuma falhou". O nome promete
suficiência e o cálculo entrega ausência de falha declarada, e é essa distância
que produz `bundle: usable` para uma execução que não tentou coletar nada.

O campo novo não corrige `usable`, e isso é escolha: a camada `provenance` lê
`usable` por REQ-VER-003, e mudar o sentido de um campo que outra camada
interpreta trocaria um defeito por uma migração silenciosa. O que faltava não era
consertar a resposta, era ter a pergunta — quanto foi coletado é informação que o
manifest não tinha, e nenhuma leitura dele conseguia recuperar.

Três estados e não dois pela razão de sempre: verificou-e-coletou,
verificou-e-faltou, e não-havia-o-que-verificar são resultados diferentes, e
juntar o terceiro com o primeiro é o que `absence-is-not-compliance` proíbe.

`none` cobre "nenhuma fonte declarada" e "todas falharam" com o mesmo valor
porque a lista de fontes do manifest já distingue os dois casos, e um estado a
mais só para isso seria estado que ninguém lê.

```yaml anchors
- file: src/explore/manifest.ts
  symbol: "export type CollectionExtent"
- file: src/explore/index.ts
  symbol: "export function collectionExtent"
```

### REQ-SKL-010 — A board with nothing collected stops the exploring skill

**Capability.** skills

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
