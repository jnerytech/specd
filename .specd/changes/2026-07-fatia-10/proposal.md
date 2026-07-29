---
change: 2026-07-fatia-10
status: active
---

# Fatia 10 — a publicação que aconteceu e a documentação que não soube

## Por quê

`npm view @jnerytech/specd version` responde `0.0.2`. `package-lock.json`
resolve `node_modules/@jnerytech/specd` de
`https://registry.npmjs.org/@jnerytech/specd/-/specd-0.0.2.tgz`. O pacote está
publicado.

README.md e CLAUDE.md dizem que não está. REQ-CLI-007 tem a premissa escrita na
própria statement — *for as long as the package is absent from the registry* —
e a condição venceu.

O gate está verde.

## O achado que segura o resto

Não é a documentação desatualizada. É o teste.

```
test/distribution/package.test.ts:89   expect(manifest.name).toBe("@jnerytech/specd")
test/distribution/readme.test.ts:52    expect(readme).toMatch(/não está publicado|não publicado/)
README.md:50                           "Decisão tomada: sem escopo. package.json já
                                        declara name = "specd"."
```

A suíte **sabe** que o nome é escopado, na linha 89 de um arquivo, e **exige**
que o README continue afirmando que o pacote não foi publicado, na linha 52 de
outro. As duas passam. E o README afirma sobre `name` o oposto exato do que o
teste vizinho verifica sobre `name`.

O teste da linha 52 não confere se a afirmação é verdadeira — ele trava a
redação dela. Nada nele podia detectar a publicação, porque `verify` é offline
por P3 e o registry é rede. Então o que parecia rede era fecho: manteve a frase
no lugar exatamente enquanto ela deixava de ser verdade.

**Este é P8 numa forma que ainda não estava na lista.** As quatro instâncias
registradas são silêncio apresentado como aprovação. Esta é uma verificação que
roda, passa, e responde a uma pergunta que expirou. Verde significava "o README
ainda diz aquilo", e se lia como "o README está certo". O terceiro resultado —
não consegui verificar — existia e estava disfarçado de primeiro.

## A regra que sai daqui

**Teste que não pode conferir uma afirmação não deve fixá-la.** Se `verify` é
offline, então estado do registry é a categoria "não consegui verificar", e a
saída correta não é congelar a prosa: é tirar a afirmação de onde um teste finge
cobri-la, e checar o que é checável offline — que a documentação e o
`package.json` nomeiem o mesmo pacote.

Nome de pacote é fato local, está no manifesto, e diverge do mesmo jeito. Estado
de publicação é fato remoto e não é do gate.

## Escopo

### 1. A documentação nomeia o pacote que existe

`package.json` declara `@jnerytech/specd` desde o commit 6ab3fa5. README.md:50 e
CLAUDE.md ficaram na decisão anterior, que era `specd` sem escopo, e o README a
apresenta como fato consumado.

Consequência prática, não cosmética: `npx specd` está documentado como o caminho
de instalação e **não funciona nem vai funcionar** — `specd` sem escopo responde
404 e nunca foi reservado. Quem segue o README para no primeiro comando, que é a
parede que REQ-CLI-007 existia para derrubar. Ele a derrubou para o caso de
"ainda não publicado" e a reergueu para o caso de "publicado com outro nome".

REQ-CLI-007 é reescrito com a premissa de registry fora e o acoplamento com
`name` dentro, ao lado do acoplamento com `bin` que já tinha.

### 2. O pacote deixa de depender de si mesmo

`dependencies` declara `"@jnerytech/specd": "^0.0.2"`. Grep de import: zero em
`src/` e em `test/`. `node_modules/.bin/specd` aponta para a cópia do registry;
os hooks em `.claude/settings.json` chamam o caminho absoluto da árvore de
trabalho. Duas cópias do specd em disco, e nada na tela diz qual roda.

Hoje as duas são 0.0.2 e a divergência não aparece. Quando a Fatia 9 entrar,
`node_modules/.bin/specd verify --help` sai 2 e `dist/cli.js verify --help` sai
0 — mesmo nome de comando, respostas diferentes.

O modo de falha é P8: um gate que resolvesse pelo PATH do npm rodaria a versão
publicada, e verde significaria "o specd de antes aprovou". Fecha em círculo,
porque publicar a correção do gate exige o gate passar, e quem passa é a versão
anterior à correção.

**A dependência é resíduo de um instinto correto.** Provar que o publish pegou é
P8 na direção de escrita — resposta de sucesso não é prova, quem confirma é a
releitura. Instalar o pacote e ver o binário rodar é releitura de verdade. O erro
foi deixar a prova instalada dentro do objeto provado.

## O que esta fatia não decide

**Não reabre o escopo.** `specd` sem escopo continua livre no registry e o
argumento do README a favor dele continua de pé — `npx specd` é melhor que `npx
@jnerytech/specd`. Mas a decisão foi tomada e publicada, e reverter agora é
mudança de nome de pacote publicado, que tem custo próprio e nada a ver com
help nem com self-dependency. Reservar o nome sem escopo, defensivamente ou para
migrar depois, é operação de registry: fica fora do gate por P3 e fora desta
fatia.

**Não acrescenta teste sobre o registry.** É a regra desta fatia aplicada a ela
mesma. Um teste que consultasse `npm view` poria rede no gate e violaria P3; um
que afirmasse a publicação em prosa recriaria a linha 52 com outro texto.

## Fora de escopo

`propose`, `apply` e memória. A Fatia 9, que está aberta e não arquivada — as
duas não se tocam: 9 é superfície de CLI, 10 é distribuição.
