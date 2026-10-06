import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const directory = resolve(process.argv[2] ?? "dist");
const html = readFileSync(join(directory, "index.html"), "utf8");
const entryFile = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
if (!entryFile) throw new Error("No production module entry found");
const entry = readFileSync(join(directory, entryFile.replace(/^\//, "")));
const chunks = readdirSync(join(directory, "assets"))
  .filter((file) => file.endsWith(".js"))
  .map((file) => {
    const contents = readFileSync(join(directory, "assets", file));
    return { file, bytes: contents.length, gzipBytes: gzipSync(contents).length };
  });
console.log(
  JSON.stringify(
    {
      directory,
      entry: { file: entryFile, bytes: entry.length, gzipBytes: gzipSync(entry).length },
      chunks,
    },
    null,
    2,
  ),
);
