---
change: 2026-07-29-published-package-documentation
target: [cli]
---

# Delta — published-package-documentation

Tirar do gate a afirmação que ele não pode conferir, pôr no lugar a que ele
pode, e desfazer a prova de publicação que ficou instalada dentro do objeto
provado.

## ADDED

### REQ-CLI-012 — The package does not depend on itself

**Capability.** cli

**Statement.** The specd package SHALL NOT list its own name among its declared dependencies.

**Acceptance.**

- `dependencies`, `devDependencies` e `peerDependencies` não contêm o valor de `name`
- Nenhum módulo de `src/` ou de `test/` importa o próprio nome de pacote
- Teste falha se o nome reaparecer em qualquer das três listas, ou em qualquer import

`dependencies` declarava `"@jnerytech/specd": "^0.0.2"`, resolvido do registry, e
grep de import devolvia zero. Uma segunda cópia do produto em disco, que nada
chamava.

O critério sobre import não é redundante com o de manifesto. Ele é o que proíbe
o padrão, e não só a linha: um dogfood que chamasse o specd publicado para
validar o specd em desenvolvimento fixaria o gate na versão anterior à correção
que está sendo escrita. Verde significaria "o specd de antes aprovou" e se leria
como "o specd atual aprovou" — absence-is-not-compliance, e em círculo, porque publicar a correção do
gate exige o gate passar.

Enquanto as duas cópias tiverem a mesma versão a divergência é invisível, que é
a razão de isto ser requisito e não limpeza. `node_modules/.bin/specd` resolve
para a cópia do registry e `.claude/settings.json` chama o caminho absoluto da
árvore de trabalho; qual dos dois responde depende de quem digitou o comando.

O dogfood correto já existe e não passa por aqui: `dist/`, saída do build atual,
valida `src/`, fonte atual. Build anterior conferindo fonte corrente é
self-hosting; dependência de registry é outra coisa com aparência parecida.

```yaml anchors
- file: test/distribution/package.test.ts
  symbol: "does not depend on itself"
```

## MODIFIED

### REQ-CLI-007 — The documentation names the package and the executable that package.json declares

**Statement.** The specd documentation SHALL name the package and the executable path that `package.json` declares, so that the invocation a reader copies is the one that exists.

**Acceptance.**

- O nome de pacote citado no README e no CLAUDE.md é o mesmo que `package.json` declara em `name`
- O caminho do executável citado é o mesmo que `package.json` declara em `bin`
- Teste falha se `name` ou `bin` mudar e a documentação não acompanhar
- README mostra a sequência de clone a comando funcionando, porque `dist/` é saída de build e não está no repositório
- Nenhum teste da suíte afirma estado do registry, nem fixa a redação de uma afirmação sobre ele

A versão anterior deste requisito carregava a premissa na própria statement —
*for as long as the package is absent from the registry* — e a condição venceu
quando `@jnerytech/specd@0.0.2` foi publicado. A documentação continuou dizendo
que não estava, o teste continuou exigindo que dissesse, e o gate continuou
verde.

**O achado é o teste, não a documentação.** `readme.test.ts` cobrava
`/não está publicado|não publicado/` no README. Ele não conferia se a afirmação
era verdadeira — nada nele podia, porque estado do registry é rede e `verify` é
offline por gate-no-network. O que parecia rede era fecho: manteve a frase no lugar
exatamente enquanto ela deixava de ser verdade. E na mesma suíte,
`package.test.ts` já afirmava `name === "@jnerytech/specd"` enquanto o README
dizia que `name` era `specd`.

É absence-is-not-compliance numa forma que não estava na lista das quatro. Aquelas são silêncio
apresentado como aprovação. Esta é verificação que roda, passa, e responde a uma
pergunta que expirou — o terceiro resultado, não consegui verificar, disfarçado
de primeiro.

Daí o último critério, que é a regra generalizada: **teste que não pode conferir
uma afirmação não deve fixá-la.** A saída não é congelar a prosa com outra
redação; é tirar a afirmação de onde um teste finge cobri-la e checar o que é
checável offline. Nome de pacote é fato local, está no manifesto, e diverge do
mesmo jeito. Estado de publicação é fato remoto e não é do gate.

A consequência prática não é cosmética. `npx specd` estava documentado como o
caminho de quem instala e não funciona nem vai funcionar: o nome sem escopo
responde 404 e nunca foi reservado. Quem segue o README para no primeiro
comando, que é a parede que este requisito existia para derrubar — derrubada
para o caso "ainda não publicado" e reerguida para o caso "publicado com outro
nome".

```yaml anchors
- file: test/distribution/readme.test.ts
  symbol: "the documentation names the declared package"
```

## REMOVED

Nenhum.
