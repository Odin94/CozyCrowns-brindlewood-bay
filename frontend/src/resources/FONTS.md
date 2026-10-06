# PDF Unicode font

`NotoSansSC-Regular.ttf` is a static weight-400 instance of Google's SIL Open
Font License Noto Sans SC font. The license is in `NotoSansCJK-LICENSE.txt`.

Source: https://github.com/google/fonts/blob/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf

The static font was generated with fonttools `instantiateVariableFont(font,
{"wght": 400}, inplace=True)` and saved as TrueType. A static TrueType font is
required because the CFF OpenType subset produced invalid embedded fonts in
common PDF readers during validation. The font is loaded only when Helvetica
cannot encode the requested text, cached across exports, and embedded in full for compatibility with common PDF readers. Not every emoji has a glyph; export warns while preserving the original
Unicode text in the editable PDF form field.
