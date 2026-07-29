---
change: 2026-07-fatia-7
target: [sync, archive, config, spec-format, cli, verify]
---

# Delta — Fatia 7

Fechar o laço `archive → sync`, parar de fechar card sem perguntar, e dar
contrato à prosa que o run 006 mostrou estar mentindo.

## ADDED

### REQ-SYNC-014 — Closing a board item requires a declared death

**Capability.** sync

**Statement.** The specd sync command SHALL close a board item only when the identifier that links it is listed as retired in the capability frontmatter.

**Acceptance.**

- Identificador em `retired` fecha o item e remove a ligação
- Identificador ausente da spec e ausente de `retired` não fecha nada
- `retired` é lido do arquivo de capability que declara a ligação, não de configuração
- Nenhuma escrita no board ocorre para órfã não declarada, nem para os itens sadios da mesma execução

O sinal já existia e o `sync` não o lia: `archive` acrescenta a `retired` todo
identificador sob REMOVED, então morte declarada é um fato registrado no
arquivo. Comparar chave ligada contra chave planejada e chamar toda diferença
de morte foi a ferramenta ignorando o próprio modelo.

O que se perde ao fechar por engano não é o card: é o comentário, o anexo e o
apontamento de hora que alguém pendurou nele, e que a spec não sabe que
existem.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export function findOrphanedLinks"
```

### REQ-SYNC-015 — An undeclared orphan stops the command and names the candidate

**Capability.** sync

**Statement.** IF a board link has no requirement in the spec and its identifier is not listed as retired, THEN the specd sync command SHALL exit with code 2 naming the link, the board item and any unlinked planned item whose body matches the board item's body.

**Acceptance.**

- Órfã sem declaração sai 2 nomeando identificador, `ref` e URL do item
- Item planejado ainda sem ligação e com corpo idêntico ao do card órfão é nomeado como rename provável, sem ser aplicado
- Mais de um candidato com o mesmo corpo lista todos e não escolhe
- Nenhum candidato é reportado como tal, e a recusa continua valendo
- A mensagem diz as duas saídas: trocar a chave da ligação, ou declarar o identificador em `retired`
- Nada é escrito no board nem na spec, nem para os itens sem problema

P4 na forma que interessa: há dois estados possíveis — o requisito morreu ou
mudou de nome — e a diferença entre eles é destrutiva numa direção. O corpo
idêntico é indício forte e não é prova, então ele informa e não decide.

A comparação é pelo **corpo**, não pela projeção inteira, e isso é decisão de
desenho e não detalhe. O título de um item deriva do identificador — renomear
muda o título por construção —, então projeção idêntica nunca casaria justamente
no caso que este requisito existe para pegar. O corpo é o que sobrevive à
renomeação, e é por isso que ele é o sinal.

Renomear deixa de ser grátis e passa a ser barato e recusado até ser declarado,
que é P9 aplicado: o custo aparece no momento em que é pago, e não três semanas
depois num card fechado que ninguém procurou.

```yaml anchors
- file: src/sync/errors.ts
  symbol: "export class UndeclaredOrphanError"
```

### REQ-ARC-011 — Archive syncs only when asked

**Capability.** archive

**Statement.** WHERE the `--sync` flag is given, the specd archive command SHALL run the board reconciliation after the capabilities have been written.

**Acceptance.**

- Sem `--sync`, nenhuma requisição ao board é feita
- Com `--sync`, a reconciliação roda depois de as capabilities estarem escritas
- Com `--sync` e sem board configurado, sai 2 antes de aplicar o delta
- Não existe `--no-sync`: a ausência da flag já é o não

REQ-SYNC-001 diz que o `sync` escreve no board só quando invocado diretamente
por uma pessoa. `archive` sincronizando por conta própria quebra o requisito;
`archive --sync` não, porque continua sendo alguém digitando — e a escrita
externa continua declarada, que é P9.

A flag existe em vez de só um aviso porque o modo de falha do aviso é esquecer,
e esquecer é o caso comum. Ela transforma dois comandos num ato deliberado sem
transformar nenhum ato em automático.

Não existe `--no-sync` porque duas flags para um booleano é botão sem dois
clientes divergindo, que é P5.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export interface ArchiveOptions"
```

### REQ-ARC-012 — A failed sync never undoes the archive

**Capability.** archive

**Statement.** IF the board reconciliation fails after the capabilities have been written, THEN the specd archive command SHALL exit with code 2 leaving the written capabilities and the archived directory in place.

**Acceptance.**

- Capabilities escritas permanecem escritas, e fora do índice do git
- O diretório da change permanece movido para `archive/`
- A mensagem diz que a spec avançou e o board não, e manda rodar `specd sync`
- Rodar `specd sync` em seguida alcança o board sem repetir o archive

A ordem é `archive` primeiro e `sync` depois, e ela é escolhida: a spec adiante
do board é recuperável por um comando idempotente, enquanto o board adiante da
spec deixa card para requisito que o repositório não reconhece.

Desfazer o `archive` seria pior que as duas. O que ele escreveu está correto e
está fora do índice, ao alcance da revisão — desfazer destrói trabalho bom por
causa de uma falha de rede, e é exatamente a decisão silenciosa que P9 proíbe.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export class ArchiveSyncError"
```

### REQ-ARC-013 — Archive without the flag reports what stayed out of sync

**Capability.** archive

**Statement.** WHERE a board is configured and `--sync` is absent, the specd archive command SHALL report how many archived items have no board link or a stale one.

**Acceptance.**

- Contagem aparece na saída do `archive`, nomeando o comando que a resolve
- Sem board configurado, nada é reportado e nada é contado
- A contagem é obtida sem requisição ao board, a partir das ligações gravadas
- Contagem zero é dita explicitamente, e não omitida

Sem isto, "rode `specd sync` depois" é prosa, e prosa não tem contrato — que é o
defeito que esta fatia inteira ataca. Requisito com critério de aceite é a
diferença entre um lembrete que se apaga e um comportamento que se testa.

A contagem não consulta o board de propósito. `archive` sem `--sync` não toca a
rede, e um relatório que precisasse dela falharia offline — informação sobre
sincronia virando motivo para não conseguir arquivar.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function countUnsyncedItems"
```

### REQ-CFG-011 — The init template covers every supported configuration key

**Capability.** config

**Statement.** The specd init template SHALL mention every key that `ConfigSchema` accepts.

**Acceptance.**

- Teste falha quando uma chave nova entra em `ConfigSchema` e não entra no template
- Chave pode aparecer comentada; o que se exige é que exista no arquivo
- A falha nomeia as chaves ausentes, não só o total
- O teste lê `ConfigSchema` em vez de uma segunda lista escrita à mão

O template abre afirmando que toda seção suportada está ali, e no run 006 seis
chaves faltavam — quatro do `sync` e duas do transporte MCP, estas desde antes
da Fatia 6. Ninguém percebeu por três fatias, porque afirmação em prosa não
falha.

Mesma família da lista de camadas que a Fatia 4 tornou derivada de
`VERIFY_LEVELS`. Aquela correção resolveu um caso e o padrão voltou em cinco
lugares novos; este é o segundo a ganhar contrato.

```yaml anchors
- file: test/init/config-template.test.ts
  symbol: "covers every ConfigSchema key"
```

### REQ-FMT-010 — The documented delta and task examples parse

**Capability.** spec-format

**Statement.** The delta and task examples published in the format documentation SHALL parse without errors under the parsers that read those files.

**Acceptance.**

- Exemplo de `delta.md` da documentação passa por `parseDelta` sem diagnóstico de erro
- Exemplo de task passa por `parseTask` sem diagnóstico de erro
- O teste extrai os exemplos do documento, sem cópia paralela no teste
- Mudança de parser que invalide o exemplo publicado reprova o gate

O run 006 gastou seis voltas de tentativa e erro para escrever uma change,
todas ensinadas por mensagem de erro e nenhuma por documentação. Sem `propose`,
escrever à mão é o único caminho, e era o não descrito.

Documentar sem contrato trocaria "não documentado" por "documentado e errado",
que é pior: o primeiro manda a pessoa procurar, o segundo manda ela confiar.
Extrair o exemplo do próprio documento é o que impede a documentação de
envelhecer em silêncio.

```yaml anchors
- file: test/parser/documented-examples.test.ts
  symbol: "documented examples parse"
```

### REQ-CLI-007 — The README names an invocation that works before publication

**Capability.** cli

**Statement.** The README SHALL document how to build and run specd from a clone, for as long as the package is absent from the registry.

**Acceptance.**

- README mostra a sequência que leva de clone a comando funcionando
- O caminho do executável citado é o mesmo que `package.json` declara em `bin`
- Teste falha se `bin` mudar e o README não acompanhar
- `npx specd` continua documentado como o caminho de quem instala, com a ressalva de que ainda não está publicado

É a única parede absoluta do onboarding e está no primeiro passo: `npx specd`
devolve 404 e nenhum documento diz o que fazer em vez disso. Quem para no
primeiro comando não vira usuário, e o produto morre onde ninguém olha.

O acoplamento com `bin` é o pedaço que dá para verificar. O resto continua sendo
prosa, e está declarado como tal no proposal.

```yaml anchors
- file: test/distribution/readme.test.ts
  symbol: "README names the bin path"
```

### REQ-VER-013 — A validation command that cannot be executed is operational

**Capability.** verify

**Statement.** IF the configured validation command cannot be executed at all, THEN the specd verify command SHALL exit with code 2 instead of failing the gate.

**Acceptance.**

- Executável ausente sai 2 e a mensagem diz que a camada não pôde rodar
- Comando que existe e retorna não-zero continua saindo 1, porque é veredito
- A mensagem lista as saídas: instalar o executável, trocar `validation_command`, ou tirar `project` de `levels`
- O relatório distingue camada que reprovou de camada que não pôde rodar

`dotnet` não instalado reprovava o gate como se a spec estivesse errada, e o
README vende exatamente a distinção que isso quebra: CI precisa separar "spec
reprovou" de "ferramenta quebrou".

É a forma do P8 uma casa acima. Não é verde onde deveria ser vermelho — é
vermelho do tipo errado, e quem confia na distinção age errado com a mesma
confiança de sempre. O `init` propõe o comando sozinho, então a pessoa nem
escolheu rodar `dotnet test`.

```yaml anchors
- file: src/verify/layers/project.ts
  symbol: "export function classifyCommandFailure"
```

## MODIFIED

Nenhum.

## REMOVED

Nenhum.
