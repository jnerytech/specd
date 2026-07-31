# Run 005 — Fatia 6, o adaptador Redmine

- **Quando:** 2026-07-28
- **Versão avaliada:** specd ao fim da Fatia 6
- **Alvo:** Redmine 6.1.3.stable em container, semeado por
  `test/integration/redmine/seed.sh`
- **Veredito:** o `sync` funciona contra servidor real e os sete critérios de
  aceite estão medidos, não argumentados. A interface de quatro escritas coube;
  **quatro sozinhas não bastaram** — faltavam duas leituras, e isso está
  relatado abaixo em vez de contornado. O achado da rodada é do Redmine: um
  tracker sem workflow aceita `status_id`, responde **204** e não aplica nada.

> Registro imutável. Descreve o que foi observado naquele momento, com aquela
> versão do specd e aquela versão do Redmine.

---

## 1. A pergunta que o enunciado pediu para responder antes de forçar

> Se a interface de quatro operações não couber no Redmine sem contorção, diga
> antes de forçar.

**Coube, com uma costura e uma falta.**

### A costura: `link`

No Redmine, ligar pai e filho é `PUT` com `parent_issue_id` — campo do próprio
item, não recurso. A implementação inteira:

```ts
async link(child, parent) {
  await request("PUT", `/issues/${child.id}.json`,
    { issue: { parent_issue_id: Number(parent.id) } }, `issue ${child.id}`);
}
```

Três linhas que delegam ao mesmo endpoint do `update`. Isso é redundância, não
contorção — e é a redundância certa: no Azure DevOps `link` é recurso próprio
(`/relations/-` via JSON-Patch), então fundi-la ao `update` custaria ao segundo
adaptador uma operação que não existe. A generalidade está do lado que precisa
dela.

### A falta: quatro escritas não bastam

Isto não é opinião, é impedimento. **Merge de três vias precisa ler o estado
remoto.** Sem `read`, `theirs` não existe, e sem `theirs` não há como distinguir
"só a spec mudou" de "os dois mudaram" — que é o critério de aceite inteiro.

**Recusar honestamente precisa ler a definição do campo.** Sem
`describeFields`, o P8 não tem como acontecer: o adaptador não sabe se `Cliente`
é obrigatório nem se é multivalorado, e a única alternativa a recusar é assumir.

Nenhuma das duas é operação sobre o estado do board, então nenhuma cabe entre
as escritas. A interface final tem **seis membros: quatro escritas e duas
leituras**. Se "quatro" era literal, o desenho estava errado, e este é o momento
de saber.

### Uma terceira observação, menor

`close` escreve `status`, que pela tabela de propriedade pertence ao board.
Ficou como exceção única e declarada — a spec fecha o item quando o requisito
sai da spec, e em nenhum outro momento —, escrita em REQ-SYNC-003 para não
virar precedente.

Ela também é a única operação **alcançável** que faltava: `close` estava
implementado e nada o invocava, o que faria o requisito passar vaziamente. Agora
`sync` fecha o item de requisito que deixou a spec, e o teste de integração
prova que o board fica com `is_closed: true`.

---

## 2. O achado da rodada

**Um tracker sem workflow aceita `status_id`, responde 204 e não aplica nada.**

Descoberto porque um teste de integração falhou por um motivo que não fazia
sentido: o teste marcava um item como "In Progress" pela API, o `sync` rodava, e
a situação voltava para "New". A hipótese óbvia — o `sync` estava sobrescrevendo
status — estava errada. O `PUT` inicial é que nunca tinha funcionado.

Medido lado a lado, mesmo token de admin, mesma instância:

```
$ POST /issues.json  tracker_id=5   (Story, criado pelo seed)
$ PUT  /issues/45.json  {"issue":{"status_id":2}}     -> HTTP 204
$ GET  /issues/45.json    status now: {'id': 1, 'name': 'New'}

$ POST /issues.json  tracker_id=1   (Bug, do default data)
$ PUT  /issues/46.json  {"issue":{"status_id":2}}     -> HTTP 204
$ GET  /issues/46.json    status now: {'id': 2, 'name': 'In Progress'}
```

Mesma requisição, mesmo código de resposta, resultados opostos. A diferença é
que `Bug` tem linhas de `WorkflowTransition` — o `Redmine::DefaultData::Loader`
as cria — e um tracker criado por script não tem nenhuma. Sem transição
permitida, o Redmine descarta o campo em silêncio e responde sucesso.

Isto é **P8 chegando pelo lado do board**, e na direção que ninguém investiga:
sucesso reportado sobre coisa que não aconteceu. As três instâncias do CLAUDE.md
são o specd apresentando ausência como conformidade; esta é um sistema de
terceiro fazendo o mesmo com o specd na ponta receptora.

Duas correções, porque uma só resolveria metade:

1. **O seed copia as transições do `Bug`** para os trackers novos. A fixture
   passa a se parecer com um board que alguém configurou, em vez de um que mente
   quieto. 144 linhas de workflow criadas.
2. **`close` relê e confere.** A única escrita de situação que o specd faz é
   também a única que ele verifica. Quando a situação não mudou, sai 2 dizendo
   exatamente isso:

   ```
   issue 12: the board accepted the close and did not apply it.
   The status is still "New" (id 1), not id 5.
   In Redmine this happens when the item's tracker has no workflow transition
   to that status: the PUT answers 204 and changes nothing.
   ```

Corrigir só o seed teria feito o teste passar e deixado o defeito em pé para
qualquer board de cliente cujo workflow não permita a transição — que é o caso
comum, não o raro.

---

## 3. O segundo achado, menor mas caro

**`updated_on` tem resolução de um segundo.**

Um teste afirmava a premissa do run 004 — anexar filho move o `updated_on` do
pai — e falhou com os dois valores idênticos:

```
AssertionError: expected '2026-07-28T23:57:15Z' not to be '2026-07-28T23:57:15Z'
```

O `sync` criou o épico, o teste leu o carimbo, anexou o filho e leu de novo,
tudo dentro do mesmo segundo. A mudança aconteceu e ficou invisível.

Não muda nada no produto — o `synced_hash` decide, e o carimbo é só filtro —,
mas é exatamente o tipo de coisa que faria um teste de integração ficar
intermitente sem motivo aparente. O teste passou a esperar 1,1 s antes de
anexar, e a premissa voltou a ser observável em vez de sorteada.

Vale registrar a assimetria: a resolução de um segundo é mais um argumento
contra usar `updated_on` como base de merge. Duas escritas no mesmo segundo são
indistinguíveis para ele, e o hash as distingue.

---

## 4. O 403, medido com token de membro comum

O run 004 previu que `/custom_fields.json` exigiria admin. Confirmado, e com o
detalhe que importa:

| Endpoint               | admin | membro comum do projeto |
| ---------------------- | ----- | ----------------------- |
| `/issues/{id}.json`    | 200   | 200                     |
| `/trackers.json`       | 200   | 200                     |
| `/issue_statuses.json` | 200   | 200                     |
| `/custom_fields.json`  | 200   | **403, corpo vazio**    |
| qualquer, chave errada | —     | 401                     |

Corpo vazio: o adaptador não tem nem mensagem do servidor para repassar. Ele
sintetiza a explicação e diz que não conseguiu verificar, o que é diferente de
dizer que o campo não existe.

O seed passou a criar o usuário `specd-bot` — membro comum, papel Manager, sem
admin — e a emitir a chave dele como `REDMINE_MEMBER_API_KEY`. É a credencial
que o teste de P8 usa, e é a que se parece com token de cliente real.

Os dois lados da regra estão cobertos por teste:

- Com `[[board.fields]]` e token de membro: sai 2, mensagem distingue "não
  consegui verificar" de "campo ausente", e o frontmatter continua sem ligação.
- Sem `[[board.fields]]`: o endpoint nunca é consultado, e o `sync` chega até a
  recusa do campo obrigatório pelo próprio board. Ausência de dependência não
  vira bloqueio inventado.

---

## 5. Os sete critérios de aceite

Todos medidos contra o container semeado, `npm run test:integration`, 11 testes.

| Critério                                            | Como ficou                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| Criar, atualizar, rodar duas vezes sem duplicar      | 3 `create` na primeira, 3 `unchanged` na segunda, contagem de issues estável |
| Campo obrigatório omitido, mensagem repassada        | `body` é literalmente `{"errors":["Cliente cannot be blank"]}`, status 422   |
| Multivalorado vazio e simples vazio, mesmo hash      | medido com `null` e `[]` lidos do servidor, não sintetizados                 |
| `/custom_fields.json` inacessível                    | `FieldDefinitionsUnavailableError`, exit 2, nada escrito                     |
| Mudança dos dois lados                               | exit 2, lista item e os dois valores, e o irmão sem conflito também não é escrito |
| Reordenação de hierarquia não produz conflito        | `updated_on` move (asserido), resultado é `unchanged`                        |
| `close` confirma que fechou                          | acrescentado nesta rodada, pelo motivo da §2                                |

O quinto merece uma nota: o teste verifica que o **item sem conflito** também
não foi escrito. Falha parcial deixaria o board num estado que nem a spec nem o
board descrevem, e ninguém saberia qual metade tinha ido.

---

## 6. Tempo

| Etapa                                          | Tempo    |
| ---------------------------------------------- | -------- |
| `npm run verify` (offline, sem Docker)          | ~15 s    |
| `npm run test:integration`, volumes zerados     | **30 s** |
| ↳ container servindo                            | 10 s     |
| ↳ seed                                          | ~12 s    |
| ↳ 11 testes de integração                       | 4,5 s    |

Viável em CI. A suíte de integração é separada de propósito: `npm run verify`
não a invoca e `vitest.config.ts` exclui `test/integration/`, porque o gate do
specd não pode exigir Docker — se exigisse, as cinco camadas offline deixariam
de ser offline, que é a propriedade que faz o hook custar 40 ms.

---

## 7. O gate bloqueou nove vezes, ao vivo

Sem procurar por isso. Ao escrever o `delta.md`, o `PostToolUse` reprovou nove
statements com dois `SHALL`:

```
error .specd/changes/2026-07-fatia-6/delta.md:17 [REQ-SYNC-001]
Statement of REQ-SYNC-001 contains 2 "SHALL" clauses; a requirement states
exactly one behaviour.
```

Cada escrita foi bloqueada até o statement virar cláusula única. É a pendência
que o run 003 deixou aberta — bloqueio ao vivo — agora observada num fluxo de
trabalho comum em vez de num experimento montado, e num arquivo que o autor
achava que estava certo.

Efeito colateral que vale registrar: as cláusulas `SHALL NOT` que foram
removidas dos statements não sumiram, migraram para critérios de aceite. O
requisito ficou mais fácil de testar, o que é o argumento a favor da regra e não
só a regra.

---

## 8. O que este run deixa aberto

**Só um adaptador.** A interface foi desenhada para dois e tem um. A costura do
`link` e a divisão escrita/leitura são argumentos sobre o Azure DevOps, não
medições dele. O primeiro adaptador nunca aperta o desenho tanto quanto o
segundo.

**`sync` não é chamado por `archive`.** Fechar item de requisito que saiu da
spec funciona e está testado, mas quem decide que ele saiu é o autor editando o
arquivo, não o comando `archive`. Ligar os dois é da próxima fatia.

**Sem escrita condicional.** O Redmine não expõe `lock_version` e o `PUT` não
honra `If-Match` (run 004, §4). Entre ler o estado e escrever há uma janela em
que outra pessoa pode escrever, e o merge de três vias não fecha essa janela —
só garante que a decisão foi tomada sobre o estado que existia na leitura.

**Prosa localizada.** A mensagem do 422 depende do idioma da instância. Como
nada casa por substring, o `sync` funciona igual em pt-BR — mas isso é dedução,
não medição: instância em pt-BR não foi testada.

**Um projeto, um cliente.** Tudo rodou contra `specd-sync` com dois usuários. O
comportamento com muitos projetos, papéis restritos por campo (`visible`,
`editable` em `/custom_fields.json`) e permissão por tracker não foi tocado.
