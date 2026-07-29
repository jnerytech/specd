---
id: "005-validation-command-operational"
change: 2026-07-fatia-7
req: [REQ-VER-013]
status: pending
evidence:
  commits: []
---

## Objetivo

Executável ausente é ferramenta quebrada, não spec errada.

## Escopo

`src/verify/layers/project.ts` passa a classificar a falha do spawn: não conseguiu executar é operacional, executou e retornou não-zero é veredito. O relatório distingue camada reprovada de camada que não pôde rodar.

## Restrições

- `ENOENT` e afins saem 2; código de saída não-zero do comando continua saindo 1
- A mensagem lista as três saídas: instalar, trocar `validation_command`, tirar `project` de `levels`
- Nenhuma outra camada muda de código de saída
- Camada que não pôde rodar nunca é verde — P8
