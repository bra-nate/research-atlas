import { test } from "node:test";
import assert from "node:assert/strict";
import { pickBestAuthor } from "./openalex-resolve.js";

const c = (id: string, worksCount: number, institutionNames: string[]) => ({ id, worksCount, institutionNames });

test("pickBestAuthor chooses the institution-corroborated candidate", () => {
  const m = pickBestAuthor(
    [c("A1", 400, ["University of Cape Town"]), c("A2", 9, ["MIT"])],
    "University of Cape Town",
  );
  assert.deepEqual(m, { openalexAuthorId: "A1", confidence: 0.6 });
});

test("pickBestAuthor prefers higher works_count among institution matches", () => {
  const m = pickBestAuthor(
    [c("A1", 9, ["University of Cape Town"]), c("A2", 426, ["University of Cape Town"])],
    "university of cape town",
  );
  assert.equal(m!.openalexAuthorId, "A2");
});

test("pickBestAuthor returns null when no candidate matches the org", () => {
  assert.equal(pickBestAuthor([c("A1", 400, ["MIT"])], "University of Cape Town"), null);
});

test("pickBestAuthor returns null when org is unknown (cannot corroborate)", () => {
  assert.equal(pickBestAuthor([c("A1", 400, ["MIT"])], null), null);
});
