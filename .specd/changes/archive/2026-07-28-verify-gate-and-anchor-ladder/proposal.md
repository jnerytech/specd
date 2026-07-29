---
change: 2026-07-28-verify-gate-and-anchor-ladder
status: active
---

# verify-gate-and-anchor-ladder — init, explore, verify, status

## Por quê

O specd precisa provar seu diferencial antes de construir orquestração. A detecção de drift por âncoras é a única capacidade que não existe em nenhum dos 25 harnesses avaliados; tudo o mais (propose, apply, sync) tem substituto no mercado.

Esta change entrega um verificador utilizável sobre repositórios reais sem exigir que o ciclo completo exista. O critério de sucesso é concreto: rodar `specd verify` num repositório com specs anotadas e ver o gate reprovar por drift real.

## Escopo

Entram: `init`, `explore`, `verify`, `status`, o parser EARS, a escada de âncoras e a resolução de configuração.

Ficam fora: `propose`, `apply`, `sync`, `archive`, `anchor fix`, memória e hooks.

Quatro requisitos ficam especificados e sem implementação nesta change. Continuam nas capabilities para referência, e o delta não os menciona — em specd, adiar é não constar do delta, e é por isso que a política graduated trata cada um deles como erro e não como aviso. REQ-ANC-007 (archive não tolera âncora pendurada) espera o comando `archive`; REQ-ANC-008 (fix reescreve com revisão) espera `anchor fix`; REQ-VER-004 (camada coverage) e REQ-VER-005 (camada evidence) esperam as tasks, que chegam com `propose`.

O delta declara só ADDED, MODIFIED e REMOVED, as três seções que REQ-FMT-005 admite. Cada uma corresponde a algo que o `archive` faz com as capabilities; adiamento não corresponde a nada, e por isso é prosa aqui e não seção lá.

## Camadas do verify realmente ativas nesta change

| Camada | Ativa? | Motivo |
|---|---|---|
| provenance | Parcial | Valida manifest quando existe; sem change formal ainda |
| schema | Sim | Roda sobre capabilities |
| coverage | Não | Depende de tasks, que vêm com `propose` |
| anchors | Sim | O diferencial |
| evidence | Não | Depende de tasks |
| project | Sim | Shell-out independe do resto |

## Dependência crítica

Specs existentes não têm âncoras. Sem uma forma de anotá-las, a camada que mais diferencia não roda em nada. A primeira tarefa resolve isso com um relatório de candidatas que exige confirmação humana — nunca escrita automática, por REQ-CLI-003.

## Pré-requisito operacional

Antes de qualquer implementação, reservar o nome `specd` no npm sem escopo, e opcionalmente `@jnerytech/specd` como reserva. `npx specd` é preferível a `npx @jnerytech/specd`, e o nome sem escopo está livre hoje — mas não permanece livre por decreto.

Isso não é tarefa desta change. Não produz código, não referencia requisito e é executado por pessoa, não por agente. Está registrado aqui e no README porque precede tudo o mais.

`package.json` já declara `name = "specd"`, o que é pré-condição para reservar, não substituto. Enquanto o nome não estiver publicado, `npx specd` resolve para qualquer pacote que ocupe esse nome no registry — possivelmente de outro autor. Nenhum critério de aceite de REQ-CLI-006 afirma o contrário: o que os testes cobrem é o tarball instalar e expor o binário, offline. A reserva é fato de registry e continua sendo trabalho humano.

## Não-objetivos declarados

Nenhuma execução de LLM dentro da CLI. Nenhum acesso de rede durante o verify. Nenhuma resolução automática de ambiguidade.
