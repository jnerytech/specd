# Run 010 — calibração dos revisores, replicação independente

- **Quando:** 2026-07-29, concorrente ao run 009 — as duas execuções partiram
  do mesmo handoff sem saber uma da outra; esta descobriu a outra ao ir gravar
  o resultado e encontrar o arquivo `009` criado seis minutos antes
- **Versão avaliada:** o método de revisão (3 × `code-reviewer`, corte 80), não
  o produto. specd em `fc0de9d` como matéria-prima
- **Alvo:** os mesmos quatro diffs do run 009, montados de forma diferente
- **Veredito:** **replicação confirma o teto do método, com variância alta
  entre execuções.** Aqui, zero dos três defeitos plantados cruzou o corte de
  80 (o 009 registrou um). O defeito que lá saiu a 92 aqui passou ileso por
  três revisores; o que lá foi visto pelos três aqui foi visto por um e
  descartado. Órfã declarada: zero nas duas execuções. A conclusão comum
  sobrevive à variância: "zero achados ≥80" mede consistência interna, não
  ausência de defeito.

> Registro imutável. Segunda medição do instrumento; nenhuma linha de produto
> mudou. Ler junto com o run 009 — as diferenças de montagem importam.

---

## 1. Montagem (onde difere do 009)

Quatro worktrees, cada um no **commit-pai** com a mudança inteira aplicada sem
commit (`git cherry-pick -n`) — revisão "antes de commit" do diff completo,
não de arquivos selecionados. O 009 recortou o diff por arquivo; aqui o
revisor viu a mudança como ela teria chegado à revisão real, com testes, spec
e docs juntos. Três revisores por worktree (correção / P1–P9 /
testes-contrato), corte 80, cegos para o plantio.

| Worktree | Mudança | Defeito plantado (corrigido de verdade em) |
| --- | --- | --- |
| A | `1457e0a` pipeline de verify | `readActiveChange` devolve `sort()[0]` — P4 (`2b946a9`) |
| B | `f317113` hooks | marcador literal `"specd hooks run"` (`9e4ddfd`) |
| C | `079312f` órfã declarada | órfã `declared` fecha sem passar pelo `bodyKey` (`38a108a`) |
| D | `0ceef97` sync/Redmine, **reconstruído** | controle: `close` sem releitura; o 204 é invisível |

A reconstrução de D removeu de uma vez, antes de qualquer revisor rodar, as
cinco promessas de releitura que o 009 foi descobrindo por repescagem:
comentário do `close`, comentário do chamador em `sync/index.ts`, critério de
aceite no `delta.md`, README e `seed.sh` do fixture, nome e comentário do
teste de integração. O vazamento que sobrou foi outro (§2).

## 2. Vazamentos do instrumento nesta execução

1. **`cherry-pick -n` deixa `MERGE_MSG`** no gitdir do worktree com a mensagem
   do commit original — a de D narra o 204. Dois revisores a leram; as células
   foram descartadas e relançadas com o patch em arquivo. O 009 evitou isso
   por construção (diff avulso) e vazou pelos comentários; esta execução
   evitou os comentários e vazou pelo git. Montagens independentes, cada uma
   com o buraco que a outra fechou.
2. **`code-reviewer` não tem Bash.** "Rode `git diff --cached`" era
   impossível; cada revisor improvisou o escopo (mtime via Glob, `MERGE_MSG`,
   árvore inteira) e um recusou a revisão — corretamente. As duas células
   relançadas com patch em arquivo produziram os relatórios mais precisos da
   rodada. Vale retroativamente: as revisões dos runs 007–008 também revisaram
   escopo reconstruído, não o diff real.
3. **O CLAUDE.md corrente entra no contexto de todo subagent** e narra o 204
   com correção e data. Um revisor de C o chamou de "system-supplied"; o de
   D/princípios citou *"Corrigido na Fatia 6: `close` relê"* atribuindo ao
   CLAUDE.md do worktree — onde a frase não existe (`grep` devolve zero).
   Mesmo achado do 009, por rota independente. Não é cegável por montagem.

## 3. Resultado por célula

| | correção | P1–P9 | testes/contrato |
| --- | --- | --- | --- |
| A `sort()[0]` | ✗ 1 falso positivo a 90 (§5) | ✗ **visto e descartado a 40–50** | 2 achados (80, 78), reais |
| B marcador | ✗ leu `settings.ts`/`install.ts`, traçou o merge à mão | ✗ leu o arquivo do marcador | 2 achados ≥80 |
| C órfã declarada | ✗ validou o split como correto | ✗ elogiou a recusa pré-escrita | 2 achados ≥80 |
| D controle | 1 achado real a 85; **sem 204** | 204 citado a 92 **via CLAUDE.md injetado**; +1 real a 80 | 3 achados ≥80; **sem 204** |

Plantados ≥80: **0 de 3.** Controle: citado por uma célula, causa instrumental
(vazamento 3), não leitura de código.

## 4. Comparação com o run 009

| Defeito | 009 | 010 (esta) |
| --- | --- | --- |
| Órfã declarada | zero, três revisores | zero, três revisores |
| Marcador literal | achado a **92** | zero, três revisores |
| `sort()[0]` | visto pelos três: 80, 70, 50 | visto por um: 40–50, descartado |
| Controle 204 | 90 → 55 após fechar vazamentos | 92 numa célula, via CLAUDE.md |

Três leituras saem da comparação:

- **A concordância está no defeito mais caro.** Órfã declarada — o buraco que
  custou a Fatia 8 — é zero limpo nas duas execuções, seis revisores no total,
  incluindo dois focados só em princípios com o P9 apontando para a área. Na
  Fatia 7 aquele comportamento **era a spec**; achá-lo exigia questionar o
  requisito, e revisor de diff trata spec como verdade. É a classe
  "internamente consistente, errado contra o mundo", e ela não cai por leitura
  em nenhuma das duas montagens.
- **A variância está nos outros dois.** O mesmo marcador que uma execução
  reporta a 92 a outra nem menciona; o mesmo `sort()[0]` rende 80-70-50 numa e
  40-50 na outra. Painel de revisores é instrumento ruidoso: uma execução não
  estima o que ele acha, só o que ele não acha de jeito nenhum.
- **A nota acompanha o foco e o contexto, não a gravidade.** Aqui o descarte
  do `sort()[0]` veio com justificativa de época ("nesta altura só existe uma
  change") — o contexto desculpou o bug. Lá, o mesmo defeito variou 30 pontos
  conforme o ângulo do revisor. O corte em 80 sobre autoavaliação filtra
  exatamente a faixa onde os defeitos reais vivem (40–80).

## 5. Confiança autoavaliada não ordena

O único achado de A/correção: `git ls-files` sem pathspec "vaza para fora do
root e quebra o teste do ladder", confiança 90, "confirmado via web search da
documentação do git". Refutado por execução em trinta segundos: `ls-files` de
subdiretório limita ao cwd; a saída real tem duas linhas e nenhum `../`.

Na mesma rodada, um defeito real ficou em 40–50. A régua de confiança não
ordena verdadeiro acima de falso — o 90 falso vinha de raciocínio elaborado e
verificação **alegada e não feita**. É mais uma instância do padrão "coerência
empurrando para o requisito errado" (o 009 registrou a dele no revisor de
princípios de D1; esta é no de correção de A — atores diferentes, mesma
família), reforçando a recomendação de lá: achado que cita documento precisa
citar a linha de código que o confirma, e a decisão de elevar isso a governo é
do autor.

## 6. Subprodutos — achados novos, a triar

Onze achados ≥80 sobre as árvores da época; sete continuam vivos em `fc0de9d`
(conferido por grep, não julgado). Sobreposição com os laterais do 009 é
parcial — os painéis acharam coisas diferentes, o que é o mesmo ruído do §4
apontando na direção útil.

| Achado (célula, confiança) | Em HEAD? |
| --- | --- |
| `scanFilter` definido e nunca chamado — âncora verde em código morto, P7 (D/test, 90) | vivo |
| `closedStatusId` escolhe o primeiro `is_closed` sem configuração — P4 (D/prin, 80) | vivo |
| `FieldDefinitionsUnavailableError` do caminho 403 nunca nomeia os campos configurados (D/corr, 85) | vivo |
| família `hooks` sem teste de dispatch via `main()` (B/test, 85) | vivo |
| branch `--file` + posicional sem teste via `cli()` (B/test, 85) | vivo |
| `restore`/`converged` sem cena de integração (D/test, 82) | vivo |
| `report.blocked` não exercitado em pipeline/CLI/hook (C/test, 82) | vivo |
| `archive --sync` só coberto por teste Docker-gated (C/test, 85) | conferir |
| item local não asserido em `BoardRefusedError` (D/test, 82) | conferir |
| critério da task 006 falso sob `graduated` com tudo in-flight (A/test, 80) | histórico |
| task done com `evidence.commits` vazio (A/test, 78 — sub-corte) | histórico |

## 7. O que a replicação decide

1. **A pergunta do handoff está respondida duas vezes: o teto era do método.**
   "Zero achados ≥80" nas revisões das Fatias 7–8 é evidência de consistência
   interna, não de código limpo. O painel continua valendo pelo que acha —
   subprodutos reais em toda rodada, nas duas execuções — não pelo silêncio.
2. **O contra-argumento do run 008 cai.** Ângulos disjuntos sem achado
   repetido mediam não-redundância; aqui e no 009, ângulos disjuntos deixaram
   passar defeitos reais conhecidos. Disjunção não é completude.
3. **A classe que importa só cai rodando contra coisa nova.** Reforça a
   pendência número um do handoff: nunca usado em projeto real.
4. **Duas sessões executaram o mesmo handoff em paralelo sem se ver.** O
   handoff diz o que fazer, não quem faz — colisão só foi detectada na
   gravação, porque run é arquivo numerado. Operação que custa (12+ revisores,
   duas vezes) aconteceu em dobro e em silêncio até o fim: P9 aplicado ao
   próprio fluxo de trabalho. Um handoff com próximo passo executável merece
   marcador de "em execução por alguém".
