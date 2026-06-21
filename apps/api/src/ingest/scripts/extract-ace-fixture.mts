/**
 * One-off extractor: parses the old ACE Connect Postgres seed
 * (/Users/Nate/Desktop/Nathan/ACE/supabase/seed.sql) into the committed fixture
 * apps/api/src/ingest/__fixtures__/ace.factsheets.json that the `ace` adapter reads.
 *
 * The old project has no JSON/CSV export — its data lives only as `insert into`
 * statements. This parser is deliberately narrow: it understands exactly the two
 * machine-generated statement shapes in that file (ace_centres + experts), handles
 * '' escaping and both `array[...]` and '{...}' array literals, and nothing more.
 *
 * Run once with: pnpm --filter @research-atlas/api exec tsx \
 *   src/ingest/scripts/extract-ace-fixture.mts [path-to-seed.sql]
 * It is committed for reproducibility; normal ingestion reads the fixture, not the DB.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEED_PATH = process.argv[2] ?? "/Users/Nate/Desktop/Nathan/ACE/supabase/seed.sql";

/** Split a `values` body into top-level `( ... )` tuples, respecting quotes/nesting. */
function splitTuples(body: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") i++; // doubled '' escape — skip the pair
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === "(") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0 && start >= 0) tuples.push(body.slice(start, i));
    }
  }
  return tuples;
}

/** Split one tuple's body into top-level comma-separated raw fields. */
function splitFields(tuple: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = "";
  for (let i = 0; i < tuple.length; i++) {
    const ch = tuple[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (tuple[i + 1] === "'") {
          cur += tuple[++i];
        } else inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      fields.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) fields.push(cur.trim());
  return fields;
}

const unquote = (s: string): string => s.slice(1, -1).replace(/''/g, "'");

/** Parse a scalar text field: 'str' → string, null → null. */
function asText(raw: string): string | null {
  if (raw.toLowerCase() === "null") return null;
  if (raw.startsWith("'")) return unquote(raw);
  return raw;
}

/** Parse a text[] field expressed as `array['a','b']` or `'{"a","b"}'`. */
function asArray(raw: string): string[] {
  if (raw.toLowerCase() === "null") return [];
  // Strip a `::type[]` cast suffix if present.
  const body = raw.replace(/::[a-z_]+\[\]$/i, "").trim();
  if (body.toLowerCase().startsWith("array[")) {
    const inner = body.slice("array[".length, body.lastIndexOf("]"));
    return splitFields(inner).map((f) => (f.startsWith("'") ? unquote(f) : f)).filter(Boolean);
  }
  if (body.startsWith("'")) {
    // Postgres array literal: '{"a","b"}' (or '{a,b}')
    const lit = unquote(body).replace(/^\{/, "").replace(/\}$/, "");
    if (!lit) return [];
    return lit
      .split(/","|,/)
      .map((s) => s.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

/** Pull the column list and `values` body out of one insert statement. */
function parseInsert(stmt: string): { cols: string[]; tuples: string[] } {
  const open = stmt.indexOf("(");
  const valuesIdx = stmt.toLowerCase().indexOf("values", open);
  const colsBlock = stmt.slice(open + 1, stmt.indexOf(")", open));
  const cols = colsBlock.split(",").map((c) => c.trim());
  const body = stmt.slice(valuesIdx + "values".length);
  return { cols, tuples: splitTuples(body) };
}

/** Extract all `insert into public.<table>` statements (each ends at `;`). */
function statementsFor(sql: string, table: string): string[] {
  const out: string[] = [];
  const needle = `insert into public.${table}`;
  let idx = sql.indexOf(needle);
  while (idx !== -1) {
    // Find the terminating `;` that is outside any string literal.
    let inStr = false;
    let end = -1;
    for (let i = idx; i < sql.length; i++) {
      const ch = sql[i];
      if (inStr) {
        if (ch === "'") {
          if (sql[i + 1] === "'") i++;
          else inStr = false;
        }
      } else if (ch === "'") inStr = true;
      else if (ch === ";") {
        end = i;
        break;
      }
    }
    if (end === -1) break;
    out.push(sql.slice(idx, end));
    idx = sql.indexOf(needle, end);
  }
  return out;
}

const valueOf = (cols: string[], fields: string[], col: string): string =>
  fields[cols.indexOf(col)] ?? "null";

interface ExpertOut {
  full_name: string;
  title: string | null;
  specializations: string[];
}
interface CentreOut {
  name: string;
  short_name: string;
  host_university: string | null;
  country: string | null;
  ace_phase: string | null;
  website: string | null;
  thematic_areas: string[];
  experts: ExpertOut[];
}

const sql = readFileSync(SEED_PATH, "utf8");

const centres = new Map<string, CentreOut>();
for (const stmt of statementsFor(sql, "ace_centres")) {
  const { cols, tuples } = parseInsert(stmt);
  for (const t of tuples) {
    const f = splitFields(t);
    const shortName = asText(valueOf(cols, f, "short_name")) ?? "";
    centres.set(shortName, {
      name: asText(valueOf(cols, f, "name")) ?? "",
      short_name: shortName,
      host_university: asText(valueOf(cols, f, "host_university")),
      country: asText(valueOf(cols, f, "country")),
      ace_phase: asText(valueOf(cols, f, "ace_phase")),
      website: asText(valueOf(cols, f, "website")),
      thematic_areas: asArray(valueOf(cols, f, "thematic_areas")),
      experts: [],
    });
  }
}

let expertCount = 0;
const orphans: string[] = [];
for (const stmt of statementsFor(sql, "experts")) {
  const { cols, tuples } = parseInsert(stmt);
  for (const t of tuples) {
    const f = splitFields(t);
    // centre_id is `(select id from public.ace_centres where short_name = 'X')`
    const centreRaw = valueOf(cols, f, "centre_id");
    const m = centreRaw.match(/short_name\s*=\s*'((?:[^']|'')*)'/i);
    const shortName = m ? m[1].replace(/''/g, "'") : "";
    const centre = centres.get(shortName);
    if (!centre) {
      orphans.push(shortName);
      continue;
    }
    centre.experts.push({
      full_name: asText(valueOf(cols, f, "full_name")) ?? "",
      title: asText(valueOf(cols, f, "title")),
      specializations: asArray(valueOf(cols, f, "specializations")),
    });
    expertCount++;
  }
}

const fixture = { centres: [...centres.values()] };
const outPath = fileURLToPath(new URL("../__fixtures__/ace.factsheets.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(fixture, null, 2) + "\n");

const withSpecs = [...centres.values()].reduce(
  (n, c) => n + c.experts.filter((e) => e.specializations.length > 0).length,
  0,
);
console.log(`[extract-ace] centres=${centres.size} experts=${expertCount} (with specializations=${withSpecs})`);
if (orphans.length) console.log(`[extract-ace] WARNING orphan short_names: ${[...new Set(orphans)].join(", ")}`);
console.log(`[extract-ace] wrote ${outPath}`);
