---
id: 002-config-resolver
change: 2026-07-fatia-1
req: [REQ-CFG-001, REQ-CFG-002, REQ-CFG-003]
status: pending
evidence:
  commits: []
---

## Objetivo

Resolver configuração TOML com precedência de quatro níveis, rejeição de chave desconhecida e credencial por variável de ambiente.

## Escopo

Schema tipado da configuração, leitura de `~/.specd/config.toml` e `.specd/config.toml`, merge campo a campo, resolução de token.

## Restrições

- Merge por campo, nunca por seção
- Chave desconhecida ou tipo errado sai com código 2
- Token literal no arquivo é rejeitado no carregamento

## Done when

- Teste cobre precedência flag > workspace > global > default
- Teste cobre chave desconhecida e tipo inválido
- Teste cobre variável de ambiente ausente
