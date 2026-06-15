import type { Adapter } from "./types.js";

// Registry maps CLI name → module path. Adapters are dynamically imported
// only after we confirm a valid name, so env/DB validation does not run
// when the user passes an unknown name (or no name).
const ADAPTER_MODULES: Record<string, () => Promise<{ [key: string]: Adapter }>> = {
  openalex: () => import("./openalex.js") as Promise<{ openalexAdapter: Adapter }>,
  "seed-consortia": () => import("./seed-consortia.js") as Promise<{ seedConsortiaAdapter: Adapter }>,
};

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name || !(name in ADAPTER_MODULES)) {
    console.error(`Usage: pnpm ingest <${Object.keys(ADAPTER_MODULES).join("|")}>`);
    process.exit(1);
  }

  const mod = await ADAPTER_MODULES[name]();
  // Each module exports exactly one Adapter; find it regardless of export name.
  const adapter = Object.values(mod).find(
    (v): v is Adapter => v !== null && typeof v === "object" && "name" in v && "run" in v,
  );
  if (!adapter) {
    console.error(`[ingest] module for "${name}" did not export an Adapter`);
    process.exit(1);
  }

  console.log(`[ingest] running "${adapter.name}"…`);
  const summary = await adapter.run();
  console.log(`[ingest] upserts: ${JSON.stringify(summary.upserts)}`);
  if (summary.skipped.length)
    console.log(`[ingest] skipped/capped:\n  ${summary.skipped.join("\n  ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
