import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { loadTranslations } from "@/lib/utils";
import "@/index.css";

await loadTranslations("en");
i18n.activate("en");
const { useCharacterStore } = await import("@/lib/character_store");
const sections = {
  Name: (await import("@/components/character/Name")).default,
  Style: (await import("@/components/character/Style")).default,
  CozyActivity: (await import("@/components/character/CozyActivity")).default,
  Abilities: (await import("@/components/character/Abilities")).default,
  XpTrack: (await import("@/components/character/XpTrack")).default,
  Conditions: (await import("@/components/character/Conditions")).default,
  EndOfSession: (await import("@/components/character/EndOfSession")).default,
  Advancements: (await import("@/components/character/Advancements")).default,
  MavenMoves: (await import("@/components/character/MavenMoves")).default,
  CrownOfTheQueen: (await import("@/components/character/CrownOfTheQueen")).default,
  CrownOfTheVoid: (await import("@/components/character/CrownOfTheVoid")).default,
  CozyLittlePlace: (await import("@/components/character/CozyLittlePlace")).default,
};
let commits: Record<string, number> = {};
let durations: number[] = [];
flushSync(() =>
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>
        {Object.entries(sections).map(([id, Component]) => (
          <Profiler
            key={id}
            id={id}
            onRender={(section, phase, duration) => {
              if (phase !== "mount") {
                commits[section] = (commits[section] ?? 0) + 1;
                durations.push(duration);
              }
            }}
          >
            <Component />
          </Profiler>
        ))}
      </I18nProvider>
    </QueryClientProvider>,
  ),
);

const run = () => {
  commits = {};
  durations = [];
  const start = performance.now();
  for (let index = 0; index < 100; index++)
    flushSync(() => useCharacterStore.getState().setName(`Mavis benchmark ${index}`));
  return {
    edits: 100,
    elapsedMs: performance.now() - start,
    sectionCommits: commits,
    totalSectionCommits: Object.values(commits).reduce((sum, count) => sum + count, 0),
    reactActualDurationMs: durations.reduce((sum, duration) => sum + duration, 0),
  };
};
Object.assign(window, { runCharacterRenderingBenchmark: run });
const button = document.createElement("button");
button.textContent = "Run 100 name edits";
button.addEventListener("click", () => {
  const result = run();
  const output = document.createElement("pre");
  output.id = "benchmark-result";
  output.textContent = JSON.stringify(result, null, 2);
  document.getElementById("benchmark-result")?.remove();
  document.body.append(output);
});
document.body.prepend(button);
