import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeAuthor } from "./openalex-normalize.js";

const author = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/author.json", import.meta.url)), "utf8"),
);

test("normalizeAuthor extracts bare ids, activity signal, and themes", () => {
  const p = normalizeAuthor(author);
  assert.equal(p.fullName, "Gordon A. Awandare");
  assert.equal(p.orcid, "0000-0002-8793-3641"); // bare, not the URL
  assert.equal(p.openalexAuthorId, "A5023888391"); // bare id
  assert.equal(p.worksCount, 142);
  assert.equal(p.lastActiveYear, 2024); // max year with works_count > 0
  assert.equal(p.primaryOrgRor, "01rxfrp27"); // bare ROR
  assert.deepEqual(p.specializations, ["Malaria", "Genomics", "Immunology"]); // top 3
  assert.equal(p.sourceUrl, "https://openalex.org/A5023888391");
});
