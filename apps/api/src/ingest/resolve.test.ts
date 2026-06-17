import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPersonMatch } from "./resolve.js";

const cand = (over = {}) => ({
  id: "p1",
  orcid: null,
  openalexAuthorId: null,
  normalisedName: "gordon awandare",
  primaryOrgId: "org-ug",
  ...over,
});

test("ORCID match wins with confidence 1.0", () => {
  const m = pickPersonMatch(
    { orcid: "0000-0002-8793-3641", openalexAuthorId: null, normalisedName: "g awandare", orgId: null },
    [cand({ orcid: "0000-0002-8793-3641" })],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 1.0 });
});

test("OpenAlex author id match has confidence 0.95", () => {
  const m = pickPersonMatch(
    { orcid: null, openalexAuthorId: "A5023888391", normalisedName: "x", orgId: null },
    [cand({ openalexAuthorId: "A5023888391" })],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 0.95 });
});

test("name + shared org matches at confidence 0.7", () => {
  const m = pickPersonMatch(
    { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: "org-ug" },
    [cand()],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 0.7 });
});

test("name-only (no org agreement) is rejected", () => {
  assert.equal(
    pickPersonMatch(
      { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: null },
      [cand()],
    ),
    null,
  );
  assert.equal(
    pickPersonMatch(
      { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: "org-other" },
      [cand()],
    ),
    null,
  );
});
