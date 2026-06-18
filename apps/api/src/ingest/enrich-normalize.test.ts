import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeWork, extractAuthorships } from "./enrich-normalize.js";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/works.A5026031023.json", import.meta.url)), "utf8"),
);
const work = data.results[0];

test("normalizeWork maps a work to a publication with bare ids", () => {
  const p = normalizeWork(work)!;
  assert.ok(p, "publication produced");
  assert.ok(p.title.length > 0);
  assert.ok(p.openalexId && /^W\d+$/.test(p.openalexId), "bare openalex id");
  if (p.doi) assert.ok(!p.doi.startsWith("http"), "doi is bare (no url prefix)");
  assert.ok(p.sourceUrl.startsWith("https://openalex.org/"));
});

test("normalizeWork returns null when there is no title", () => {
  assert.equal(normalizeWork({ id: "https://openalex.org/W1", title: null }), null);
});

test("extractAuthorships yields 1-based positions and resolution keys, incl. Awandare", () => {
  const auths = extractAuthorships(work);
  assert.ok(auths.length >= 1);
  assert.equal(auths[0].position, 1);
  const awandare = auths.find((a) => a.orcid === "0000-0002-8793-3641");
  assert.ok(awandare, "Awandare authorship present with bare orcid");
  assert.ok(awandare!.openalexAuthorId && /^A\d+$/.test(awandare!.openalexAuthorId), "bare author id");
});
