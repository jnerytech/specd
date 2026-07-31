---
change: 2026-07-30-propose-mark
status: active
---

# propose-mark — dar referente ao recorte da segunda janela

## Por quê

REQ-SKL-008 institui a revisão de enunciado no archive com recorte estreito: o
que mudou desde o propose. O referente não existe. Nenhuma change desta sequência
commitou o delta antes de implementar, a skill de propose não manda commitar, e o
archive não grava marco — a única fonte para datar seria a memória de quem estava
na sessão, que é o que a revisão existe para não aceitar.

Enquanto for assim, a segunda janela opera por precaução e revisa tudo. Isso é
mais caro do que o desenho previa, e o desenho recusou explicitamente revisão
cara nessa posição: revisão cara é revisão que alguém pula, e revisão pulada é
pior que ausente porque parece existir.

Foi medido, não suposto: na change dos enunciados fracos o recorte foi declarado
vazio por dedução e o histórico contradisse — `delta.md` tinha um commit só, com
o trabalho do apply dentro dele.
