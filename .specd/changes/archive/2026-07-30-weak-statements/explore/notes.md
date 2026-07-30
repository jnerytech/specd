# Exploração — weak-statements

## Origem do escopo

Sem board neste repositório. O escopo veio da revisão de enunciado registrada em
`sandbox/RELATORIO.md` e da decisão do autor em 2026-07-30: os seis juntos, numa
change, porque foram achados na mesma leitura e compartilham a prosa de
justificativa.

## Enquadramento, escrito antes de qualquer conserto

Esta change é **o primeiro uso real** de REQ-SKL-007 e REQ-SKL-008. É escrita
nova, com as duas janelas em vigor, e é toda `MODIFIED`, então as três perguntas
do propose incidem sobre cada reescrita.

E ela **não é teste independente dos critérios**. Estes requisitos foram o
conjunto de avaliação que desenhou as três perguntas. Aplicar a eles os critérios
que eles próprios geraram mostra que os critérios são aplicáveis; não mostra que
um revisor cego chegaria neles. O primeiro teste cego é a change seguinte a esta.

Registrar isso aqui é o ponto. Vender a change como validação dos critérios seria
a mesma forma do teste de `sync` que passava porque a fixture não declarava
`[[board.fields]]` — a premissa do autor verificando a si mesma e chamando o
resultado de evidência.

## Escopo

Reescrever os enunciados e as âncoras de REQ-EFF-003, REQ-SKL-001, REQ-SKL-003,
REQ-SKL-004, REQ-SKL-005 e REQ-SKL-006. Todos `origin: specs`, conferidos em
`specd spec --json`.

## Não-escopo

- O achado 3, que vive em `explore` e é independente
- Qualquer mudança em código de produção que não seja consequência direta de uma
  âncora reescrita
- Fabricar reescrita em voo para exercitar o critério c1 de REQ-SKL-008

## O defeito de cada um, conferido

| Requisito | Statement, como está | Âncoras declaradas | O defeito |
| --- | --- | --- | --- |
| REQ-EFF-003 | `SHALL exit 0 whenever it can read the specification, regardless of anchors, coverage or evidence` | `test/spec/exit-contract.test.ts :: spec informs and never judges` | nomeia camadas que o comando não roda; e um critério sobre requisição de rede pendurado num requisito de código de saída |
| REQ-SKL-001 | `the skill sources of the explore, propose, apply and archive steps` | `package.json :: "files"` + `skills/specd-explore/SKILL.md` | quantifica sobre quatro, alcança um; e o critério "nenhuma skill referencia caminho fora do pacote" não tem teste |
| REQ-SKL-003 | `IF the installed specd executable is older than the minimum version a skill declares, THEN the skill SHALL stop before acting` | `src/init/skills.ts :: SKILL_MANIFEST` | a âncora resolve e não realiza: o manifesto instala, a parada mora no texto das skills |
| REQ-SKL-004 | `Every specd skill SHALL obtain the effective specification from the specd spec command` | `skills/specd-explore/SKILL.md` | quantifica sobre todas, alcança uma |
| REQ-SKL-005 | `WHEN a specd skill reaches a decision …, the skill SHALL ask the author …` | `skills/specd-propose/SKILL.md` | idem |
| REQ-SKL-006 | `IF a board is configured and cannot be reached, THEN the specd skill SHALL stop and report the failure` | `skills/specd-archive-change/SKILL.md` | idem |

## Os seis não são seis problemas

Debaixo de cinco deles há uma pergunta só: **como se ancora requisito cujo
comportamento vive em mais de um `SKILL.md`?** REQ-SKL-003, ao perder a âncora de
código, cai no mesmo lugar — parar diante de CLI velha é comportamento dos
quatro arquivos, não de um.

REQ-EFF-003 é o único de forma diferente: o problema dele é o texto, e a âncora
está correta.

## A quantificação real de cada um não é sempre "as quatro"

Conferido no texto das skills e nas listas de `test/skills/content.test.ts`:

| Requisito | Skills a que o comportamento se aplica |
| --- | --- |
| REQ-SKL-001 | as quatro, porque o pacote as carrega |
| REQ-SKL-003 | as quatro, porque todas declaram `requires_specd` |
| REQ-SKL-004 | explore, propose, apply — `archive` não lê a spec efetiva |
| REQ-SKL-005 | as quatro |
| REQ-SKL-006 | explore, propose, archive — `apply` não fala com o board por decisão |

Qualquer saída tem que respeitar isso. Ancorar REQ-SKL-004 nas quatro afirmaria
sobre `archive` uma coisa que a matriz de escrita nega de propósito.

## As três saídas de ancoragem, com custo

### A — âncoras múltiplas, uma por `SKILL.md` alcançado

O bloco `anchors` é lista e o gate itera **toda** declaração
(`src/verify/layers/anchors.ts`, laço sobre `entry.requirement.anchors`): lista é
conjunção, cada entrada precisa resolver. A semântica é a que a saída exige.

Custo: o requisito passa a declarar o subconjunto certo, e apagar qualquer skill
alcançada reprova. Em troca, a lista de skills passa a estar escrita em três
lugares — `SKILL_MANIFEST`, as listas do teste de conteúdo, e agora o bloco de
âncoras de cada requisito. Skill nova exige lembrar de acrescentá-la em cada
requisito que a alcança, e esquecer é silencioso: o gate segue verde porque as
âncoras declaradas continuam resolvendo.

### B — âncora no teste que já itera o conjunto

`test/skills/content.test.ts` tem um `describe` por requisito, e cada um itera a
lista certa: `READS_THE_SPEC` para REQ-SKL-004, `TALKS_TO_THE_BOARD` para
REQ-SKL-006, `SKILL_MANIFEST` para os demais. A âncora vira o nome do `describe`.

Precedente realizado: REQ-EFF-003, REQ-CLI-002 e REQ-CLI-005 ancoram em nome de
teste, conferidos em `specd spec --json`.

Custo: a âncora aponta para o verificador, não para o verificado — quem procura
onde o comportamento mora encontra o teste e não a skill. E renomear `describe`
reprova o gate, que é a fragilidade já conhecida de REQ-EFF-003. Em troca, o
conjunto fica declarado num lugar só: a lista que o teste itera.

### C — estreitar o statement para a skill que a âncora alcança

REQ-SKL-004 passaria a falar da skill de explore, e o comportamento das outras
duas viraria requisito próprio. Statement e âncora casam por construção.

Custo: multiplica requisitos por skill, e a spec passa a repetir o mesmo
comportamento em três blocos que precisam ser mantidos iguais à mão — a forma que
REQ-CLI-011 já rejeitou noutro contexto, "duas listas do mesmo são duas chances
de discordar". E não serve para REQ-SKL-001, cujo statement é sobre o pacote
conter as quatro: estreitar ali seria mudar o que o requisito afirma.

## A instância de c1 provavelmente não vem desta change

O conserto de REQ-SKL-003 é troca de âncora **decidida no propose**, então ela
entra no delta e não é âncora reescrita durante o apply. A segunda janela deve vir
vazia de novo, e o critério c1 de REQ-SKL-008 seguirá sem instância dentro de uma
change própria.

Isso fica registrado como observação verdadeira. Fabricar reescrita em voo para
exercitar o critério seria evidência produzida para si mesma, que é pior que
evidência ausente — e c1 já tem sua instância real citada, REQ-ARC-014.

## Perguntas em aberto

Uma, e vale para os cinco de uma vez: qual das três saídas de ancoragem. A
escolha é do autor, e o delta espera por ela.
