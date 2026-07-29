---
name: publish-npm
description: Publica o pacote `@jnerytech/specd` no registry npm usando o token do .env, com gate verde, dry-run revisado, confirmação explícita do autor e releitura do registry como prova. Use quando o usuário pedir para publicar no npm, subir versão, lançar release, rodar npm publish, depreciar uma versão publicada, ou perguntar por que uma versão no registry não roda — e também quando pedir só o dry-run ou verificar o que iria no tarball.
---

# publish-npm

Publica `specd` no registry npm. O procedimento existe porque publicação é a
operação mais irreversível que este repositório executa: **nome mais versão
publicados nunca voltam a ficar livres.** `npm unpublish` só vale nas
primeiras 72 horas, e mesmo assim queima o par para sempre.

Por isso a skill segue costly-ops-are-not-silent e absence-is-not-compliance do `CLAUDE.md` ao pé da letra: para e nomeia a
escolha antes de pagar o custo, e trata a resposta de sucesso do npm como
promessa, não como prova.

## Regras que não se negociam

**A credencial nunca aparece.** O token mora em `NODE_AUTH_TOKEN` no `.env`,
que é gitignored. Nunca `cat .env`, nunca `echo` do valor, nunca token em
`argv` (fica visível em `ps` para qualquer processo da máquina). Ele entra por
um `.npmrc` temporário fora do repositório, apagado por `trap` mesmo se o
comando falhar.

**Nunca publica sem confirmação nesta conversa.** Não vale autorização de
sessão anterior, não vale "o usuário pediu para publicar" no início da tarefa.
A confirmação é para a versão exata e a dist-tag exata, depois do dry-run.

**Nunca publica com gate vermelho ou árvore suja.** `npm run verify` verde e
`git status` limpo são pré-condição, não gentileza. O tarball sai do `dist/`,
e `dist/` só é confiável se foi construído do commit que está publicado.

**Sucesso do npm não é prova.** A publicação só está feita quando uma
releitura do registry devolve a versão.

## Procedimento

### 1. Estado antes de qualquer coisa

```bash
git status --porcelain && git rev-parse --short HEAD
node -p "const p=require('./package.json'); p.name+'@'+p.version"
npm view "$(node -p "require('./package.json').name")" versions --json 2>&1 | tail -3
```

Árvore suja → pare e mostre o que está pendente. `E404` no `npm view` significa
que **este nome** nunca foi publicado — o que é o estado normal de uma primeira
publicação e um alarme em qualquer outra.

**Confira o nome contra o que já está no ar.** O registry indexa por nome, e
nome diferente é pacote diferente, não versão nova do mesmo. Este repositório
já pagou esse preço: houve um intervalo em que `@jnerytech/specd` estava
publicado e o `package.json` dizia `"name": "specd"`. Publicar dali não teria
atualizado o pacote que existia; teria reservado um segundo nome, e quem
instalou o primeiro continuaria com o primeiro.

Está resolvido — `package.json` declara `@jnerytech/specd`, e há teste amarrando
o nome citado na documentação ao `name` do manifesto (REQ-CLI-007). O passo
continua aqui porque a checagem é barata e o modo de falha é silencioso.

Se os dois nomes divergirem, pare e traga a escolha ao autor: publicar o não
escopado é decisão nova sobre qual nome o projeto passa a ter, e renomear pacote
já publicado quebra quem instalou.

Pacote escopado é `restricted` por padrão. `--access public` no publish é
obrigatório, não decorativo — sem ele o pacote sobe privado e a instalação
pública falha com 404 autenticado.

### 2. Gate

```bash
npm run verify
```

Precisa sair 0. `verify` roda `format`, que **escreve** arquivos — recheque
`git status --porcelain` depois. Se sujou, o commit é do autor, não da skill.

### 3. Versão

Leia a versão atual e decida com o usuário a que vai subir. Não invente bump.

- O nome já está reservado e a série `0.0.x` já foi usada, então toda publicação
  daqui em diante é release de verdade. `npm view <pacote> versions --json` diz
  o que está ocupado; não deduza da versão em `package.json`.
- Release de verdade: `npm version <patch|minor|major>` cria commit **e tag
  git**. Isso é escrita no histórico — confirme antes, e note que a tag ainda
  precisa de `git push --follow-tags` depois.

Versão já publicada é rejeitada pelo registry (`EPUBLISHCONFLICT`). Se
acontecer, é sinal de que faltou bump, nunca de que cabe `--force`.

### 4. Dry-run e revisão do tarball

```bash
npm run build && ls dist/cli.js
npm publish --dry-run
```

O `build` explícito não é redundância do passo 2: `dist/` é gitignored, `files`
lista só `dist/`, e **padrão de `files` que não casa nada não é erro para o
npm** — ele publica o que sobrou e sai 0.

Confira na saída, item por item:

- **`dist/cli.js` na lista de arquivos.** Este é o item que já falhou de
  verdade: `@jnerytech/specd@0.0.0` está publicado com três arquivos —
  `package.json`, `README.md` e `LICENSE` — e nenhum `dist/`. O `bin` aponta
  para `dist/cli.js`, que não existe no tarball, então o pacote instala e o
  binário não roda. O publish saiu 0 e o registry aceitou.
- **Contagem de arquivos e `unpackedSize`** compatíveis com um build de
  TypeScript, na casa das dezenas de arquivos. Três arquivos e 8 kB é o
  tamanho de um pacote sem código. Salto na direção oposta é vazamento de
  conteúdo.
- **`files`**: só `dist/` mais `package.json`, `README.md` e `LICENSE`, que o
  npm inclui sempre. Qualquer `.env`, `.specd/`, `sandbox/`, `test/` ou
  `node_modules/` na lista é abortar imediatamente e corrigir `files` no
  `package.json`.

Mostre esse resumo ao usuário. É o que ele vai aprovar.

### 5. Confirmação

Pergunte, nomeando os três: **pacote, versão e dist-tag**. Diga na mesma frase
que o par nome+versão é permanente. Sem resposta afirmativa explícita, pare
aqui — parar é um resultado legítimo desta skill.

### 6. Publicação

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

Erros que têm tratamento próprio:

- `ENEEDAUTH` / `E401` — token inválido, expirado ou sem escopo de publicação.
  Não tente outro caminho de autenticação; peça um token novo ao usuário.
- `EOTP` — a conta exige 2FA na publicação. O token sozinho não passa. Peça o
  código ao usuário e repita **o mesmo comando** com `--otp <código>`.
- `E403` — nome ocupado por outro autor, ou conta sem direito sobre o pacote.
  Pare: isso não se resolve com flag.

### 7. Prova (absence-is-not-compliance)

O `+<pacote>@<versão>` impresso pelo publish é a resposta de quem recebeu o
pedido. A releitura é a primeira prova:

```bash
npm view <pacote>@<versão> version dist-tags dist.fileCount dist.unpackedSize
```

Versão de volta → o registro existe. `E404` ou versão diferente → **não
publicado**, mesmo que o passo 6 tenha saído 0. Relate como falha e investigue;
não republique por reflexo.

**E registro não é pacote utilizável.** `npm view` responder a versão prova que
o nome está ocupado, não que o que subiu funciona — foi assim que
`@jnerytech/specd@0.0.0` ficou no ar sem `dist/`, respondendo `0.0.0` a quem
perguntasse. Por isso a segunda prova não é opcional:

```bash
cd "$(mktemp -d)" && npx -y <pacote>@<versão> --help
```

Rodou e imprimiu o uso → publicado de verdade. `could not determine executable`
ou `MODULE_NOT_FOUND` → subiu pacote quebrado, e o conserto é uma versão nova,
porque a que está no ar não se corrige no lugar.

### 8. Depois

Nada disto é automático — são escritas no repositório, e a decisão é do autor:

- Se houve `npm version`, a tag ainda é local: `git push --follow-tags`.
- Há teste amarrando o nome e o caminho citados na documentação ao `name` e ao
  `bin` do `package.json` — se README, CLAUDE.md ou AGENTS.md mudarem, rode
  `npm test` antes de commitar.
- Versão que subiu quebrada não se corrige no lugar, mas se marca:
  `npm deprecate <pacote>@<versão> "<motivo, e para onde ir>"`. Diferente de
  `unpublish`, é reversível — string vazia desfaz — e não tem janela de 72h.
  Depreciar versão que **funciona** só porque é antiga avisa todo instalador à
  toa; o critério é defeito, não idade.

  Confira pelo documento cru, e não pelo seletor de campo: `npm view <pacote>@<versão> deprecated`
  imprime **vazio mesmo quando a versão está depreciada**, e vazio se lê como
  "não pegou". O que responde é `npm view <pacote>@<versão> --json` ou
  `curl -s https://registry.npmjs.org/<pacote com / escapado como %2F>`. É absence-is-not-compliance na
  ferramenta de checagem: o comando que parecia conferir devolve silêncio,
  indistinguível do estado que ele deveria detectar.

**Este arquivo é documentação e envelhece como qualquer outra.** A versão
anterior desta seção mandava corrigir o README por afirmar que o pacote não
estava publicado, meses depois de a correção ter sido feita — a mesma espécie de
drift que REQ-CLI-007 passou a cobrir, aqui onde teste nenhum alcança. Ao
terminar uma publicação, releia os passos 1 e 3: eles citam estado do registry, e
estado do registry muda justamente quando esta skill roda.

## O que esta skill não faz

Não mexe em `publishConfig`, não usa `--provenance` (exige OIDC de CI, não roda
local) e não faz `npm unpublish` — despublicar é decisão do autor no terminal
dele, com as consequências à vista.

Não decide o nome do pacote. Escopado e não escopado são dois produtos
diferentes para o registry, e escolher por conveniência é a decisão cara e
silenciosa que costly-ops-are-not-silent proíbe.
