# Sandbox — índice

`sandbox/sample05` é um ERP .NET real: 206 arquivos, 171 `.cs`, 1 `.sln`, 12
`.csproj`, com um par `legacy/` + `modernized/` que declara tipos de mesmo nome
dos dois lados. Serve como repositório que o specd nunca viu — é onde se descobre
o que os testes não descobrem.

Ignorado pelo git. Isto é bloco de notas, não artefato.

## Runs

| # | Quando | Contra | Veredito |
| --- | --- | --- | --- |
| [001](runs/001-fatia-3.md) | 2026-07-28 | fim da Fatia 3 | Busca de fallback vê zero arquivos e o gate fica verde sem avisar; `init` não reconhece .NET. |
| [002](runs/002-fatia-4.md) | 2026-07-28 | fim da Fatia 4 | Cinco dos seis critérios; busca passou de 0 para 211 arquivos, colisão de prefixo morta, extrator de termos ainda sem candidata única. |
| [003](runs/003-fatia-5.md) | 2026-07-28 | fim da Fatia 5 | Adaptador de hook mede certo e falha fechado; `--file` resolve o que o extrator não resolvia; `install` duplicava com executável custom — corrigido; bloqueio ao vivo não observado. |
| [004](runs/004-redmine-setup.md) | 2026-07-28 | Redmine 6.1.3, antes da Fatia 6 | Instância sobe do zero em 36 s e é viável em CI; `custom_fields` é heterogêneo em chaves e vazio tem duas formas; `updated_on` move por evento estrutural, então não substitui o `synced_hash`. |
| [005](runs/005-fatia-6.md) | 2026-07-28 | fim da Fatia 6 | `sync` medido contra Redmine real, sete critérios cobertos; quatro escritas couberam mas não bastaram — faltavam duas leituras; tracker sem workflow aceita `status_id`, responde 204 e não aplica; bloqueio ao vivo observado nove vezes num fluxo comum. |
| [006](runs/006-onboarding.md) | 2026-07-29 | fim da Fatia 6, alvo .NET limpo | Diagnóstico de onboarding: `init → verify → sync` funciona em 10 passos, mas o README manda `npx specd` que dá 404 e nenhum documento diz como rodar do fonte; o config do `init` não conhece `sync` e afirma que conhece; `changes/` não tem formato documentado. Nada consertado. |
| [008](runs/008-fatia-8.md) | 2026-07-29 | fim da Fatia 8 | Órfã declarada com corpo reaparecendo passa a recusar e morte proposta ganha estado próprio, ambas medidas contra o container; o limite por corpo está declarado e medido fechando o card; uma decisão que a spec não tomou apareceu como restrição de task impossível; quatro revisões automáticas, zero achados ≥80 e três consertos de qualidade. |
| [007](runs/007-fatia-7.md) | 2026-07-29 | fim da Fatia 7 | Os três caminhos de órfã medidos contra o container, inclusive o rename do run 006; dois requisitos pediram decisão que a spec não tomou; um teste da Fatia 6 codificava o comportamento errado e foi corrigido; requisito sob REMOVED sai da spec efetiva ao abrir a change, e trava o `sync` até o archive. |
| [009](runs/009-calibracao-revisores.md) | 2026-07-29 | o método de revisão: 4 diffs com defeito conhecido, revisores cegos | 2 dos 3 plantados vistos, só 1 cruzou o corte de 80; órfã declarada passou ilesa pelos três; o controle só virou controle depois de dois vazamentos da montagem; nota acompanha o foco do revisor, não a gravidade. |
| [010](runs/010-calibracao-replicacao.md) | 2026-07-29 | a mesma pergunta, execução concorrente que não sabia do 009 | 0 dos 3 plantados cruzou o corte; órfã declarada zero nas duas execuções, seis revisores; o marcador que lá saiu a 92 aqui passou ileso — painel é ruidoso; falso positivo a 90 refutado por execução enquanto defeito real ficava em 40–50; CLAUDE.md injetado no subagent torna o controle incegável nas duas montagens. |
| [011](runs/011-cycle-skills-sem-board.md) | 2026-07-29 | skills próprias, modo sem board, alvo Node sintético | Ciclo fecha nas quatro skills e o gate fica verde; a guarda de versão barrou as próprias skills porque o pacote ainda dizia 0.2.0; camada `project` pegou o `npm test` quebrado do alvo. |
| [012](runs/012-cycle-skills-com-board.md) | 2026-07-29 | skills próprias, modo com board, Redmine 6.1.3 no container | Transição para `Resolved` medida ao vivo com releitura, card divergente recusado e change sem card reprovada; `sync` na etapa de propose quebra com ENOENT quando a change cria capability nova. |
| [013](runs/013-cycle-skills-hostil.md) | 2026-07-29 | board configurado apontando para porta morta | Nada degradou para o modo sem board: explore com source obrigatória, sync e archive --sync saem 2 e o archive fica de pé com o board atrás; `explore` sem source declarada sai 0 dizendo `usable`, e `archive` não roda `provenance` nem `schema`. |
| [014](runs/014-archive-preconditions-negativo.md) | 2026-07-30 | o conserto do achado 2, pelo lado da recusa | `archive` recusa por schema e por provenance sem escrever nem mover nada, e a mesma change corrigida arquiva; delta quebrado de outra change aberta não bloqueia, então `archive` pode sair 0 enquanto `verify` sai 1. |

Cada arquivo em `runs/` é imutável depois de escrito. Corrigir run antigo destrói
a evidência de que o comportamento mudou — que é o que esses arquivos provam. Run
novo registra o que fechou; o índice só perde a linha.

## Pendências abertas

**A saída 4 do marco está decaindo para a saída 3, por não ter quem a cobre.**
Registrado em 2026-07-31, na primeira change em que a regra nova se aplicava:
`2026-07-31-usable-vacuous` não tem `propose.json` porque ninguém rodou
`propose-record` no propose.

O mecanismo, não o esquecimento: a `specd-propose` manda rodar o comando no passo
5, e nada verifica que rodou. O `archive` cai para recorte largo quando o arquivo
falta — comportamento certo, e exatamente o que torna a ausência indolor.
Fallback seguro que ninguém sente é fallback que vira permanente.

O desenho escolheu a saída 4 sobre a 3 para não ter recorte largo por definição.
Sem cobrança, a 4 entrega recorte largo por hábito: a alternativa descartada
chegando pela erosão, em vez de pela decisão.

Terceira vez hoje que regra vivendo só em texto de skill foi furada pelo próprio
autor. As duas anteriores — a janela de reescrita e a exceção da change sem task
— viraram guarda no CLI no mesmo dia. Esta ainda não.

Agravante: a janela já fechou nesta change, com as duas tasks `done`. Nem
corrigindo dá para rodar o comando agora, e o registro dela não existirá nunca.

**~~O `RELATORIO.md` e as runs não sobrevivem a um clone~~ — resolvido em
2026-07-31.** Os registros e este índice passaram a ser versionados, por negação
no `.gitignore`; os alvos de rodada continuam fora. A separação é entre coisas de
propriedades opostas: registro é markdown imutável e pequeno, alvo é projeto
completo com `.git` próprio. Cada registro de 011 a 014 ganhou a receita do seu
alvo, marcada como acréscimo, porque é isso que permite ao alvo ficar de fora.

Registro original:

**O `RELATORIO.md` e as runs são a fonte única desta sequência, e não sobrevivem a
um clone.** `sandbox/` é gitignored — só o `README.md` é versionado. Tudo o que
está nesta seção, mais os registros de método, mais a run 014, que é a evidência
de que o achado 2 foi consertado, existe só nesta máquina.

A ironia fica registrada: este levantamento também está no arquivo não versionado.

Saídas, com custo, nenhuma escolhida:

- **Versionar `sandbox/` inteiro.** Runs, relatório e alvos de rodada. Traz a
  evidência toda para o repositório e leva junto o volume: os alvos sintéticos das
  runs 011–014 são projetos completos, com `node_modules` fora mas `.git` próprio
  dentro de alguns. Diff de cada rodada passa a aparecer no histórico do produto.
- **Versionar só o `RELATORIO.md`.** A fila e os registros de método sobrevivem;
  as runs continuam locais. Custo: o relatório aponta para runs que quem clonar
  não tem — cada link vira referência morta, e a evidência que sustenta cada
  pendência fica de fora justamente onde ela é citada.
- **Mover as pendências para lugar já versionado.** `docs/` é o candidato óbvio.
  Custo: pendência é estado de trabalho e `docs/` é documentação de produto;
  misturar os dois faz um crescer com o ruído do outro. E `.specd/` está fora de
  cogitação — pendência não é requisito, e enfiá-la lá contamina a verdade
  realizada com lista de tarefas.
- **Mover só a fila, deixando as runs descartáveis.** A fila é o que orienta o
  próximo trabalho; as runs são material de investigação. Custo: aceita perder a
  evidência e ficar com a conclusão, que é a troca que este projeto recusa em
  todos os outros lugares — e a run 014 é precisamente uma conclusão que só vale
  com a evidência junto.

Nenhuma proposta de nome ou formato aqui, de propósito: escolhida a saída, o
formato decorre dela.

**`bundle: usable` também é vácuo no modo sem board.** Achado em 2026-07-31 na
exploração da change `2026-07-31-usable-vacuous`. Repositório sem `[board]` e sem
fonte nenhuma imprime `bundle: usable` — a mesma verdade vacuamente verdadeira do
achado 3, aparecendo onde ela não incomoda ninguém, porque lá não há o que
coletar. Não é o achado 3 e não foi consertado; fica registrado para não voltar
como surpresa quando o significado do campo mudar.

**Decisão pendente: o método de sandbox não está no ciclo.** As duas janelas de
revisão de enunciado leem o que o requisito **diz**. Nenhuma alcança divergência
entre o que ele diz e o que o comando **faz** — e é ali que os defeitos deste
projeto têm aparecido. Os dois furos da janela de escrita do marco apareceram
executando o comando; o segundo apareceu executando a regra recém-escrita, que eu
próprio furei na primeira tentativa de aplicá-la.

O que cobre esse espaço é o método de `sandbox/runs/`: rodar contra algo que a
ferramenta não viu, registrar imutável, e promover o que virou regressão. Ele
produziu todos os defeitos relevantes deste repositório e **não está no ciclo** —
`explore → propose → apply → archive` não menciona rodada nenhuma, e as quatro
skills também não. O que salvou hoje foi prática informal de quem estava
conduzindo.

O custo dos dois lados, para a decisão não ser tomada de um lado só:

- **Rodada por change é cara.** Montar alvo, executar o ciclo inteiro, escrever o
  registro. Revisão cara é revisão que alguém pula — o mesmo argumento que
  derrubou o recorte largo no archive, e que vale igual aqui.
- **Não ter passo nenhum é o estado atual**, e o estado atual depende de alguém
  lembrar. Toda regra que dependeu disso nesta sequência foi esquecida ao menos
  uma vez, inclusive por mim, minutos depois de escrevê-la.

Nenhuma saída proposta, de propósito. A decisão é do autor e não cabe em rodapé.

**O caso degenerado do marco aconteceu na change que o define, sem encenação.**
`2026-07-30-propose-mark` não tem `propose.json` e não pode mais ter: o mecanismo
nasceu dentro dela, e quando o comando existiu a janela de escrita já tinha
fechado. Ela foi arquivada com o recorte largo por ausência de marco, que é o
comportamento declarado para esse caso — a melhor evidência que o mecanismo vai
ter por um tempo, e registrada aqui porque daqui a três meses ninguém lembra que
não foi fabricada.

**Dois furos da janela, achados rodando o comando em vez de raciocinando sobre
ele.** O primeiro: rodei `propose-record` na primeira oportunidade real, com uma
task já `done`, e ele gravou o estado pós-apply sem reclamar — a regra vivia só no
texto da skill. O segundo: a guarda recém-escrita abria exceção para change sem
task, o que é inferir conformidade de dado ausente e deixava o furo alcançável por
simplesmente não criar tasks. Os dois foram fechados no CLI, ainda com o delta
aberto. Change cujo delta só remove continua gravando, por não declarar requisito
nem precisar de task.

Ambos foram achados por execução. Nenhum apareceu na leitura do texto, nem nas
duas revisões de enunciado que o repositório agora institui — elas olham o que o
requisito diz, não o que o comando faz.

**O marco "propose" que REQ-SKL-008 usa como referência não existe no histórico.**
Defeito novo, achado em 2026-07-30 ao verificar o recorte da change
`2026-07-30-weak-statements`. A segunda janela de revisão pergunta o que mudou
**desde o propose**, e nenhuma change desta sequência commitou o delta antes de
implementar: `delta.md` e o teste escrito no apply entraram no mesmo commit, nas
três changes conferidas. A skill de propose não manda commitar, e o `archive` não
grava marco nenhum.

Consequência: a única fonte para datar a reescrita é a memória de quem estava na
sessão — que é o que a revisão existe para não aceitar. Enquanto isso não tiver
saída, o recorte honesto é "todos os requisitos da change", porque nenhum pode
ser provado fora dele. Foi assim que a `weak-statements` foi revisada.

Saídas aparentes, nenhuma escolhida: `propose` commitar o delta ao terminar;
`archive` comparar o delta com a versão dele no primeiro commit que o contém; ou
o recorte assumir o pior caso e revisar tudo, que é o que acontece hoje sem estar
escrito.

**Teste derivado do statement acompanha o statement, então nunca pega statement
errado.** Anotado como forma, não como incidente: quando REQ-SKL-008 foi
reescrito, quatro testes de conteúdo caíram e foram atualizados junto — que é o
comportamento correto de teste que asserta sobre o texto que o requisito
descreve, e é também o motivo de ele não ser verificação no sentido forte. Mesma
natureza da exceção de c3 em REQ-SKL-007: verificação fraca e real, que prova que
a instrução está escrita e não que ela está certa. Quem pega statement errado é a
revisão de enunciado, não o teste dela.

**Nada registra que uma âncora esteve pendurada.** Achado em 2026-07-30 na
exploração da change `2026-07-30-propose-mark`. O critério de REQ-SKL-008 que fala
de "âncora que passou de pendurada a resolvida" não tem artefato por trás: o
relatório do gate mostra o estado de agora, e o de ontem não é recuperável. Sem um
marco que grave o estado de resolução junto do texto, esse critério é
inverificável — o que torna a escolha entre as saídas do marco menos simétrica do
que parece, porque só a que grava estado o sustenta. Não consertado.

**A lista de skills existe em três lugares, e nada verifica que são as mesmas.**
`SKILL_MANIFEST`, as listas de `test/skills/content.test.ts`, e agora o bloco de
âncoras de cada requisito que alcança mais de uma skill.

É a mesma forma do defeito original de REQ-SKL-004, subida um nível. Antes o
statement quantificava sobre quatro e a âncora alcançava uma; agora alcança
quatro, mas nada verifica que quatro continua sendo o número certo. A afirmação
de universalidade segue sem verificação — só ficou mais difícil de errar, porque
apagar uma skill alcançada agora reprova. Acrescentar uma e esquecer não reprova
nada.

Saída parcial para quem pegar: se `test/skills/content.test.ts` derivasse suas
listas de `SKILL_MANIFEST`, três lugares viram dois. O bloco de âncoras continua
manual e é irredutível — é spec, não código. Change própria.

**c1 de REQ-SKL-008 ganhou instância própria, e o limiar não foi atingido.**
Corrigido em 2026-07-30 conferindo o histórico, depois de eu ter afirmado por
dedução que ela seguia sem instância. Na change `2026-07-30-propose-mark` o
statement de REQ-SKL-009 foi reescrito — de "a skill monta o arquivo" para "a
skill roda o comando" — em `3ac3a58`, depois de a primeira task ter saído de
`pending` em `8035a40`. Requisito cujo texto foi reescrito durante o apply, que é
a forma que o critério descreve.

A decisão de cortar c1 sai da mesa. E vale o registro do método: as duas vezes em
que eu declarei recorte por dedução, o histórico contradisse — aqui, e ao dizer
vazio o recorte da `weak-statements`.

**Quatro enunciados promovidos abaixo do padrão, em `d0daf7c`.** Achados na
leitura final, depois de as âncoras terem sido conferidas — e enunciado fraco é
exatamente o que âncora não pega. Exigem delta MODIFIED, porque já estão em
`origin: specs`.

- `REQ-EFF-003` — o statement é sobre código de saída e diz `regardless of
  anchors, coverage or evidence`, nomes de camada que o comando `spec` não roda;
  a frase se lê como se ele as executasse e ignorasse o resultado. O critério
  "nenhuma requisição de rede é feita" é um segundo comportamento pendurado num
  requisito sobre exit code.
- `REQ-SKL-001`, `REQ-SKL-004`, `REQ-SKL-005`, `REQ-SKL-006` — o statement
  quantifica sobre todas as skills e a âncora aponta para uma. Apagar a skill que
  a âncora não cita não move o gate.
- `REQ-SKL-003` — a âncora é `src/init/skills.ts :: SKILL_MANIFEST`, o manifesto
  de instalação, enquanto o comportamento enunciado — a skill parar diante de CLI
  velha — mora no texto do `SKILL.md`.
- `REQ-SKL-001` — o critério "nenhuma skill referencia caminho fora do pacote"
  não tem teste, enquanto os outros três do mesmo requisito têm.

**Revisão de enunciado mora nas duas skills, com pesos diferentes — decidido em
2026-07-30, não implementado.** `specd-propose` revê todo statement que escreve,
onde corrigir é gratuito. `specd-archive-change` revê só o que mudou desde o
propose — requisito reescrito durante o apply, âncora que se moveu — em vez de
reler tudo na porta mais cara.

A razão da divisão está medida: os quatro enunciados fracos passaram por leitura,
apply, gate verde e archive sem ninguém parar neles, e a âncora errada de
`REQ-SKL-003` nasceu durante o apply, depois de o delta já ter sido revisado uma
vez. Uma janela só não pega as duas causas.

Não pode entrar no CLI: verificar enunciado é julgamento, e julgamento no caminho
de decisão é o que `no-llm-in-decision-path` proíbe. A skill prepara e pergunta;
quem decide é o autor.

**Quem cria a change é o `explore` — respondido pelo texto da skill, não por
requisito.** `specd-explore` §3 manda criar o diretório da change e escrever
`proposal.md` com a frontmatter, incluindo `card` onde ele é exigido. Fecha a
pergunta que a exploração de 2026-07-29 deixou aberta, e que o overview do chat
ainda registra como indefinida. Anotado para quando o overview for revisado; não
virou requisito.

**Âncora que resolve sem realizar o comportamento é pior que âncora ausente.**
É a distinção que orienta a correção acima, e vale além dela. `SKILL_MANIFEST`
existe, resolve, e vai resolver para sempre — o gate nunca reclama, e a âncora
diz "verificado" sobre uma pergunta que ninguém fez. Âncora ausente pelo menos
aparece: `coverage` a reporta, `anchor suggest` a procura, e alguém decide. A
âncora que aponta para o lugar errado é conformidade aparente, que é a forma que
`absence-is-not-compliance` proíbe do outro lado.

**`sync` quebra na etapa de propose quando a change cria capability nova —
estancado em 2026-07-30, não consertado.** A change
`2026-07-30-sync-unborn-capability` introduziu REQ-SYNC-018: o `sync` recusa
antes de qualquer escrita e sem tocar a rede, nomeando a capability, a change que
a declara e o caminho que falta; o `--dry-run` recusa igual. Isso mata o card
órfão e a duplicação por retentativa, e restaura verificar-antes-de-gastar. O
conserto continua sendo a saída A — ligação viajando com o bloco do requisito,
migrada no `archive` —, que segue aberta e agora tem três razões independentes.

Registro original:

**`sync` quebra na etapa de propose quando a change cria capability nova.** O
link do board vive na frontmatter da spec (REQ-SYNC-007) e o arquivo da
capability só nasce no `archive` — então `sync` planeja o card e falha com ENOENT
ao gravar a ligação. Atinge o passo 6 de `specd-propose` em toda change que
introduz capability. Três saídas possíveis, nenhuma escolhida:
[012 §achado 1](runs/012-cycle-skills-com-board.md). Defeito pré-existente; o
ciclo novo passa por ali toda vez.

**~~`archive` não roda `provenance` nem `schema`~~ — fechado em 2026-07-30.**
A change `2026-07-30-archive-preconditions` ampliou REQ-ARC-002: pré-condição
passa a ser toda camada offline de `verify.levels`, escopada à change, sem
`project` (duplicaria o `verify`) e sem `anchors` (REQ-ANC-007 é mais dura).
REQ-ARC-015 declarou o corte do diagnóstico. Implementar expôs uma colisão que o
desenho não tinha visto: a retomada de REQ-ARC-010 deixa o requisito já em
`.specd/specs/`, que o `schema` lê como "ADDED mas já existe" — o plano passou a
ser computado antes das pré-condições e o conjunto `alreadyApplied` dispensa
exatamente esses. Duas fixtures descreviam estado que o gate reprova e passavam
pelo buraco.

Fica aberto o irmão menor: task `pending` continua não bloqueando o archive,
embora a skill exija toda task `done`. A regra vive na camada que pode esquecer.

**`explore` com board inalcançável e nenhuma source declarada sai 0 e diz
`usable`.** Coerente com REQ-EXP-003 e ruim no ciclo: duas configurações que se
leem como "tenho board" produzem desfechos opostos diante da mesma queda de rede.
[013 §achado 1](runs/013-cycle-skills-hostil.md).

**`card = "required"` liga junto com o board.** Default de REQ-CFG-012: quem hoje
só usa `sync` passa a reprovar em toda change ao atualizar. Custo de adoção
declarado, não conserto — as próprias fixtures de integração são o caso, e passam
só por causa do achado acima. [012 §achado 2](runs/012-cycle-skills-com-board.md).

**Dois momentos de virar real, ainda em aberto.** Externamente no `sync`,
internamente no `archive`. Registrado no proposal da Fatia 7 sem resolver, agora
com uma segunda instância concreta pelo lado da remoção. A Fatia 8 corrigiu os
dois sintomas localmente e **não** decidiu a pergunta — o que ela mostrou é que
a causa é assimetria de representação: ADDED e MODIFIED têm duração no modelo,
REMOVED é instantâneo, e `coverage.ts:20` escreve a premissa em prosa. Agora a
pergunta é **observável**: um teste conta o card nascendo quando a change abre e
morrendo quando ela arquiva ([008 §5](runs/008-fatia-8.md#5-uma-consequência-do-estado-novo)).
O relógio continua sendo divisão de requisito virar operação comum.

**Onze subprodutos das calibrações, a triar.** Os painéis dos runs 009 e 010
acharam defeitos reais que ninguém plantou; sete continuam vivos em `fc0de9d`
(entre eles `scanFilter` morto com âncora verde — P7 — e `closedStatusId`
escolhendo o primeiro `is_closed` — P4). Tabela em
[010 §6](runs/010-calibracao-replicacao.md#6-subprodutos--achados-novos-a-triar)
e laterais em [009](runs/009-calibracao-revisores.md#achados-laterais-não-plantados).
Triagem é trabalho de fatia, não de run.

**Regra de governo proposta pelas calibrações, decisão do autor.** Achado de
revisor que cita documento de governo precisa citar a linha de código que o
confirma; revisão sem achados relata o que procurou. E o corte fixo em 80
descarta a faixa 40–80, onde os defeitos reais das duas execuções viveram.
Mudança na linha do painel do CLAUDE.md/AGENTS.md — proposta nos dois runs,
escrita em nenhum.

**Ligação viajando com o bloco: candidato com duas razões independentes.** A
primeira, da Fatia 7 — única opção que responde à divisão de requisito. A
segunda, da exploração dos dois momentos — a alternativa óbvia, vocabulário de
transição no delta, coloca escrita destrutiva no board sob decisão de LLM, que é
o que P1 estendido rejeita. Independentes: a primeira cai se divisão não virar
comum, a segunda vale mesmo que ninguém divida requisito nunca. Continua
candidato.

**`0/0 tasks done`, quarta reincidência de ausência lida como conclusão.**
Anotada com gatilho: se voltar uma quinta vez, vira trabalho próprio.

**Pin do Redmine é 6.1.3; a linha 7.0 não foi exercitada.** `custom_fields` é
exatamente a parte do payload que muda entre linhas maiores. Trocar o pin e
rodar o mesmo seed é barato e ninguém rodou.
[004 §6](runs/004-redmine-setup.md#6-o-que-este-run-deixa-aberto).

**Um adaptador só, numa interface desenhada para dois.** A costura do `link` e a
divisão entre escritas e leituras são argumentos sobre o Azure DevOps, não
medições dele. Registrado em
[005 §8](runs/005-fatia-6.md#8-o-que-este-run-deixa-aberto). A Fatia 8
acrescentou um caso concreto: o Azure DevOps tem *Removed* como estado distinto
de *Closed*, então "fechar" pode não ser o verbo certo lá, e órfã declarada
poderia ter duas dispositivas em vez de uma.

**Sem escrita condicional no board.** O Redmine não expõe `lock_version` e o
`PUT` não honra `If-Match`. Entre ler e escrever há janela que o merge de três
vias não fecha. Mesma referência.

**Formato do payload do hook é contrato de terceiro.** Escrito contra a convenção
documentada, não contra comportamento observado. Se mudar, o exit code continua
bloqueando, mas a razão pode deixar de chegar ao agente. Registrado em
[003 §6](runs/003-fatia-5.md#6-o-que-este-run-deixa-aberto).

## Pendências fechadas

**Quatro revisões com zero achados ≥80 era dado ambíguo** — fechada duas vezes,
runs 009 e 010, execuções independentes e concorrentes. O teto era do método:
o defeito mais caro do histórico (órfã declarada) passou ileso por seis
revisores nas duas montagens, e "zero achados" passa a ler-se como
"internamente consistente", não "certo". A classe que importa — consistente por
dentro, errado contra o mundo — continua caindo só ao rodar contra coisa nova,
que é o que as quatro instâncias do P8 já diziam.

**Órfã declarada com corpo reaparecendo fechava card em silêncio** — fechada na
Fatia 8. A Fatia 7 isentava o caminho declarado da busca de candidato, então
renomear requisito já realizado (`REMOVED` mais `ADDED` de mesmo corpo, a única
forma de dizer rename no delta) fechava e recriava. Corpo passa a vencer
declaração. O limite está declarado no requisito e medido contra o container:
rename que edita o corpo ainda fecha
([008 §4](runs/008-fatia-8.md#4-o-limite-declarado-medido)).

**`sync` travava com change de remoção aberta** — fechada na Fatia 8 com o
terceiro estado de órfã: identificador sob REMOVED de change aberta é deixado em
paz e relatado como `retiring`, sem mexer em `effectiveSpecs`. O sinal já estava
no disco e `buildSpecTree` o descartava.

**As três do run 006** — fechadas na Fatia 7. README e AGENTS.md dizem como
rodar do clone, com teste amarrando o caminho ao `bin`; `docs/format.md` publica
os três formatos, com teste que extrai os exemplos da página e os passa pelos
parsers; teste exige toda chave de `ConfigSchema` no template do `init`
([007 §6](runs/007-fatia-7.md#6-o-contrato-que-a-prosa-ganhou)).

**Renomear requisito em delta fechava card sem avisar** — fechada na Fatia 7 e
promovida a princípio. `sync` só fecha o que `retired` declara morto; órfã não
declarada para o comando e nomeia o candidato a rename. Os três caminhos medidos
contra o container ([007 §1](runs/007-fatia-7.md#1-os-três-caminhos-de-órfã-contra-o-servidor)).

**`validation_command` ausente saía 1** — fechada. A camada ganhou o estado
`blocked` e `verify` sai 2 quando não conseguiu rodar
([007 §5](runs/007-fatia-7.md#5-o-blocked-e-o-que-ele-mudou-de-forma)).

**Redmine local sem teste que o consumisse** — fechada na Fatia 6.
`npm run test:integration` sobe o container, semeia, roda 11 testes e derruba;
`npm run verify` não o invoca, porque o gate não pode exigir Docker
([005 §6](runs/005-fatia-6.md#6-tempo)).

**Acoplamento do hook com o host, não observado** — fechada. O `PostToolUse`
bloqueou nove vezes ao escrever o `delta.md` da Fatia 6, num fluxo de trabalho
comum em vez de num experimento montado
([005 §7](runs/005-fatia-6.md#7-o-gate-bloqueou-nove-vezes-ao-vivo)).

**`format` reformatava runs declarados imutáveis** — fechada. `sandbox/` entrou
no `.prettierignore`; regra que a própria toolchain viola não sobrevive.

**Extrator de termos do `anchor suggest`, modo sem `--file`.** Continua com zero
candidatas únicas em sample05, pela distância entre prosa de requisito e nome de
símbolo. **Deixou de bloquear:** `--file` atende o mesmo fluxo sem adivinhar, e
foi medido contra os três requisitos que o extrator não atendia
([003 §4](runs/003-fatia-5.md#4-anchor-suggest---file-contra-o-sample05)).
Diagnóstico da causa em
[002](runs/002-fatia-4.md#o-critério-que-não-foi-atingido-e-por-quê).

**Conteúdo de template não tem contrato** — fechada em duas etapas. A lista de
camadas virou derivada de `VERIFY_LEVELS` na Fatia 4; a cobertura de chaves virou
teste contra `ConfigSchema` na Fatia 7. A prosa dos comentários continua
verificável só por leitura humana, e isso é o que sobra em aberto.
