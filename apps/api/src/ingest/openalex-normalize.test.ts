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

test("normalizeAuthor tolerates missing/empty optional fields", () => {
  const p = normalizeAuthor({
    id: "https://openalex.org/A999",
    orcid: null,
    display_name: "No Metadata Author",
  });
  assert.equal(p.orcid, null);
  assert.equal(p.openalexAuthorId, "A999");
  assert.equal(p.worksCount, null);
  assert.equal(p.lastActiveYear, null); // no counts_by_year
  assert.deepEqual(p.specializations, []); // no x_concepts
  assert.equal(p.primaryOrgRor, null); // no last_known_institutions
  assert.equal(p.sourceUrl, "https://openalex.org/A999");
});

import { normalizeInstitution } from "./openalex-normalize.js";

test("normalizeInstitution maps an institution to a university org", () => {
  const org = normalizeInstitution({
    id: "https://openalex.org/I154526488",
    ror: "https://ror.org/01rxfrp27",
    display_name: "University of Ghana",
    country_code: "GH",
    homepage_url: "https://www.ug.edu.gh",
  });
  assert.equal(org.name, "University of Ghana");
  assert.equal(org.orgType, "university");
  assert.equal(org.rorId, "01rxfrp27");
  assert.equal(org.country, "GH");
  assert.equal(org.website, "https://www.ug.edu.gh");
  assert.equal(org.sourceUrl, "https://openalex.org/I154526488");
});
