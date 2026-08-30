import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const statementBreakpoint = "--> statement-breakpoint";
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

function hasSqlStatement(statement: string) {
  return statement
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim().length > 0;
}

/**
 * Drizzle sends each statement-breakpoint-delimited segment to SQLite as-is.
 * Reject empty segments here so migrations fail before opening a transaction.
 */
export function validateMigrations(directory = migrationsDirectory) {
  const migrationFiles = readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const emptyStatements: string[] = [];

  for (const file of migrationFiles) {
    const statements = readFileSync(join(directory, file), "utf8").split(
      statementBreakpoint,
    );

    for (const [index, statement] of statements.entries()) {
      if (!hasSqlStatement(statement)) {
        emptyStatements.push(`${file}, statement ${index + 1}`);
      }
    }
  }

  if (emptyStatements.length > 0) {
    throw new Error(
      `Migration files contain empty SQL statements: ${emptyStatements.join("; ")}`,
    );
  }
}
