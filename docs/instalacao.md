# Instalação

O pacote é **`@jnerytech/specd`** e o binário que ele instala chama-se `specd`.

> **O escopo faz parte do nome.** `specd` sem o `@jnerytech/` **não é este
> pacote** — não foi reservado, então digitá-lo leva a 404 ou ao pacote de
> outro autor. Todo comando desta página traz o escopo.

## `npm i` não coloca nada no PATH

Este é o tropeço mais comum, e não é defeito:

```bash
npm i @jnerytech/specd
specd --help
# specd: command not found
```

`npm i` é instalação **local**. O pacote vai para `./node_modules/` e o
executável para `./node_modules/.bin/specd`, que **não está no PATH**. Só
`npm i -g` e `npx` alcançam o shell.

Um sinal de que a instalação não fez o que você achou que fez: `npm i` que
instalou responde `added N packages`. `up to date, audited N packages` quer
dizer que ele não acrescentou nada.

## Escolha uma das três

### 1. `npx` — sem instalar nada

Melhor para experimentar, e para CI que não quer estado.

```bash
npx @jnerytech/specd@latest --help
npx @jnerytech/specd@latest init
```

### 2. Global — `specd` em qualquer pasta

```bash
npm i -g @jnerytech/specd
specd --help
```

### 3. Local, como dependência de desenvolvimento

Trava a versão por repositório, que é o que você quer quando o gate roda em CI.

```bash
npm i -D @jnerytech/specd
npx @jnerytech/specd --help   # npx resolve o local antes do registry
```

## Do clone, para desenvolver o próprio specd

```bash
git clone https://github.com/jnerytech/specd.git
cd specd
npm install
npm run build
node dist/cli.js --help
```

Para usar contra outro repositório, chame o caminho absoluto de lá:

```bash
cd /caminho/do/seu/projeto
node /caminho/do/specd/dist/cli.js init
```

Ou registre o binário no PATH uma vez:

```bash
cd /caminho/do/specd && npm link
```

**`npm link` e `npm i -g` disputam o mesmo nome.** O link global aponta para a
árvore de trabalho; a instalação global aponta para o tarball do registry. Se
você tem os dois, o que responde é o último que escreveu — e a diferença é
invisível até um dos dois estar desatualizado. Antes de instalar do registry
numa máquina que já tem link:

```bash
npm unlink -g @jnerytech/specd
npm i -g @jnerytech/specd
```

Para saber qual está ativo:

```bash
which specd                 # caminho no PATH
ls -l "$(which specd)"      # symlink para a árvore de trabalho, ou para o global
specd --version
```

## Primeiro uso

```bash
cd /caminho/do/seu/projeto

specd init          # cria .specd/ e detecta a stack para propor validation_command
specd verify        # o gate
specd status        # o que está pendente, agrupado por change
specd read --open   # lê a spec no navegador
```

| Exit code | Significado                                          |
| --------- | ---------------------------------------------------- |
| 0         | Sucesso                                              |
| 1         | Gate reprovou — a spec ou o código estão errados     |
| 2         | Falha operacional — rede, I/O, configuração inválida |

Só `specd verify` devolve 1. Qualquer outro comando devolvendo não-zero é falha
operacional, e CI precisa dessa distinção para não tratar ferramenta quebrada
como spec reprovada.

## Quando não funciona

| Sintoma                                      | Causa provável                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `specd: command not found` depois de `npm i` | Instalação local não vai ao PATH. Use `npx @jnerytech/specd` ou `npm i -g`          |
| `command not found` depois de `npm i -g`     | nvm não carregado neste terminal: `source ~/.bashrc`, ou abra um terminal novo      |
| `404` ao instalar                            | Faltou o escopo. É `@jnerytech/specd`                                               |
| Versão diferente da esperada                 | `npm link` ativo apontando para uma árvore de trabalho. Veja `ls -l $(which specd)` |
| `verify` sai 2 reclamando de `.specd/`       | Não é projeto specd ainda: rode `specd init`                                        |

Requisitos: Node >= 20.
