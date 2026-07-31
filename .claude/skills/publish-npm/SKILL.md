---
name: publish-npm
description: Publica o pacote `@jnerytech/specd` no registry npm usando o token do .env, com gate verde, dry-run revisado, commit e push antes da publicação, confirmação explícita do autor e releitura do registry como prova. Use quando o usuário pedir para publicar no npm, subir versão, lançar release, rodar npm publish, depreciar uma versão publicada, ou perguntar por que uma versão no registry não roda — e também quando pedir só o dry-run ou verificar o que iria no tarball.
---

# publish-npm

Publica `specd` no registry npm. O procedimento existe porque publicação é a
operação mais irreversível que este repositório executa: **nome mais versão
publicados nunca voltam a ficar livres.** `npm unpublish` só vale nas primeiras
72 horas, e mesmo assim queima o par para sempre.

Daí a skill seguir costly-ops-are-not-silent e absence-is-not-compliance do
`CLAUDE.md` ao pé da letra: para e nomeia a escolha antes de pagar o custo, e
trata a resposta de sucesso do npm como promessa, não como prova.

## Regras que não se negociam

**A credencial nunca aparece.** O token mora em `NODE_AUTH_TOKEN` no `.env`, que
é gitignored. Nunca `cat .env`, nunca `echo` do valor, nunca token em `argv`
(fica visível em `ps` para qualquer processo da máquina). Ele entra por um
`.npmrc` temporário fora do repositório, apagado por `trap` mesmo se o comando
falhar.

As outras quatro são pré-condições, cada uma detalhada no passo que a executa:

- **Sem confirmação nesta conversa, não publica** — versão e dist-tag exatas,
  depois do dry-run (passo 5). Autorização de sessão anterior não vale.
- **Sem gate verde e árvore limpa, não publica** (passos 2 e 6).
- **De commit que só existe nesta máquina, não publica** (passo 6).
- **Sucesso do npm não é prova** — quem fecha é a releitura (passo 8).

## Procedimento

### 1. Estado antes de qualquer coisa

```bash
git status --porcelain && git rev-parse --short HEAD
node -p "const p=require('./package.json'); p.name+'@'+p.version"
npm view "$(node -p "require('./package.json').name")" versions --json 2>&1
npm view "$(node -p "const p=require('./package.json'); p.name+'@'+p.version")" version 2>&1
```

Árvore suja → pare e mostre o que está pendente. A lista de versões sai inteira,
sem `tail`: o começo da série é onde mora `0.0.0`, a versão quebrada que os
passos 4 e 8 usam como referência.

**Terceira linha, o nome.** `E404` significa que **este nome** nunca foi
publicado — normal numa primeira publicação, alarme em qualquer outra. Nome
diferente é pacote diferente, não versão nova do mesmo: houve um intervalo em que
`@jnerytech/specd` estava no ar e o `package.json` dizia `"name": "specd"`, e
publicar dali teria reservado um segundo nome, com quem instalou o primeiro
continuando nele. Se divergirem, pare e traga a escolha ao autor — renomear
pacote publicado quebra quem instalou. (REQ-CLI-007 amarra o nome citado na
documentação ao manifesto; a checagem fica porque é barata e falha em silêncio.)

**Quarta linha, o par exato.** Versão de volta → **já publicada**, e não há
publicação sem bump; leve ao passo 3 agora, não depois. `E404` → livre. Sem essa
pergunta o conflito só aparece no dry-run, e apareceu: a `0.1.1` começou com o
`package.json` marcando `0.1.0`, já no ar desde a release anterior.

Pacote escopado é `restricted` por padrão. `--access public` no publish é
obrigatório, não decorativo — sem ele o pacote sobe privado e a instalação
pública falha com 404 autenticado.

### 2. Gate

```bash
npm run verify
```

Precisa sair 0. `verify` roda `format`, que **escreve** arquivos — recheque `git
status --porcelain` depois. Se sujou, o commit é do autor, não da skill.

### 3. Versão

Decida com o usuário; não invente bump. `npm view <pacote> versions --json` diz o
que está ocupado — não deduza do `package.json`, que costuma marcar a última
publicada e não a próxima. Versão já publicada é rejeitada com
`EPUBLISHCONFLICT`: sinal de que faltou bump, nunca de que cabe `--force`.

`npm version <patch|minor|major>` cria commit **e tag anotada**. É escrita no
histórico — confirme antes. A tag nasce local; quem a leva ao remoto é o passo 6,
antes da publicação e não depois.

**Mas o bump pode já ter acontecido, e sem tag.** `package.json` marcando uma
versão livre não quer dizer que `npm version` rodou — alguém pode ter editado o
campo à mão dentro de um commit de feature. Foi o caso da `0.3.0`, escrita em
`38df4ef`, com a série `v0.0.1`…`v0.2.0` toda anotada e nenhuma `v0.3.0`:

```bash
git log -S'"version": "<versão>"' --oneline -- package.json
git tag -l "v<versão>"
```

Primeiro vazio → o bump não foi commitado; use o `npm version` acima. Primeiro
responde e segundo vazio → a versão já está no histórico sem tag, e criá-la é
decisão do autor, não conserto silencioso: pergunte junto com a confirmação do
passo 5 e crie **anotada** no passo 6, apontando para o commit de onde o tarball
sai — o HEAD que o passo 4 construiu, não o que mexeu no `package.json`.

### 4. Dry-run e revisão do tarball

```bash
npm run build && ls dist/cli.js
node -p "JSON.stringify(require('./package.json').files)"
npm publish --dry-run
```

O `build` explícito não é redundância do passo 2: `dist/` é gitignored, e
**padrão de `files` que não casa nada não é erro para o npm** — ele publica o que
sobrou e sai 0.

Confira na saída, item por item:

- **`dist/cli.js` na lista de arquivos.** Este é o item que já falhou de verdade:
  `@jnerytech/specd@0.0.0` está publicado com três arquivos — `package.json`,
  `README.md` e `LICENSE` — e nenhum `dist/`. O `bin` aponta para `dist/cli.js`,
  que não existe no tarball, então o pacote instala e o binário não roda. O
  publish saiu 0 e o registry aceitou.
- **Contagem de arquivos e `unpackedSize`** compatíveis com um build de
  TypeScript: a `0.3.0` subiu com 95 arquivos e 416 kB desempacotados. Três
  arquivos e 8 kB é o tamanho de um pacote sem código; salto na direção oposta é
  vazamento de conteúdo.
- **A lista contra o `files` real, que não é só `dist/`** — hoje é
  `["dist","skills"]`, porque as quatro `skills/*/SKILL.md` viajam no tarball
  desde `985f12b` e o `specd init --skills` as instala. Ler o campo antes de
  julgar a lista evita os dois erros simétricos: tratar entrada legítima como
  vazamento, e o contrário. Fora do que `files` declara, o npm inclui sempre
  `package.json`, `README.md` e `LICENSE`. Qualquer `.env`, `.specd/`,
  `sandbox/`, `test/` ou `node_modules/` é abortar e corrigir `files`.

Mostre esse resumo ao usuário — é o que ele vai aprovar — e guarde o `shasum`,
que o passo 8 confere.

Duas coisas na saída parecem defeito e não são:

- **`EPUBLISHCONFLICT` não invalida a revisão.** Versão já publicada faz o
  dry-run sair não-zero, e ainda assim ele imprime a lista de arquivos e os
  `Tarball Details` inteiros. Só o número da versão muda depois do bump; não
  pule a revisão ao repetir o dry-run.
- **`default access` na linha final não contradiz `--access public`.** O dry-run
  não recebe a flag, então relata o padrão do pacote. Quem responde sobre acesso
  é o publish do passo 7, que imprime `public access`.

### 5. Confirmação

Pergunte, nomeando os três: **pacote, versão e dist-tag**. Diga na mesma frase
que o par nome+versão é permanente. Sem resposta afirmativa explícita, pare aqui
— parar é um resultado legítimo desta skill.

### 6. Commit e push, antes de publicar

O registry é permanente e o working tree não. Publicar de um commit que só existe
nesta máquina cria uma versão imutável cujo fonte some com um `rebase`, um
`--amend` ou um disco morto. Na direção inversa vale igual: publicar antes de
empurrar deixa uma janela em que o registry está adiante do GitHub, e quem for
olhar o código da versão recém-anunciada não o encontra. É a escolha de direção
de REQ-ARC-012 — o lado recuperável adiante, nunca o irreversível.

```bash
git status --porcelain    # tem que sair vazio
git log --oneline @{u}..HEAD
git tag -a v<versão> -m "<nota>" <commit do dry-run>   # só se o passo 3 apurou tag faltando
git push --follow-tags origin main
git ls-remote --tags origin | grep "v<versão>"
```

**`--follow-tags` só empurra tag anotada, e não cria nenhuma.** Tag leve ele
ignora em silêncio — o push sai 0, os commits sobem e a tag fica para trás; foi o
que houve na `0.2.0`, cuja tag um `git tag -f` posterior recriou leve. E quando
não existe tag alguma (o bump à mão do passo 3), o bloco sobe zero tags e nada
avisa: o registry recebe uma versão que o repositório não marca. Por isso a linha
do `ls-remote`, e por isso ela não é `git tag -l`, que responderia sobre o
repositório local.

Duas linhas no `ls-remote` — `refs/tags/v<versão>` e `refs/tags/v<versão>^{}` —
é a assinatura de tag anotada, e a segunda tem que ser o commit do dry-run. Uma
linha só é leve. Para mover uma tag, recrie-a anotada: `git tag -f -a v<versão>
-m "<nota>" <commit>` e depois `git push origin v<versão> --force`.

**Se algo mudou no repositório entre o passo 4 e aqui** — README corrigido,
arquivo formatado — o `dist/` e o dry-run envelheceram. Refaça os dois; o tarball
que o usuário aprovou tem que ser o tarball que sobe.

Push é escrita em sistema de terceiro, então vale costly-ops-are-not-silent: diga
o que vai subir — quantos commits, qual tag — antes de empurrar.

### 7. Publicação

```bash
set -a; . ./.env; set +a
[ -n "$NODE_AUTH_TOKEN" ] || { echo "NODE_AUTH_TOKEN missing from .env"; exit 2; }

NPMRC="$(mktemp)"; trap 'rm -f "$NPMRC"' EXIT
printf '//registry.npmjs.org/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > "$NPMRC"

npm --userconfig "$NPMRC" whoami
npm --userconfig "$NPMRC" publish --access public
```

`whoami` primeiro: token inválido ou expirado falha ali, antes de qualquer
escrita. Se ele responder, a credencial serve.

Erros com tratamento próprio:

- `ENEEDAUTH` / `E401` — token inválido, expirado ou sem escopo de publicação.
  Não tente outro caminho de autenticação; peça um token novo ao usuário.
- `EOTP` — a conta exige 2FA. O token sozinho não passa: peça o código e repita
  **o mesmo comando** com `--otp <código>`.
- `E403` — nome ocupado por outro autor, ou conta sem direito sobre o pacote.
  Pare: isso não se resolve com flag.

### 8. Prova (absence-is-not-compliance)

O `+<pacote>@<versão>` impresso pelo publish é a resposta de quem recebeu o
pedido. A releitura é a primeira prova:

```bash
npm view --prefer-online <pacote>@<versão> version dist-tags dist.fileCount dist.unpackedSize dist.shasum
```

Versão de volta → o registro existe, e o `dist.shasum` tem que bater com o do
dry-run e o do publish. Três iguais → o tarball revisado é o que está no ar.

**`E404` aqui não significa "não publicado" — significa "não sei".** `npm view` e
`npx` leem cache local e CDN, e nos primeiros segundos depois do publish ambos
respondem sobre um mundo anterior. Aconteceu com a `0.3.0`: publish às 20:22:00,
provas às 20:22:05, `E404` na primeira e `ETARGET` na segunda, com o pacote
perfeitamente no ar. `--prefer-online` estreita a janela mas não a fecha — quem
fecha é o documento cru, que não passa por cache do npm:

```bash
curl -s https://registry.npmjs.org/<pacote com / escapado como %2F> \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log(Object.keys(p.versions).join(', '));console.log(JSON.stringify(p['dist-tags']));console.log(p.time['<versão>']);})"
```

São três estados, não dois — absence-is-not-compliance aplicado à própria
ferramenta de prova:

| Documento cru | `npm view` | Leitura                                                |
| ------------- | ---------- | ------------------------------------------------------ |
| tem a versão  | tem        | publicado                                              |
| tem a versão  | `E404`     | propagação; repita com `--prefer-online` até responder  |
| não tem       | `E404`     | **não publicado**, mesmo com o passo 7 em 0            |

Só a terceira linha é falha. Relate-a e investigue; não republique por reflexo —
e não conclua a terceira sem ter perguntado ao documento cru, porque a segunda se
parece exatamente com ela.

**E registro não é pacote utilizável.** `npm view` responder prova que o nome
está ocupado, não que o que subiu funciona — foi assim que
`@jnerytech/specd@0.0.0` ficou no ar sem `dist/`, respondendo `0.0.0` a quem
perguntasse. A segunda prova não é opcional:

```bash
cd "$(mktemp -d)" && npx -y --prefer-online <pacote>@<versão> --help
```

Rodou e imprimiu o uso → publicado de verdade. `could not determine executable`
ou `MODULE_NOT_FOUND` → subiu pacote quebrado, e o conserto é uma versão nova,
porque a que está no ar não se corrige no lugar. `ETARGET` não fala sobre o
conteúdo: é a janela de propagação da tabela acima, e a resposta é repetir.

### 9. Depois

Nada disto é automático — são escritas no repositório, e a decisão é do autor:

- Commits e tag já subiram no passo 6. Se algo foi commitado **depois** da
  publicação, ele descreve uma versão que já está no ar: empurre também, senão o
  remoto conta uma história diferente da que o registry entregou.
- Há teste amarrando o nome e o caminho citados na documentação ao `name` e ao
  `bin` do `package.json` — se README, CLAUDE.md ou AGENTS.md mudarem, rode `npm
  test` antes de commitar.
- Versão que subiu quebrada não se corrige no lugar, mas se marca: `npm deprecate
  <pacote>@<versão> "<motivo, e para onde ir>"`. Diferente de `unpublish`, é
  reversível — string vazia desfaz — e não tem janela de 72h. Depreciar versão
  que **funciona** só porque é antiga avisa todo instalador à toa; o critério é
  defeito, não idade.

  Confira pelo documento cru, não pelo seletor de campo: `npm view
  <pacote>@<versão> deprecated` imprime **vazio mesmo quando a versão está
  depreciada**, e vazio se lê como "não pegou". Quem responde é `npm view
  <pacote>@<versão> --json` ou o `curl` do passo 8. É o mesmo modo de falha da
  tabela de lá: o comando que parecia conferir devolve silêncio, indistinguível
  do estado que deveria detectar.

**Este arquivo envelhece como qualquer documentação, e aqui teste nenhum
alcança.** Ao terminar uma publicação, releia os passos 1, 3, 4 e 8 — citam
estado do registry e do `package.json`, que mudam justamente quando esta skill
roda. A `0.3.0` cobrou o preço em três de uma vez: `files` já listava `skills` e
o passo 4 dizia só `dist/`; o bump viera à mão sem tag e o passo 3 só previa
`npm version`; o passo 8 lia `E404` de propagação como não-publicado. Nenhum
apareceria em revisão de código — só rodando.

## O que esta skill não faz

Não mexe em `publishConfig`, não usa `--provenance` (exige OIDC de CI, não roda
local) e não faz `npm unpublish` — despublicar é decisão do autor no terminal
dele, com as consequências à vista.

Não decide o nome do pacote. Escopado e não escopado são dois produtos diferentes
para o registry, e escolher por conveniência é a decisão cara e silenciosa que
costly-ops-are-not-silent proíbe.
