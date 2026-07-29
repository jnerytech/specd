---
name: handoff
description: Gera um handoff para continuar um trabalho longo em outra conversa, outra sessão ou com outro agente, sempre com data, origem e commit de referência no cabeçalho. Use sempre que o usuário pedir para compactar a conversa, resumir para continuar depois, passar contexto para outro chat, registrar onde o trabalho parou, gerar ou atualizar um HANDOFF.md, "começar uma conversa nova sem perder o fio", ou mencionar que o contexto está ficando grande — mesmo que ele não use a palavra handoff. Também use antes de trocar de ferramenta (do chat para o Claude Code, ou vice-versa) e quando o usuário perguntar o que precisa levar junto.
---

# Handoff

Produz um bloco de contexto que permite retomar um trabalho longo em outro
lugar, carregando o que **só existe na conversa** e nada além disso.

## O princípio

Um handoff ruim é um resumo da conversa. Um handoff bom é o **complemento**
do que já está durável em outro lugar.

Antes de escrever qualquer coisa, descubra o que já sobrevive sem a conversa:

- Arquivos no repositório — decisões, princípios, documentação
- Memória do Claude — preferências, vocabulário, regras permanentes
- Arquivo de projeto no Claude.ai
- Tickets, wiki, board
- Artefatos gerados durante a conversa e já salvos

**Pergunte se não souber.** Duplicar o que já está versionado é pior que
omitir: cria uma segunda cópia que envelhece sem ninguém perceber.

O que sobra depois desse corte é o handoff — normalmente o *raciocínio*, não
os fatos. Por que uma decisão foi tomada, o que foi descartado e por quê, o
que ainda está aberto.

## O que sempre entra

**Decidido, com o porquê.** A decisão sozinha convida a redecidir. "Escolhemos
X" é inútil; "escolhemos X porque Y falhava em Z" é o que impede a próxima
sessão de voltar para Y.

**Aberto, com o que trava.** Questões não resolvidas e o que cada uma bloqueia.
Se nada bloqueia, diga — questão aberta que não trava nada é diferente de
questão aberta urgente.

**Erros cometidos e corrigidos.** A seção que quase todo handoff omite e a que
mais evita retrabalho. Se o assistente errou e foi corrigido, isso vai junto —
senão o erro volta na sessão seguinte, com a mesma confiança.

**Vocabulário com significado local.** Termos que a conversa passou a usar num
sentido específico. Sem isso, a sessão nova usa a mesma palavra com outro
sentido e ninguém percebe.

**O próximo passo concreto.** Não "continuar o projeto". O comando, o arquivo,
a pergunta.

## O que nunca entra

**Contagens e estado que muda.** Número de arquivos, testes, requisitos, itens
concluídos. Fica errado na semana seguinte e ninguém atualiza. Aponte para o
comando ou o lugar que responde.

**O que já está durável.** Se está no repositório, referencie o caminho. Se
está na memória, não repita.

**Narrativa cronológica.** "Primeiro fizemos A, depois B" é história, não
contexto. O que importa é o estado atual e como se chegou às decisões, não a
ordem dos acontecimentos.

**Detalhe que não muda decisão.** Se a informação não altera o que a próxima
sessão vai fazer, corte.

## Formato de saída — depende do ambiente

O conteúdo é o mesmo nos dois casos. Só o meio muda, e o critério é simples:
**você consegue escrever direto no diretório de trabalho do usuário?**

### Claude Code, Cowork, ou qualquer lugar com acesso ao diretório do usuário

Escreva um arquivo `HANDOFF.md` no diretório onde está sendo executado.

- Não crie subpasta nem estrutura nova
- Não commite, e não faça `git add` — a menos que o usuário peça
- Diga o caminho absoluto ao terminar
- Se o repositório for versionado, avise que o arquivo é temporário e
  provavelmente não deve entrar no commit

Aqui o arquivo é melhor que o bloco no terminal: sobrevive ao fechamento da
sessão, e o usuário abre no editor que já está aberto.

### Claude.ai, chat web ou mobile

Imprima no chat, dentro de um único bloco cercado de markdown. **Não crie
arquivo**, a menos que o usuário peça.

O bloco cercado é deliberado: ele rende o botão de copiar, e o handoff existe
para ser colado em outro lugar. Arquivo aqui obriga download, upload e mais um
artefato para manter.

Use quatro crases na cerca externa, para que blocos de código internos não a
quebrem.

Antes do bloco, uma ou duas linhas dizendo o que ficou de fora e por quê —
tipicamente "o resto está no repositório e na memória". Depois do bloco, nada.

### Na dúvida

Se não estiver claro qual é o ambiente, pergunte em uma linha: arquivo no
diretório ou bloco para copiar. É mais barato que gerar no formato errado.

### Estrutura

````markdown
# Handoff — <assunto>

> **Gerado em** <data> · **de** <chat web | Claude Code em ~/repos/x>
> **Referência** <SHA do commit, tag ou versão — se houver repositório>

## O que é
Duas ou três linhas. Alguém que nunca viu isto entende do que se trata.

## Onde está a verdade durável
| O quê | Onde |
|---|---|
| ... | ... |

Este handoff NÃO repete nada da tabela acima.

## Decidido
- **<decisão>** — porque <razão>. Descartado: <alternativa> por <motivo>.

## Aberto
- **<questão>** — trava <o quê>, ou "não trava nada".

## Erros já cometidos
- <o que se assumiu errado> — corrigido para <o correto>.

## Vocabulário
- **<termo>** — <sentido específico nesta conversa>

## Próximo passo
<comando, arquivo ou pergunta concreta>
````

Seções vazias saem fora. Handoff sem erros cometidos é possível; handoff sem
"aberto" e sem "próximo passo" quase nunca é.

### O cabeçalho de procedência

As três linhas do topo não são enfeite. Um handoff sem data é pior que um
handoff velho, porque quem lê não consegue distinguir os dois.

**Data.** Sempre.

**Origem.** Chat, ou Claude Code e em qual diretório. Muda o que o leitor
deve assumir que já está no repositório.

**Referência.** Onde houver repositório, registre o SHA do commit em que o
handoff foi gerado — `git rev-parse --short HEAD`. É a linha mais valiosa das
três: com ela, quem retoma roda `git log <sha>..HEAD` e vê exatamente o que
mudou desde então. Sem ela, sobra adivinhar.

Isto é a única exceção à regra de não incluir estado que muda. A diferença é
que estas linhas descrevem **o documento**, não o mundo — e é justamente o que
permite julgar se o resto ainda vale.

## Tamanho

Uma página. Se passar de duas, provavelmente entrou coisa que já está durável
em outro lugar — releia com o corte do início.

Handoff longo não é lido, e handoff não lido é pior que ausente, porque cria a
impressão de que o contexto foi transferido.

## Ajuste ao destino

**Para outro chat com o mesmo assistente:** vocabulário e erros cometidos
pesam mais — é o que a memória não carrega.

**Para outra ferramenta (chat → Claude Code, ou o inverso):** diga o que a
ferramenta de destino consegue ver sozinha. O Claude Code lê o repositório; o
chat não. Isso muda o que precisa ser escrito.

**Para outra pessoa:** o "o que é" cresce e o vocabulário vira obrigatório.

## Verificação antes de entregar

- Alguma linha ficaria errada em duas semanas? Corte ou aponte para a fonte.
- Alguma linha já está no repositório ou na memória? Corte.
- Alguém lendo só isto sabe qual é o próximo comando a rodar?
- Um número apareceu no corpo? Confira se ele muda. Se muda, saia.
- O cabeçalho tem data, origem e — onde há repositório — o SHA?
- O formato bate com o ambiente? Arquivo onde há diretório de trabalho, bloco
  onde não há.