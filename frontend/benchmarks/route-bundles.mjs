import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
const dir = resolve(process.argv[2] ?? "dist");
const manifest = JSON.parse(readFileSync(resolve(dir, ".vite/manifest.json"), "utf8"));
const routes = {
  "/": "CharacterSheet",
  "/dark-conspiracy": "CharacterSheet",
  "/sign-in": "SignInPage",
  "/auth/callback": "AuthCallback",
  "/mysteries": "MysteriesPage",
  "/library": "LibraryPage",
  "/book-clubs (list,overview,6panels)": "BookClubOverview",
  "/book-clubs/:id/mavens/:id (readonly)": "BookClubMaven",
  "/book-clubs/:id/mavens/:id (own)": ["BookClubMaven", "CharacterSheet"],
  "/book-clubs/:id/mysteries/:id/theorize": "TheorizeBoard",
};
const find = (name) =>
  Object.keys(manifest).find((key) => key.includes(name) && key.endsWith(".tsx")) ??
  Object.keys(manifest).find((key) => key.includes(name) && key.startsWith("_"));
const rows = Object.entries(routes).map(([route, names]) => {
  const closure = new Set();
  const visit = (key) => {
    if (!key) throw new Error(`Missing chunk for ${route}`);
    if (closure.has(key)) return;
    closure.add(key);
    for (const imp of manifest[key].imports ?? []) visit(imp);
  };
  visit("index.html");
  visit("src/App.tsx");
  visit("src/locales/en/messages.ts");
  for (const name of Array.isArray(names) ? names : [names]) visit(find(name));
  const files = Array.from(closure, (key) => manifest[key].file)
    .filter((file) => file.endsWith(".js"))
    .toSorted();
  return {
    route,
    bytes: files.reduce((s, f) => s + statSync(resolve(dir, f)).size, 0),
    gzipBytes: files.reduce((s, f) => s + gzipSync(readFileSync(resolve(dir, f))).byteLength, 0),
    files,
  };
});
console.log(
  JSON.stringify(
    {
      method:
        "Vite manifest static import closure: entry+App+en locale+route; excludes conditional SDK/PDF and previous-route cache; decoded/minified JS bytes",
      rows,
    },
    null,
    2,
  ),
);
