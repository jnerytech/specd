# Run 003 — Fatia 5, hooks

- **Quando:** 2026-07-28
- **Versão avaliada:** specd ao fim da Fatia 5
- **Host:** Claude Code **2.1.220**
- **Alvos:** o próprio repositório `specd` (hooks) e `sandbox/sample05`
  (`anchor suggest --file`)
- **Veredito:** o adaptador funciona e falha fechado, verificado com exit code e
  payload reais. `--file` resolve o caso que o extrator de termos não resolvia.
  Um defeito de reconhecimento apareceu em campo e não em teste. O bloqueio ao
  vivo **foi observado** numa segunda sessão do mesmo dia (§3b): `Stop` e
  `PostToolUse` bloquearam, e o canal que chegou ao agente foi o **stderr**, não
  o JSON.

> Registro imutável. Descreve o que foi observado naquele momento, com aquela
> versão do specd e aquela versão do host.

---

## 1. O adaptador, medido

Comando instalado:

```
node /home/dev/repos/specd/dist/cli.js hooks run stop --fast
```

**Gate limpo:**

```
$ node dist/cli.js hooks run stop --fast
{}
specd verify passed (Stop hook, 0 errors, 0 warnings).
exit=0
```

**Âncora quebrada** — renomeei `findProjectRoot` para `locateProjectRoot` em
`src/core/root.ts`, que é o alvo da âncora de REQ-CFG-010:

```
$ node dist/cli.js hooks run stop --fast
{"decision":"block","reason":"specd verify failed (Stop hook). ..."}
specd verify failed (Stop hook). The spec and the code disagree.

  ok   provenance: passed (0 errors, 0 warnings)
  ok   schema: passed (0 errors, 0 warnings)
  ok   coverage: passed (0 errors, 0 warnings)
 fail  anchors: failed (1 error, 0 warnings)
    error .specd/specs/config.md:172 [REQ-CFG-010] Anchor of REQ-CFG-010 does
    not resolve: "export function findProjectRoot" in "src/core/root.ts"
    (ladder step 5). ...
    listed 221 files via git
Stopped at layer "anchors".
verify: failed

Resolve this before finishing: move the code back, update the anchor with
`specd anchor fix <requirement>`, or correct the spec.
exit=2
```

**Exit 2, não 1.** Os dois canais carregam a mesma razão: o JSON no stdout e o
texto no stderr. O bloqueio é o exit code — se o host ignorar o payload, ainda
bloqueia.

**Não conseguiu verificar** (diretório sem `.specd/`): também exit 2, com
*"specd could not run the gate ... This is not an approval — nothing was
checked."* Coberto por teste.

## 2. O defeito que o teste não pegou

Rodar `specd hooks install` duas vezes **duplicou as entradas**. O critério de
aceite reprovou em campo com toda a suíte verde.

Causa: o reconhecimento da própria entrada era a string literal
`"specd hooks run"`. Com `--command "node /home/dev/repos/specd/dist/cli.js"`, o
comando escrito é

```
node /home/dev/repos/specd/dist/cli.js hooks run stop --fast
```

que contém `specd` e contém `hooks run`, mas **nunca** `specd hooks run` — há
`/dist/cli.js ` no meio. O install deixava de enxergar a própria entrada e
acrescentava outra a cada execução.

Todos os testes unitários usavam o executável default, onde a string casa. O
teste passava porque testava o único caso em que o bug não aparece.

Corrigido trocando o marcador por `/(?:^|\s)hooks\s+run\s+(stop|post-tool-use)\b/`
— o subcomando e o evento, não o executável — e acrescentando dois testes: um com
executável custom rodado duas vezes, outro conferindo que instalar sob executável
diferente é tratado como divergência e não como entrada nova.

Depois da correção:

```
$ node dist/cli.js hooks install --command "$E"   # primeira vez
Wrote .claude/settings.json
  installed node .../dist/cli.js hooks run stop --fast
  installed node .../dist/cli.js hooks run post-tool-use --fast

$ node dist/cli.js hooks install --command "$E"   # segunda
.claude/settings.json unchanged
  already installed node .../dist/cli.js hooks run stop --fast
  already installed node .../dist/cli.js hooks run post-tool-use --fast
exit=0

$ node dist/cli.js hooks install                  # executável diferente
".claude/settings.json" already holds a specd hook whose command differs...
  stop
    existing: node .../dist/cli.js hooks run stop --fast
    wanted:   specd hooks run stop --fast
specd does not choose between them. Run again with --force to replace.
exit=2
```

Terceiro defeito consecutivo encontrado rodando a ferramenta contra algo que ela
não tinha visto, e não por teste.

## 3. O bloqueio ao vivo — não observado na primeira sessão

O critério que exige o host de verdade **não foi atingido na sessão de
2026-07-28 (primeira)**, e não por falha do adaptador.

O `.claude/settings.json` foi criado no meio da sessão. Com o gate vermelho, uma
escrita de arquivo — que casa o matcher `Edit|MultiEdit|Write|NotebookEdit` — não
produziu nenhum retorno de hook. A leitura mais simples é que o host lê as
configurações de projeto na abertura da sessão e não recarrega um arquivo que
passou a existir depois.

**Isto não conta como aprovado nem como reprovado.** É P8 aplicado ao próprio
relatório: verifiquei o adaptador, não verifiquei o acoplamento com o host, e as
duas coisas não podem sair sob o mesmo verde.

Procedimento para fechar, em sessão nova com o hook já instalado:

1. Renomear um símbolo alvo de âncora — `findProjectRoot` em `src/core/root.ts`
   serve, e `git checkout src/core/root.ts` desfaz.
2. Confirmar à mão: `node dist/cli.js hooks run stop --fast` deve sair 2.
3. Pedir ao agente que encerre a resposta.
4. Registrar: bloqueou ou não, qual canal apareceu ao agente (stderr ou o JSON),
   e a versão do host.

O que já se sabe sem essa observação: o comando escrito no `settings.json` é
válido e sai 2 quando deve. O que falta saber é se **este** host, nesta versão,
converte esse 2 em bloqueio do evento `Stop`.

## 3b. O bloqueio ao vivo — observado

Segunda sessão, mesmo dia, com o `.claude/settings.json` já presente na abertura.
O procedimento do §3 foi executado na íntegra.

- **Host:** Claude Code **2.1.220** (`claude --version`).
- **Preparo:** `findProjectRoot` renomeado para `locateProjectRoot` em
  `src/core/root.ts`. Confirmado à mão: `node dist/cli.js hooks run stop --fast`
  sai **2**, com `{"decision":"block",...}` no stdout e o texto no stderr.

**`Stop` bloqueou.** O agente encerrou a resposta e o host não encerrou o turno:
devolveu o controle ao agente com a razão do gate e o turno continuou.

**Canal: o texto (stderr), não o JSON.** O que chegou ao agente foi o bloco
prefixado `Stop hook feedback:` contendo o texto humano — as quatro linhas de
camada, o erro de âncora com arquivo e linha, `Stopped at layer "anchors".` e o
parágrafo `Resolve this before finishing:`. **O envelope JSON não apareceu**: nem
as chaves `decision`/`reason`, nem a linha `{"decision":"block",...}` que o
comando imprime no stdout. Isso é consistente com o contrato documentado do host
— exit 2 devolve o stderr ao modelo e o stdout só é lido como JSON quando o
código de saída é 0. Como o `reason` do JSON carrega exatamente o mesmo texto,
os dois canais não se distinguem pelo conteúdo; distinguem-se pela **ausência do
envelope**, e é essa ausência que foi observada.

**`PostToolUse` também bloqueou, e antes.** O próprio `Edit` que renomeou o
símbolo foi barrado pelo matcher `Edit|MultiEdit|Write|NotebookEdit`, com a
mesma forma: texto, sem envelope, anunciado como *"PostToolUse:Edit hook blocking
error from command"*. Ou seja, o acoplamento com o host está verificado nos dois
eventos instalados, não só no `Stop`.

**O que isto fecha e o que não fecha.** Fecha o critério 6: nesta versão deste
host, o exit 2 do adaptador vira bloqueio real do evento `Stop`. Não fecha o §6 —
o formato do payload continua sendo contrato de terceiro, e esta observação
mostra justamente que o host **não** consumiu o JSON. O envelope permanece escrito
contra a convenção documentada, não contra comportamento observado; quem bloqueia
é o exit code, como projetado.

**Restauração:** `git checkout src/core/root.ts`, gate de volta a verde
(`hooks run stop --fast` → `{}` e exit 0). O hook segue instalado, por decisão —
este repositório é o primeiro caso de teste real da própria ferramenta.

## 4. `anchor suggest --file` contra o sample05

O run 002 mediu por que o extrator de termos dá zero candidatas únicas: os termos
levantados da prosa não são nomes de tipo. `--file` inverte a pergunta.

```
$ specd anchor suggest --file modernized/GymErp/Tenant/TenantAccessor.cs
Declarations in modernized/GymErp/Tenant/TenantAccessor.cs (csharp)
specd never writes these into the spec — copy the one the requirement is about.

    modernized/GymErp/Tenant/TenantAccessor.cs:3
      symbol: "public class TenantAccessor"
```

Os casos que o extrator não conseguia atender, agora atendidos:

| Requisito | termo extraído (run 002) | `--file` devolve |
| --- | --- | --- |
| REQ-ENR-002 | `Suspended` → 0 únicas | `public class SuspendedState` |
| REQ-ENR-003 | `Active`, `Canceled` → 0 únicas | `public class ActiveState` |
| REQ-TEN-003 | `Tenant` → 0 únicas | `public class TenantAccessor` |

`SuspendedState` é o símbolo que o extrator nunca acharia, porque o requisito
escreve *"suspended"* em prosa e o tipo tem outro nome. `--file` não adivinha
nada: lista o que está escrito no arquivo.

**Extensão sem padrão conhecido** reporta isso em vez de lista vazia:

```
$ specd anchor suggest --file GymErp.sln
No declaration pattern is known for ".sln" (GymErp.sln).
This is not an empty file — specd cannot read declarations of this kind,
so it reports nothing rather than reporting nothing found.
Known extensions: .cjs .cs .cts .go .js .jsx .mjs .mts .py .ts .tsx
```

**Caminho inexistente** sai 2 e nomeia a raiz do projeto contra a qual resolveu.

Um caso que o `.sln` deixa exposto: `EState.cs` devolve `public enum EState`, e
`States/EnrollmentState.cs` devolve `public interface IEnrollmentState` — ou
seja, o nome do arquivo não prediz o nome do tipo, que é outra forma da mesma
distância entre prosa e símbolo.

## 5. Critérios de aceite

| Critério | Resultado |
| --- | --- |
| `hooks install` duas vezes não duplica | ✅ depois da correção do §2 |
| Hook de terceiro preservado | ✅ coberto por teste |
| settings malformado sai 2 sem sobrescrever | ✅ seis formas malformadas, e `--force` não contorna |
| `uninstall` remove só o que reconhece | ✅ inclusive contêiner já vazio preservado |
| `anchor suggest --file` lista as declarações | ✅ §4 |
| Âncora quebrada impede o agente de encerrar | ✅ §3b — Claude Code 2.1.220, canal stderr |

Seis verificados. O sexto exigiu uma segunda sessão, porque o host só lê as
configurações de projeto na abertura (§3).

## 6. O que este run deixa aberto

**Formato do payload é contrato de terceiro, e o host não o consumiu.** O
`{"decision":"block","reason":...}` foi escrito contra a convenção documentada,
não contra comportamento observado — e o §3b mostra que, com exit 2, este host
entrega ao agente o stderr e ignora o envelope. Quem bloqueia é o exit code, como
projetado. Se uma versão futura passar a ler o JSON, ou mudar o formato dele, o
bloqueio continua; o que pode mudar é a forma como a razão chega ao agente.

**Uma versão de um host.** O acoplamento está verificado em Claude Code 2.1.220 e
em mais nenhum outro host nem versão.
