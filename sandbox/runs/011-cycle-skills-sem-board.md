# Run 011 — ciclo das skills próprias, modo sem board

**Quando:** 2026-07-29
**Contra:** repositório sintético em `sandbox/runs/011/target` — Node/JS, 5 arquivos,
`rateLimiter` de janela fixa. Sem `.specd/` até o `init`. As skills nunca o viram.
**Build:** `dist/` da change `2026-07-29-cycle-skills`, tasks 001–006 fechadas.

## O que foi exercido

O ciclo inteiro pelas quatro skills recém-escritas, no modo em que `[board]` não
declara `provider`:

1. `specd init --skills` — escreveu config, três diretórios, `.gitattributes` e as
   quatro skills em `.claude/skills/`
2. explore — change aberta com `proposal.md`, escopo e mapa do código em
   `explore/notes.md`
3. propose — `delta.md` com REQ-RATE-001 e `tasks/001-remaining.md`
4. apply — `remaining(key, now)` em `src/window.js` e `limiter.remaining` em
   `src/index.js`, cinco testes novos, commit, evidência preenchida
5. archive — `.specd/specs/rate-limit.md` criado a partir do delta

Veredito: **o ciclo fecha.** Gate verde nas seis camadas ao fim, âncoras
resolvidas, capability escrita pelo `archive` e não à mão.

## Achado 1 — a guarda de versão barrou as próprias skills

`specd --version` respondia `0.2.0` e as skills declaravam
`requires_specd: ">=0.3.0"`. Pelo primeiro passo de cada skill, a execução para.

Não é falso positivo: é a guarda de REQ-SKL-003 funcionando contra o caso que ela
existe para pegar — skill mais nova que a CLI instalada. O que estava errado era o
`package.json`, ainda em `0.2.0` enquanto a change acrescentava comando novo.

**Consertado:** versão para `0.3.0` no mesmo dia. Fica a observação de processo: o
número que as skills exigem e o que o `package.json` declara são a mesma decisão
escrita em dois lugares, e só um teste os mantém juntos — o de REQ-SKL-003 amarra
manifest e frontmatter, não a versão do pacote.

## Achado 2 — o `npm test` do alvo estava quebrado e quem disse foi a camada `project`

O script sintético era `node --test test/`, que o Node 22 resolve como módulo e
não como diretório. Nenhum dos dois testes rodava, e o `# skipped 0` da saída
parecia sucesso.

A camada `project` do `specd verify` reprovou na primeira execução depois do
apply. É o comportamento que a camada existe para ter: ela não sabe nada sobre o
projeto além de rodar o comando declarado e ler o código de saída.

## O que a rodada não cobre

Nada de board. `explore` não coletou fonte nenhuma porque nenhuma está declarada,
e `sync` nunca foi chamado. Isso vai para as rodadas 012 e 013.

## Como o alvo foi montado

> Acrescentado em 2026-07-31, ao versionar os registros. A observação acima não
> foi tocada — o que faltava era a receita, sem a qual o registro não se sustenta
> sozinho agora que o alvo fica fora do repositório.

Projeto Node criado na própria rodada, em `sandbox/runs/011/target`:

- `package.json` — `type: module`, privado, `test` rodando `node --test test/*.test.js`
- `src/window.js` — `createWindow(limit, windowMs)`, contador de janela fixa com
  `Map<chave, { start, count }>` e `take(key, now)`
- `src/index.js` — `rateLimiter(options)`, embrulha a janela e devolve a função
  de decisão
- `test/window.test.js` — dois testes: limite dentro da janela, e reset na virada

Depois: `git init`, um commit inicial, e `specd init --skills` com o `dist/` do
repositório specd. Nenhuma dependência instalada; o runner é o do próprio Node.
