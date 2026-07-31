# Exploração — propose-mark

## Origem do escopo

Sem board neste repositório. O escopo veio do defeito registrado em
`sandbox/RELATORIO.md` em 2026-07-30: o marco "propose" que REQ-SKL-008 usa como
referente não existe no histórico.

## Escopo

Dar ao recorte da segunda janela um referente que possa ser lido, e escrever no
requisito o que acontece quando ele não existe.

## Não-escopo

- O achado 3, a saída A do achado 1, a lista de skills em três lugares
- Qualquer mudança na primeira janela, REQ-SKL-007
- Verificação de enunciado no CLI

## O que foi conferido

REQ-SKL-008 e REQ-SKL-007 estão em `origin: specs`, conferidos em
`specd spec --json`. Mexer no recorte é `MODIFIED` em REQ-SKL-008.

Fatos do repositório que restringem as saídas:

- **specd não exige git.** `src/core/root.ts` define o projeto por ter `.specd/`,
  e diz por escrito que isso vale sem git. A camada `evidence` é a única que
  consulta história, e só quando alguma task declara commit — `requireGitHistory`
  sai 2 nomeando a ausência em vez de reprovar. Qualquer saída que dependa de git
  herda essa fronteira.
- **Já existe precedente de artefato de máquina dentro da change.**
  `explore/manifest.json`, por REQ-EXP-004 e REQ-EXP-006: escrito por comando,
  versionado junto do trabalho que justifica, lido depois.
- **Já existe precedente de hash gravado no artefato.** `synced_hash`, por
  REQ-SYNC-004: hash sobre projeção normalizada, gravado ao lado da coisa que ele
  descreve, para responder "mudou desde a última vez".

## As quatro saídas

### 1. `propose` commita o delta ao terminar

**Exige de `specd-propose`:** rodar `git add` do diretório da change e commitar,
ou pedir ao autor que commite antes de seguir.
**De `specd-archive-change`:** achar o commit onde o delta apareceu e comparar.
**Do CLI:** nada.
**Custo por change:** um commit a mais, e uma escrita em história — que é a
categoria de operação que este repositório trata com mais cerimônia.

**A tensão que precisaria estar escrita:** `specd archive` deixa tudo sem stage de
propósito, porque o diff é para ser lido antes de virar história (REQ-ARC-007).
Uma skill que commita ao terminar o propose contradiz essa postura na aparência.
A razão de a assimetria existir teria que ficar escrita junto — algo como: o
delta é proposta, e proposta registrada é o que torna a revisão posterior
possível; o archive escreve verdade realizada, e verdade realizada é o que mais
merece leitura antes de virar história. Sem isso escrito, a próxima pessoa desfaz
uma das duas por coerência aparente.

### 2. `archive` compara com a primeira versão versionada do delta

**Exige de `specd-propose`:** nada.
**De `specd-archive-change`:** `git log --diff-filter=A` do `delta.md` e
`git show <sha>:<caminho>`.
**Do CLI:** nada.
**Custo por change:** nenhum, quando há git e quando o delta foi commitado antes
do apply.

**Falha no caso que motivou a change.** Quando delta e apply entram no mesmo
commit — que é o que aconteceu em todas as changes conferidas — a primeira versão
versionada **já contém** o trabalho do apply, e a comparação devolve "nada
mudou". O recorte sai vazio, e vazio incorreto é a forma exata do defeito que se
quer corrigir: "não consegui verificar" apresentado como verde.

Também herda a fronteira do git: em repositório sem história, não há resposta.

### 3. Assumir o pior caso, com o recorte largo declarado

**Exige:** nada de ninguém, além de reescrever REQ-SKL-008 para dizer que o
recorte é todo requisito da change.
**Custo por change:** revisar todos, sempre.

É o que já acontece. A diferença é deixar de ser acidente e passar a ser
comportamento declarado — o que tem valor próprio: hoje quem lê o requisito
espera recorte estreito e recebe largo, sem saber por quê.

O preço é o que o desenho recusou: revisão cara na posição em que revisão cara é
pulada. E não há como saber se foi pulada, porque não há artefato.

### 4. A change grava o próprio estado de propose, dentro de `.specd/changes/`

**Exige de `specd-propose`:** ao terminar de escrever o delta, gravar um arquivo
na change com, por requisito, a identidade do texto e o estado da âncora — hash
do bloco e se a âncora resolvia naquele momento.
**De `specd-archive-change`:** ler esse arquivo e comparar com o estado atual,
que ela obtém de `specd spec --json` e do gate.
**Do CLI:** nada obrigatório. O material já existe em `specd spec --json` e no
relatório de âncoras; o arquivo é derivável sem julgamento.
**Custo por change:** um arquivo a mais, escrito uma vez, versionado com o resto.

Não depende de git, não força commit, não abre rede. Gravar estado é registro e
não decisão, então não encosta em `no-llm-in-decision-path`.

Tem precedente de forma nos dois lados: `explore/manifest.json` é artefato de
máquina dentro da change, e `synced_hash` é hash gravado ao lado da coisa que
descreve, para responder exatamente "mudou desde a última vez".

**Modo de falha:** alguém edita o delta sem passar pela skill. O arquivo fica
velho, a comparação acusa mudança, e o recorte cresce. Falha para o lado seguro.

## O caso degenerado: change sem propose separável

Delta e implementação nascidos juntos.

| Saída | O que acontece | Direção da falha |
| --- | --- | --- |
| 1 | não há commit anterior ao apply; recorte largo | segura |
| 2 | a primeira versão versionada contém tudo; recorte **vazio** | perigosa |
| 3 | largo por definição | segura |
| 4 | arquivo ausente; recorte largo | segura |

Recorte largo como resposta ao caso degenerado é aceitável — mas em três das
quatro ele é comportamento declarável, e na saída 2 é falha silenciosa.

## Um defeito que a exploração encontrou e não conserta

REQ-SKL-008 diz "âncora que passou de pendurada a resolvida" e nenhum artefato
registra que uma âncora esteve pendurada. O relatório do gate mostra o estado de
agora; o de ontem não é recuperável. Qualquer saída que queira esse critério
verificável precisa gravar também o estado de resolução no marco — o que a
saída 4 faz por construção e as outras três não fazem.

Está registrado em `sandbox/RELATORIO.md`. Não é consertado aqui, e é o que torna
a escolha entre as saídas menos simétrica do que parece.

## Perguntas em aberto

Uma: qual das quatro. O delta espera.
