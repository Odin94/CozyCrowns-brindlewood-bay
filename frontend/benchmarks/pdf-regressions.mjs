/* eslint-disable no-await-in-loop -- Each export is measured independently to reveal actual PDF rendering latency. */
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { PDFDocument } from "pdf-lib";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const cacheDir = mkdtempSync(join(tmpdir(), "cozy-pdf-tests-"));
const server = await createServer({
  cacheDir,
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { i18n } = await import("@lingui/core");
  i18n.load("en", {});
  i18n.activate("en");
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(readFileSync(resolve("src/resources/NotoSansSC-Regular.ttf")));
  const { generatePdf } = await server.ssrLoadModule("/src/lib/pdf_generator.ts");
  const { createDefaultCharacter } = await server.ssrLoadModule("/src/lib/character_document.ts");
  for (const name of ["Maven", "李华", "Maven 🧶"]) {
    const start = performance.now();
    const bytes = await generatePdf({ ...createDefaultCharacter(), name });
    console.log(name, bytes.length, Math.round(performance.now() - start));
    if (name === "李华") {
      const pdfPath = join(cacheDir, "unicode.pdf"),
        imagePath = join(cacheDir, "unicode");
      writeFileSync(pdfPath, bytes);
      const render = spawnSync(
        "pdftoppm",
        [
          "-f",
          "1",
          "-singlefile",
          "-r",
          "250",
          "-x",
          "650",
          "-y",
          "440",
          "-W",
          "320",
          "-H",
          "100",
          "-gray",
          pdfPath,
          imagePath,
        ],
        { encoding: "utf8" },
      );
      if (render.error?.code !== "ENOENT") {
        assert.equal(render.status, 0, render.stderr);
        assert.equal(render.stderr, "", "PDF font must render without embedded-font warnings");
        const pgm = readFileSync(`${imagePath}.pgm`);
        const pixels = pgm.subarray(pgm.indexOf(Buffer.from("255\n")) + 4);
        let secondGlyphInk = 0;
        for (let y = 28; y < 44; y++)
          for (let x = 65; x < 96; x++) if (pixels[y * 320 + x] < 128) secondGlyphInk++;
        assert.ok(
          secondGlyphInk > 40,
          "The second CJK glyph must be visible; form text alone misses invalid subsets",
        );
      }
    }
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getForm().getTextField("Name").getText(), name);
  }
  for (let xp = 0; xp <= 5; xp++) {
    const bytes = await generatePdf({ ...createDefaultCharacter(), xp });
    const document = await PDFDocument.load(bytes);
    assert.equal(
      Array.from({ length: 5 }, (_, index) =>
        document.getForm().getCheckBox(`XP.${index}`).isChecked(),
      ).filter(Boolean).length,
      xp,
    );
  }
  globalThis.fetch = nativeFetch;
} finally {
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
