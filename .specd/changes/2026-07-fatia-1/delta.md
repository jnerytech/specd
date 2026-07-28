---
change: 2026-07-fatia-1
target: [cli, spec-format, ears, anchors, verify, explore, config]
---

## ADDED

Toda a Fatia 1 é greenfield. Os requisitos abaixo entram como novos nas capabilities indicadas.

### cli
- REQ-CLI-001 — Single gate
- REQ-CLI-002 — No LLM in the decision path
- REQ-CLI-003 — Never guess on conflict
- REQ-CLI-004 — Exit code contract
- REQ-CLI-005 — Offline gate
- REQ-CLI-006 — Zero-install distribution

### spec-format
- REQ-FMT-001 — Capability file layout
- REQ-FMT-002 — Requirement identifier format
- REQ-FMT-003 — Requirements carry no status
- REQ-FMT-004 — Retired identifiers are never reused
- REQ-FMT-005 — Delta declares three sections
- REQ-FMT-006 — MODIFIED carries full text
- REQ-FMT-007 — Task frontmatter schema
- REQ-FMT-008 — Anchors live on requirements

### ears
- REQ-EARS-001 — Five accepted patterns
- REQ-EARS-002 — Keywords are syntax, not prose
- REQ-EARS-003 — Single behaviour per requirement
- REQ-EARS-004 — Missing SHALL is rejected
- REQ-EARS-005 — Pattern is reported

### anchors
- REQ-ANC-001 — Anchor shape
- REQ-ANC-002 — Deterministic resolution ladder
- REQ-ANC-003 — Repository-wide fallback search
- REQ-ANC-004 — Strategy selected by file extension
- REQ-ANC-005 — Grep is the only v1 strategy
- REQ-ANC-006 — Graduated policy

### verify
- REQ-VER-001 — Ordered layer execution
- REQ-VER-002 — Layers are individually disableable
- REQ-VER-003 — Provenance layer
- REQ-VER-006 — Project layer delegates by argv
- REQ-VER-007 — Fast mode
- REQ-VER-008 — Machine-readable report

### explore
- REQ-EXP-001 — Card identifier or URL
- REQ-EXP-002 — Four source types
- REQ-EXP-003 — Required sources gate the bundle
- REQ-EXP-004 — Manifest records per-source status
- REQ-EXP-005 — Redaction before persistence
- REQ-EXP-006 — Bundle is versioned
- REQ-EXP-007 — Draft is not validated

### config
- REQ-CFG-001 — Four-level precedence
- REQ-CFG-002 — Unknown keys are rejected
- REQ-CFG-003 — Credentials by environment reference
- REQ-CFG-004 — Init writes complete defaults
- REQ-CFG-005 — Init detects the stack
- REQ-CFG-006 — Status reports drift and pending work

## MODIFIED

Nenhum.

## REMOVED

Nenhum.
