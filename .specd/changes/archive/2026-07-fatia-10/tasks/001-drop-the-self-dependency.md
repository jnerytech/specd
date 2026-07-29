---
id: "001-drop-the-self-dependency"
change: 2026-07-fatia-10
req: [REQ-CLI-012]
status: done
evidence:
  commits: ["8cb4633"]
---

## Objetivo

Remover `"@jnerytech/specd": "^0.0.2"` de `dependencies` e pôr sob teste a regra que impede a linha de voltar.

## Escopo

Uma linha sai de `package.json`, `package-lock.json` é regenerado, `node_modules/@jnerytech/` e o symlink `node_modules/.bin/specd` desaparecem no próximo install.

`test/distribution/package.test.ts` ganha o caso: o valor de `name` não aparece em `dependencies`, `devDependencies` nem `peerDependencies`, e nenhum arquivo de `src/` ou `test/` o importa.

## Restrições

- Vem antes da 002 porque é isolada e mecânica, e porque a 002 mexe em `readme.test.ts`, que é o arquivo onde a atenção precisa estar inteira
- Grep antes de remover, para que a premissa seja medida e não lembrada: zero import hoje, e o teste novo é o que mantém isso verdadeiro
- O critério de import é o que importa a longo prazo. A linha de manifesto é o sintoma; o padrão proibido é o gate em desenvolvimento chamar o produto publicado
- Não tocar em `.claude/settings.json`. O caminho absoluto para `dist/cli.js` está certo e é o dogfood que deve continuar
- Não mexer em `files`, `bin` nem no nome. Isso é 002 e é outro assunto
- Confirmar que `npm ci` limpo continua verde: a dependência não era usada, então nada deve quebrar, e "nada quebrou" precisa ser observado e não deduzido

## Critérios de aceite

- `package.json` não lista o próprio nome em nenhuma das três seções de dependência
- Teste falha se o nome for reintroduzido em qualquer uma delas
- Teste falha se algum módulo de `src/` ou `test/` importar o próprio nome de pacote
- Depois de `npm ci`, `node_modules/@jnerytech/` não existe
- `npm run verify` passa, e o teste de distribuição empacotado continua passando
