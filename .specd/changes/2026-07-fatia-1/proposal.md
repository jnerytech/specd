---
change: 2026-07-fatia-1
status: active
---

# Fatia 1 — init, explore, verify, status

## Por quê

O specd precisa provar seu diferencial antes de construir orquestração. A detecção de drift por âncoras é a única capacidade que não existe em nenhum dos 25 harnesses avaliados; tudo o mais (propose, apply, sync) tem substituto no mercado.

Esta fatia entrega um verificador utilizável sobre repositórios reais sem exigir que o ciclo completo exista. O critério de sucesso é concreto: rodar `specd verify` num repositório com specs anotadas e ver o gate reprovar por drift real.

## Escopo

Entram: `init`, `explore`, `verify`, `status`, o parser EARS, a escada de âncoras e a resolução de configuração.

Ficam fora: `propose`, `apply`, `sync`, `archive`, `anchor fix`, memória e hooks.

## Camadas do verify realmente ativas nesta fatia

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

Isso não é tarefa desta fatia. Não produz código, não referencia requisito e é executado por pessoa, não por agente. Está registrado aqui e no README porque precede tudo o mais.

## Não-objetivos declarados

Nenhuma execução de LLM dentro da CLI. Nenhum acesso de rede durante o verify. Nenhuma resolução automática de ambiguidade.
