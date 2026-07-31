# Run 002 — depois da Fatia 4

- **Quando:** 2026-07-28
- **Versão avaliada:** specd ao fim da Fatia 4
- **Alvo:** `sandbox/sample05`, mesmo repositório do [run 001](001-fatia-3.md),
  com `.specd/` apagado e recriado do zero.
- **Veredito:** cinco dos seis critérios atingidos. A busca deixou de ser cega
  (0 → 211 arquivos) e a colisão de prefixo morreu; o extrator de termos do
  `anchor suggest` continua sem produzir candidata única.

> Registro imutável. Descreve o que foi observado naquele momento, com aquela
> versão.

## Achados do run 001 fechados aqui

| Achado do 001 | Como foi fechado |
| --- | --- |
| 1 — `detect-stack` não conhece .NET | `.sln`/`.csproj`/Makefile reconhecidos |
| 2 — busca de fallback vê zero arquivos | listagem cai para `walk` quando o git devolve vazio |
| 3 — busca casa substring | match passou a exigir fronteira de identificador |
| 4 — uso confundido com declaração | mitigado pela fronteira; convenção `public class X` mantida |
| 5 — `anchor suggest` inútil | **parcial** — teto de arquivos por termo; sem candidata única |
| 6 — `init` cria `.specd/archive/` órfão | passou a criar `.specd/changes/archive/` |
| 7 — template com política do Modelo A e 3 camadas | política por origem, seis camadas derivadas de `VERIFY_LEVELS` |

Também respondidas as quatro decisões que o 001 disse faltarem na spec: raiz do
projeto (REQ-CFG-010), o que a busca enxerga (REQ-ANC-009), o que conta como
match (REQ-ANC-010), e relatório de modo degradado (REQ-VER-012).

---

## Antes e depois

| # | Item | Antes | Depois |
| --- | --- | --- | --- |
| 1 | `init` detecta stack | `No build manifest recognised` | `Detected dotnet from GymErp.sln`, `validation_command = ["dotnet","test"]` |
| 1b | Diretórios criados | `.specd/archive/` órfão | `.specd/changes/archive/`, e o órfão não existe |
| 1c | Camadas no template | 3 de 6 | 6 de 6, derivadas de `VERIFY_LEVELS` |
| 1d | Política no comentário | texto do Modelo A | grada por origem, texto vigente |
| 2 | Busca de fallback | **0 arquivos** | **211 arquivos via walk** |
| 3 | `anchor suggest` | 15 candidatas, 0 únicas, 0 descartadas | 4 candidatas, 0 únicas, **11 descartadas** |
| 4 | REQ-TEN-003 quebrada | `dangling` sem sugestão | `dangling-with-suggestion` → `TenantAccessor.cs:3` |
| 5 | REQ-ENR-004 quebrada | recusa | recusa, e agora pelo motivo certo |
| 6 | Relatório do gate | silencioso sobre a listagem | `listed 211 files via walk` |

## Critérios de aceite

| Critério | Resultado |
| --- | --- |
| `init` propõe comando coerente para .NET | ✅ `["dotnet","test"]` a partir de `GymErp.sln` |
| Config oferece as seis camadas e a política vigente | ✅ |
| `anchor suggest` produz candidatas únicas | ❌ **não atingido** — ver abaixo |
| REQ-TEN-003 recebe sugestão | ✅ colisão de prefixo morta |
| REQ-ENR-004 continua recusando | ✅ ambiguidade real preservada |
| Nenhum comando verde com busca cega | ✅ o gate diz o modo e a contagem |

Cinco de seis.

## O critério que não foi atingido, e por quê

`anchor suggest` melhorou o sinal — de 15 candidatas inúteis para 4, com 11
termos-ruído descartados pelo teto — mas continua com **zero candidatas
únicas**. E a causa não é a que o relatório original supôs.

Testei a hipótese óbvia primeiro: `DECLARATION_FORMS` só tem formas TypeScript,
todas começando com `export `, e C# não tem `export`. Acrescentar
`public class `, `public interface `, `public record ` deveria resolver.

**Não resolveria.** Os termos que o extrator produz para os dez requisitos são:

```
REQ-ENR-001  [GymErp]
REQ-ENR-002  [Suspended, GymErp]
REQ-ENR-003  [Active, Canceled, GymErp]
REQ-ENR-004  []
REQ-RES-001  [GymErp]
REQ-TEN-002  [tenants/{name}, GymErp]
REQ-TEN-003  [Tenant, Register, GymErp]
REQ-TEN-004  [DatabaseConnection, GymErp]
```

Nenhum é nome de tipo. `public class Suspended` não existe — o tipo é
`SuspendedState`. `public class Tenant` não existe — é `TenantAccessor`.
Rodei as cinco formas C# contra todos os termos: **zero matches únicos.**

O extrator só encontra símbolo que o autor já escreveu no requisito. E os
requisitos descrevem comportamento em prosa — *"the tenant accessor is
disposed"*, *"the GymErp enrollment aggregate"* — onde o nome do tipo aparece
como duas palavras minúsculas, não como identificador.

**Um requisito que nomeia o símbolo quase não precisa de sugestão.** Um que não
nomeia é o caso que a ferramenta deveria servir, e é exatamente onde ela não
tem o que buscar.

Fazer isso funcionar exigiria juntar palavras adjacentes em PascalCase e testar
os resultados — inventar nome de símbolo a partir de prosa. É heurística de
outra natureza, muito além de "cauda opcional", e merece decisão própria em vez
de ser enfiada aqui. Não implementei.

O teto entrou e vale por si: o relatório deixou de custar quinze leituras para
dar zero, e passou a custar quatro.

## Bônus não pedido: `anchor fix` num repo .NET

Com a sugestão passando a existir, o comando que depende dela ficou utilizável
pela primeira vez fora deste repositório:

```
$ specd anchor fix REQ-TEN-003
REQ-TEN-003: modernized/GymErp/Tenant/TenantEFMiddleware.cs
          -> modernized/GymErp/Tenant/TenantAccessor.cs (.specd/specs/tenancy.md:48)
Rewritten and left unstaged — read the diff before committing.
```

A âncora foi reescrita, o `symbol` preservado, nada staged, e o gate voltou
verde. Na primeira rodada esse comando não tinha o que aplicar, porque a busca
enxergava zero arquivos.

## O que continua aberto

**Extrator de termos do `anchor suggest`.** Descrito acima. É a única peça do
relatório original que não foi resolvida, e o motivo mudou: não é lista de
formas de declaração, é a distância entre prosa de requisito e nome de símbolo.

**Conteúdo de template não tem contrato.** Registrado no proposal da Fatia 4. O
texto da política de âncora foi corrigido, mas nada impede a próxima
divergência: a lista de camadas virou derivada e é gatilhável, o texto em prosa
continua verificável só por leitura.

**`.cs` não precisou de treesitter.** Confirmado na prática: com fronteira de
palavra, grep resolve os dez requisitos no passo 3 e sugere corretamente no
passo 5. A previsão do relatório original se sustentou.
