---
change: 2026-07-fatia-6
status: active
---

# Fatia 6 — sync: o adaptador de board

## Por quê

Cinco fatias produziram um gate que lê a spec e o código. O board — onde o
trabalho é planejado e onde o cliente olha — continua desconectado, e mantê-lo
alinhado à mão é a tarefa que ninguém faz. Enquanto o board for cópia manual da
spec, ele diverge, e uma spec que ninguém reconhece no board deixa de ser
contrato.

`sync` fecha isso. Não porque escrever card seja difícil, mas porque **decidir
o que escrever quando os dois lados mudaram** é onde toda integração de board
falha — silenciosamente, sobrescrevendo o lado que o autor não estava olhando.

## O que o run 004 decidiu antes de existir código

Três achados do Redmine real entraram como restrição, não como detalhe:

**Ausência tem duas formas.** Campo simples vazio devolve `null`; multivalorado
devolve `[]`. Hash sobre payload bruto muda quando o servidor muda a forma sem
o conteúdo mudar — e um hash que muda sozinho transforma todo sync em conflito
falso. Daí REQ-SYNC-004: normaliza primeiro, faz hash depois, e o hash é sempre
sobre a projeção normalizada.

**A issue não diz o que o campo é.** `field_format` e `is_required` só existem
em `/custom_fields.json`, que devolve **403 com corpo vazio** para membro comum
de projeto — medido, não presumido. Token de cliente real quase certamente não
lê. P8 se aplica inteiro: não conseguir ler a definição não é o mesmo que o
campo não existir, e a diferença é a única coisa que impede o adaptador de
inventar um formato. Daí REQ-SYNC-010: recusa a operação que dependia disso, e
diz que não conseguiu verificar.

**`updated_on` não decide nada.** Ele move quando um filho é anexado ou
excluído, e **não** move quando o conteúdo de um filho muda. É "esta linha
mudou", não "o conteúdo mudou". Como base de três vias, produz conflito
fantasma toda vez que alguém reordena hierarquia — e num board que colapsa
pai-filho isso é rotina. Daí REQ-SYNC-013: `updated_on` é filtro de varredura,
`ETag` é cache de leitura, `synced_hash` é quem decide.

## Propriedade de campo, e por que a divisão é essa

| Lado    | Possui                                  |
| ------- | --------------------------------------- |
| spec    | título, conteúdo, hierarquia            |
| board   | status, responsável, iteração           |

A divisão não é arbitrária: é a fronteira entre o que se decide escrevendo e o
que se decide trabalhando. Conteúdo de requisito é decisão de spec — o board
não tem contexto para reescrevê-lo. Status e responsável são decisão de
execução — a spec não tem como saber quem pegou o card ontem.

Campo que nenhum dos dois possui não é sincronizado. Não há categoria "ambos
possuem": ela é o nome bonito de "o último que escreveu ganha".

## O merge, e o único caso que sai não-zero

Para cada item ligado há três hashes: `base` (o `synced_hash` gravado no último
sync), `ours` (a projeção da spec agora) e `theirs` (a projeção do board agora).

| ours vs base | theirs vs base | resultado                              |
| ------------ | -------------- | -------------------------------------- |
| igual        | igual          | nada a fazer                           |
| mudou        | igual          | escreve no board                       |
| igual        | mudou          | restaura: a spec possui o campo        |
| mudou        | mudou, igual a ours | convergiu; só atualiza a ligação  |
| mudou        | mudou, diferente | **conflito** — sai 2, lista, não resolve |

A linha "restaura" merece o destaque que não teria como nota de rodapé: alguém
editou no board um campo que a spec possui. Não é ambíguo — a propriedade
decide —, então não é P4, e resolver é correto. Mas é escrita destrutiva, então
sai no relatório com nome próprio em vez de virar um "atualizado" indistinguível
de qualquer outro.

Conflito sai **2**, não 1. P2: só `verify` reprova. `sync` não conseguir
prosseguir é falha operacional, mesmo quando a causa é de conteúdo.

## O que o Redmine devolve quando recusa

`422` com `{"errors":["Cliente cannot be blank"]}` — prosa localizada pelo
idioma da instância, sem código e sem nome de campo estruturado. Casar por
substring seria frágil por construção e erraria em instância pt-BR.

Então não se casa nada: REQ-SYNC-011 repassa a mensagem do servidor literal e
nomeia o item local. O `sync` mostra; quem entende é a pessoa.

## A interface de quatro operações — o que coube e o que não coube

O enunciado pediu `create`, `update`, `link`, `close`, desenhadas para que o
Azure DevOps caiba depois. Relato antes de forçar, como pedido.

**Cabe, com uma costura e uma falta.**

A costura é `link`. No Redmine, ligar pai e filho é `PUT` com
`parent_issue_id` — um campo do próprio item, não um recurso. `link` existe
como operação separada porque no Azure DevOps ela é separada de verdade
(`/relations/-` via JSON-Patch). Manter `link` distinto custa ao Redmine uma
implementação de três linhas que delega ao `update`; fundi-la ao `update`
custaria ao ADO uma operação que não existe. A generalidade está do lado certo.

**A interface tinha quatro operações porque o documento superado dizia quatro.**
Não sobreviveu ao contato: `read` é impedimento do merge de três vias e
`describeFields` é impedimento do P8. Quarta vez que aquele documento erra, e a
primeira em que ele erra no desenho central de uma fatia.

A falta é maior e não dá para contornar: **quatro escritas não bastam.** O
merge de três vias precisa ler o estado do board (`read`), e o P8 precisa ler a
definição dos campos (`describeFields`). Nenhuma das duas é operação sobre o
estado do board, então nenhuma cabe nas quatro — mas sem elas não existe merge
nem recusa honesta. A interface tem seis membros: quatro escritas e duas
leituras. Se "quatro" era literal, o desenho estava errado, e é melhor saber
agora.

Uma terceira observação, menor: `close` escreve `status`, que pela tabela acima
pertence ao board. É exceção deliberada e única — a spec fecha o item quando o
requisito é arquivado, e em nenhum outro momento. Fica explícito em
REQ-SYNC-003 para que não vire precedente.

## Escopo

Dentro: `specd sync` manual, interface de adaptador, adaptador Redmine único e
completo, propriedade de campo, merge de três vias, mapeamento com colapso,
ligação no frontmatter, credencial por variável de ambiente.

Fora: adaptador de Azure DevOps, `propose`, `apply`, memória. `sync` nunca é
chamado por hook — REQ-SYNC-001 —, porque hook roda sem ninguém olhando e
escrita em sistema de terceiro precisa de alguém olhando.

## Dívidas quitadas junto

`sandbox/` entrou no `.prettierignore`: o `format` reformatava os runs 001–003,
declarados imutáveis, e regra que a própria toolchain viola não sobrevive.

`npm run test:integration` sobe o container, roda a suíte e derruba.
`npm run verify` **não** o invoca, e `vitest.config.ts` exclui
`test/integration/`: o gate do specd não pode exigir Docker, senão as camadas
offline deixam de ser offline.
