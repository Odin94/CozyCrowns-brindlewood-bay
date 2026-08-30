import { validateMigrations } from "./migrationValidation.js";

validateMigrations();

if (process.argv.includes("--validate-only")) {
  console.log("Migration files are valid!");
} else {
  const [{ migrate }, { db }] = await Promise.all([
    import("drizzle-orm/better-sqlite3/migrator"),
    import("./index.js"),
  ]);
  migrate(db, { migrationsFolder: "./src/db/migrations" });

  console.log("Migration completed!");
}
