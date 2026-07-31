# Run 004 — Redmine local, antes da Fatia 6

- **Quando:** 2026-07-28
- **Versão avaliada:** nada do specd. Este run mede o **servidor**, não a ferramenta.
- **Alvo:** Redmine 6.1.3.stable em container, semeado por
  `test/integration/redmine/seed.sh`
- **Host:** Docker 29.6.2, Docker Compose v5.3.1, WSL2
- **Veredito:** a instância sobe e semeia do zero em **36 s** e é viável em CI.
  Duas promessas da documentação não bateram com o servidor, e as duas foram
  corrigidas na receita. O achado que importa para a Fatia 6 é o item 4: o
  `updated_on` do Redmine **não é** um relógio de conteúdo, e por isso não
  substitui o `synced_hash`.

> Registro imutável. Descreve o que foi observado naquele momento, com aquela
> versão do Redmine.

---

## 0. O que foi construído

Versionado, em `test/integration/redmine/`:

```
docker-compose.yml   receita, versões fixas
seed.sh              idempotente, deixa a instância pronta para o sync
README.md            subir, derrubar, resetar
```

Ignorado, em `sandbox/redmine/`:

```
.env                 emitido pelo seed: URL, API key, IDs dos campos
payloads/            dumps do que o servidor devolveu
```

**Divergência deliberada do enunciado.** O enunciado pedia `sandbox/redmine/data/`
para os volumes; a receita usa **volumes nomeados**
(`specd-redmine_db-data`, `specd-redmine_redmine-files`), não bind mount. As
duas coisas não cabem juntas: com bind mount, `docker compose down -v` não
apaga nada, e o reset volta a ser `rm -rf` com sudo por causa do uid do
Postgres. O enunciado também pedia que o reset fosse `down -v`, e essa parte
venceu. `sandbox/redmine/` guarda só `.env` e os dumps.

---

## 1. Versões fixadas, e por quê

| Componente | Pin              | Razão                                                                       |
| ---------- | ---------------- | --------------------------------------------------------------------------- |
| Redmine    | `6.1.3-alpine`   | Mais novo da linha 6.x, que é madura. `7.0.0` existe — é um `.0.0`, e não é o que instância implantada roda. |
| Postgres   | `16.14-alpine`   | Dentro de qualquer matriz de suporte do Redmine 6. PG 18 é mais novo do que aquilo contra o que o Redmine 6 é testado. |

Tags conferidas no registry no dia, não presumidas: a linha 7 já publica
(`7.0.0-alpine3.24`), a 6 está em `6.1.3`, e o Postgres em `18.4` / `17.10` /
`16.14`.

Stack real que subiu, lida de dentro do container:

```
REDMINE_VERSION=6.1.3.stable
RAILS_VERSION=7.2.3.1
DB_ADAPTER=PostgreSQL
ruby 3.4
```

---

## 2. Como a API REST é habilitada

**Não dá pela API, e não precisa da UI.**

`Setting.rest_api_enabled` vem desligado. Não existe endpoint de bootstrap, e
a API não pode se ligar sozinha — o ovo precisa da galinha. Sobra o console
Rails dentro do container, que é scriptável:

```bash
docker compose exec -T redmine bundle exec rails runner - <<'RUBY'
Setting.rest_api_enabled = '1'
RUBY
```

Então o seed faz isso sem passo manual. Mesmo caminho serve para emitir a
chave: `User#api_key` cria o token na primeira leitura.

**O que mais não tem endpoint de escrita.** Tracker e campo customizado são
**somente leitura** na REST API — `GET /trackers.json` e
`GET /custom_fields.json` existem, `POST` não. Isso não é limitação do seed; é
do Redmine. Consequência para a Fatia 6: o adaptador **lê** definição de campo
pela API, mas quem prepara o board é humano ou console. Um `sync` que precisasse
criar campo não teria como.

Daí os dois caminhos de criação no seed, deliberadamente:

- `rails runner` — settings, trackers, campos customizados
- REST — projeto e issues, porque é a superfície que o adaptador vai usar, e o
  seed deve exercitá-la em vez de contorná-la

### Dois desencontros com a documentação

**`REDMINE_SECRET_KEY_BASE` não chega no `exec`.** O entrypoint lê a variável
prefixada e faz `export SECRET_KEY_BASE` — no processo do servidor. Variável
exportada pertence ao processo, não ao container; `docker compose exec` parte
do ambiente da imagem e nunca a vê. Resultado observado:

```
Missing `secret_key_base` for 'production' environment,
set this string with `bin/rails credentials:edit` (ArgumentError)
```

O compose passou a definir `SECRET_KEY_BASE` sem prefixo, que o servidor e todo
`exec` enxergam. O entrypoint só reclama se as duas estiverem setadas.

**A imagem não carrega os dados padrão.** Em volume novo, `IssueStatus.count`
é zero e não existe tracker nenhum — nem `Bug`. Qualquer coisa que assuma o
seed padrão do Redmine falha. O seed chama
`Redmine::DefaultData::Loader.load('en')` quando a tabela está vazia, e
imprime qual dos dois caminhos tomou:

```
DEFAULT_DATA=loaded     # volume novo
DEFAULT_DATA=present    # segunda execução
```

---

## 3. O que a API devolve de verdade para issue com campo customizado

Esta é a seção que o enunciado pediu, e é payload observado, não documentado.

Campos semeados: `Cliente` (string, **obrigatório**), `Sprint` (list,
opcional), `Times` (list, **multivalorado**).

### 3.1 `GET /issues/1.json` — épico com pai de dois filhos

```json
{
  "issue": {
    "id": 1,
    "project": { "id": 1, "name": "specd sync fixture" },
    "tracker": { "id": 4, "name": "Epic" },
    "status": { "id": 1, "name": "New", "is_closed": false },
    "priority": { "id": 2, "name": "Normal" },
    "author": { "id": 1, "name": "Redmine Admin" },
    "subject": "Sincronizar specd com o board",
    "description": "seeded by test/integration/redmine/seed.sh",
    "start_date": "2026-07-28",
    "due_date": null,
    "done_ratio": 0,
    "is_private": false,
    "estimated_hours": null,
    "total_estimated_hours": 0.0,
    "spent_hours": 0.0,
    "total_spent_hours": 0.0,
    "custom_fields": [
      { "id": 1, "name": "Cliente", "value": "ACME" },
      { "id": 2, "name": "Sprint", "value": "S-1" },
      {
        "id": 3,
        "name": "Times",
        "multiple": true,
        "value": ["plataforma", "dados"]
      }
    ],
    "created_on": "2026-07-28T23:32:37Z",
    "updated_on": "2026-07-28T23:32:37Z",
    "closed_on": null
  }
}
```

### 3.2 O que isso obriga o adaptador a tratar

**O array `custom_fields` é heterogêneo em chaves.** Campo multivalorado traz
`"multiple": true`; campo simples **não traz a chave em `false`** — não traz a
chave. Ler `cf.multiple` dá `true` ou `undefined`, nunca `false`. Um parser que
tipar isso como `boolean` obrigatório quebra no primeiro campo simples.

**O tipo de `value` muda com a definição do campo, que a issue não carrega.**
Simples é `string`; multivalorado é `string[]`. E a issue **não** diz
`field_format` nem `is_required` — só `id`, `name`, `value` e, às vezes,
`multiple`. Para saber que `Cliente` é obrigatório, é preciso um segundo GET.

**Vazio tem duas representações.** Observado na issue sem pai, com `Times`
nunca preenchido:

```json
[
  { "id": 1, "name": "Cliente", "value": "GLOBEX" },
  { "id": 2, "name": "Sprint", "value": "S-3" },
  { "id": 3, "name": "Times", "multiple": true, "value": [] }
]
```

Campo simples não preenchido devolve `"value": null`; multivalorado devolve
`[]`. `null` e `[]` significam a mesma coisa e não são o mesmo valor. Isto é
exatamente o modo de falha do P8 em miniatura: "não preenchido" tem duas
formas, e tratar uma delas como preenchido é conformidade falsa.

**`parent` só traz `id`.** Filho aponta para o pai com `{"id": 1}` — sem
`subject`, sem tracker. O caminho inverso não existe sem `include=children`:

```json
"children": [
  { "id": 2, "tracker": { "id": 5, "name": "Story" }, "subject": "Ler cards do board" },
  { "id": 3, "tracker": { "id": 5, "name": "Story" }, "subject": "Escrever de volta no board" }
]
```

Para a regra de colapso: descer a hierarquia custa `include=children` por
issue; subir sai de graça no payload plano.

### 3.3 A listagem **carrega** os campos customizados

`GET /issues.json?project_id=…` devolve `custom_fields` completo em cada item,
com a mesma forma do detalhe. Não é preciso um GET por issue só para ler campo
customizado — só para `children`, `journals`, `relations`, `attachments` e
`watchers`, que a listagem omite.

### 3.4 `GET /custom_fields.json` — o join que falta

É aqui que mora tudo que a issue não diz:

```json
{
  "id": 1,
  "name": "Cliente",
  "description": null,
  "customized_type": "issue",
  "field_format": "string",
  "regexp": "",
  "min_length": null,
  "max_length": null,
  "is_required": true,
  "is_filter": true,
  "searchable": false,
  "multiple": false,
  "default_value": null,
  "visible": true,
  "editable": true,
  "trackers": [{ "id": 1, "name": "Bug" }, "…"],
  "roles": []
}
```

Campo `list` acrescenta `possible_values` como `[{ "value": "S-1", "label": "S-1" }]`
— objeto, não string.

**Consequência de projeto para `[board.fields]`:** o adaptador precisa de dois
GETs para saber o que é obrigatório, e `/custom_fields.json` **exige admin**.
Uma configuração que só nomeie campo por `name` fica refém de rename no board;
o `id` é o que é estável. Vale aceitar os dois e falhar com diagnóstico se
divergirem — P4.

### 3.5 Campo obrigatório omitido

```
$ POST /issues.json  {"issue":{"project_id":"specd-sync","tracker_id":6,"subject":"sem cliente"}}
HTTP 422
{ "errors": ["Cliente cannot be blank"] }
```

422 com array `errors` de strings já formatadas e **localizadas** pelo idioma
da instância. Não há código de erro nem nome de campo estruturado — só prosa.
Casar erro por substring é o que o servidor oferece, e é frágil por construção.
Para o gate isso não importa (P3: `verify` não acessa rede), mas para o `sync`
significa que a mensagem do board é repassada, não interpretada.

---

## 4. "Modificado em" serve para merge de três vias?

**Não sozinho. O `synced_hash` continua necessário.**

O Redmine expõe `created_on` e `updated_on` em ISO 8601 UTC com precisão de
segundo, e a listagem filtra por eles:

```
GET /issues.json?project_id=specd-sync&updated_on=%3E%3D2026-07-28   → total_count 4
GET /issues.json?project_id=specd-sync&updated_on=%3E%3D2099-01-01   → total_count 0
```

Isso dá busca incremental barata. O que **não** dá é um relógio de conteúdo.
Três medições controladas:

| Evento                              | `updated_on` do pai         |
| ----------------------------------- | --------------------------- |
| Editar o `subject` de um filho      | **não move** (23:30:53 → 23:30:53) |
| Anexar um filho novo                | **move** (→ 23:31:09)       |
| Excluir um filho                    | **move** (→ 23:31:11)       |

O `journals` do pai confirma a causa — os bumps são entradas estruturais, não
edições de conteúdo:

```
23:31:09  [{'property':'attr','name':'child_id','old_value':None,'new_value':'6'}]
23:31:11  [{'property':'attr','name':'child_id','old_value':'6','new_value':None}]
```

Ou seja: `updated_on` é "esta linha mudou", e a linha muda por motivos que não
são o conteúdo da issue. Usá-lo como base de três vias produz conflito
fantasma toda vez que alguém mexe na hierarquia — e num board que colapsa
pai-filho, isso é rotina, não exceção.

Do outro lado, uma medição a favor:

**Escrita idempotente não faz churn.** `PUT` com o mesmo `subject` devolve
`204` e **não** move o `updated_on`. O Redmine compara antes de gravar. Escrita
de volta que reafirma o estado atual é gratuita e não desencadeia ciclo de
sync.

**Não há token de concorrência otimista.** `lock_version` existe no modelo mas
**não aparece no payload**. Não há como fazer compare-and-swap pela API. O que
existe é `ETag` fraco, e ele revalida:

```
etag: W/"8d6930416a3995d4fb9e6ad4828d46f3"
If-None-Match: W/"8d69…"  →  HTTP 304
```

Serve para pular download de issue não alterada. **Não** serve para escrita
condicional — o `PUT` não honra `If-Match`.

**Conclusão para a Fatia 6.** `updated_on` entra como *filtro de varredura*
(quais issues sequer olhar) e `ETag` como *cache de leitura*. A decisão de
"mudou de verdade" continua sendo do `synced_hash` sobre os campos mapeados.
Isso é o oposto de dívida: é a confirmação, medida, de que a estratégia que já
estava no desenho é a certa — e agora com o motivo registrado em vez de
suposto.

---

## 5. Quanto tempo leva para ficar pronto

Medido nesta máquina, WSL2.

| Cenário                                    | Tempo    |
| ------------------------------------------ | -------- |
| `pull` das duas imagens, cache vazio        | **13 s** |
| `up -d` + `seed.sh`, imagens já locais      | **23 s** |
| **Do zero absoluto até issue semeada**      | **36 s** |
| Redmine servindo `/login` após `up`         | 9–12 s   |
| `up` + `seed` com volume preservado         | ~10 s    |

Tamanho: `redmine:6.1.3-alpine` 706 MB, `postgres:16.14-alpine` 420 MB.

**Viável em CI.** 36 s de setup para um teste de integração de board é
aceitável, e o `pull` é a parte cacheável — runner com cache de imagem paga
23 s. O número que muda de máquina é só o `pull`; aqui a rede era rápida.

Uma ressalva medida: o Redmine reseta a conexão (curl 56) enquanto o Puma
ainda está subindo. Quem esperar por "porta aberta" em vez de "`/login`
responde 200" vai achar que está pronto antes da hora. O `seed.sh` espera pelo
200 e engole o stderr do laço, porque essas falhas são esperadas.

---

## 6. O que este run deixa aberto

**Redmine 7.0.0 não foi exercitado.** A receita fixa 6.1.3. Se a forma do
payload mudou na linha 7 — e `custom_fields` é exatamente o tipo de coisa que
muda —, o adaptador vai descobrir em campo. Trocar o pin e rodar o mesmo seed
é barato; ninguém rodou ainda.

**Nenhum teste automatizado consome isto.** `test/integration/redmine/` tem a
receita, mas nenhum `.test.ts` a usa, e `npm run verify` não sobe container. A
rede de segurança existe como possibilidade, não como fato. Enquanto for
assim, o container é ferramenta de exploração manual — igual ao `sandbox/`, e
com a mesma consequência: nada aqui protege contra regressão.

**Erro de campo obrigatório é prosa localizada.** `["Cliente cannot be blank"]`
depende do idioma da instância. Não foi medido contra instância em pt-BR.

**Só um usuário.** Tudo rodou como `admin`. Permissão de leitura em
`/custom_fields.json` exige admin, e não foi medido o que um usuário comum de
projeto enxerga — que é o caso real de token de cliente.
