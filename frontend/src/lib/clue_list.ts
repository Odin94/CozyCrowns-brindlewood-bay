const BULLET = /^(?:[•∙◦·*]|-)\s+(.*)$|^\d+[.)]\s+(.*)$/;

const finishClue = (clue: string) => clue.replace(/\s+/g, " ").trim();

/** Converts copied adventure-book bullet lists into one clue per bullet. */
export const parsePastedClueList = (source: string): string[] => {
  const lines = source.normalize("NFKC").replace(/\r/g, "").split("\n");
  const hasBullets = lines.some((line) => BULLET.test(line.trim()));
  const clues: string[] = [];
  let current = "";

  const commit = () => {
    const clue = finishClue(current);
    if (clue) clues.push(clue);
    current = "";
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(BULLET);
    if (bullet) {
      commit();
      current = bullet[1] ?? bullet[2] ?? "";
      continue;
    }
    if (!line || line === '"""') continue;
    if (!current) {
      if (!hasBullets) current = line;
      continue;
    }
    current = current.endsWith("-") ? `${current.slice(0, -1)}${line}` : `${current} ${line}`;
  }
  commit();
  return clues;
};
