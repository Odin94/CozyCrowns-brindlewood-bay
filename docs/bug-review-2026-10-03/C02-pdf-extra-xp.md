# C02 — PDF exports mark one extra XP box

Severity: **Medium**. Confirmed by generating a PDF with the running frontend and reading its actual AcroForm at `0cb664b`.

Revalidated on committed revision `7b88cb2` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Export a default Maven with `xp: 0`. Its PDF XP fields are `[true, false, false, false, false]`. The browser correctly displays zero XP. Values 1–4 likewise mark one extra box.

## Cause

`frontend/src/lib/pdf_generator.ts` loops from index 0 and checks `character.xp >= i` rather than comparing XP with the one-based count.

## Suggested fix

Use `character.xp > i` (or `>= i + 1`) and test all values 0–5 against the generated PDF checkbox fields.
