# C03 — Unicode accepted by the sheet can prevent PDF export

Severity: **Medium**. Confirmed by calling the actual browser PDF generator at `0cb664b`.

## Reproduction and evidence

Export a Maven named `Maven 🧶` or `李华`. The generator throws `WinAnsi cannot encode` and produces no PDF. A Latin-1 control, `Élodie`, succeeds. The problem applies to every free-text field, not just the name.

## Cause

`frontend/src/lib/pdf_generator.ts` sets text on PDF form fields and saves using their standard WinAnsi font appearances. It never embeds a font that supports the Unicode text the application permits.

## Suggested fix

Embed suitable Unicode fonts through the already-installed fontkit support and regenerate form appearances with them. Provide an explicit policy for unsupported emoji glyphs, such as replacing only those glyphs and informing the user, while preserving the rest of the export.

Regression: CJK, combining marks, Latin extended text, and unsupported emoji across name, moves, and cozy items; an unsupported glyph should not discard the entire PDF.
