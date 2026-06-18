import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDeltas } from "./deltas-normalize.js";

const json = readFileSync(
  fileURLToPath(new URL("./__fixtures__/deltas.consortia.json", import.meta.url)),
  "utf8",
);

test("parseDeltas yields the DELTAS Africa consortia with lead org and director", () => {
  const projects = parseDeltas(json);
  assert.equal(projects.length, 11);
  for (const p of projects) {
    assert.equal(p.programName, "DELTAS Africa");
    assert.ok(p.title.length > 0);
    assert.ok(p.leadOrg, "every consortium has a lead org");
    assert.ok(p.pi, "every consortium has a director");
    assert.ok(p.sourceUrl.startsWith("http"));
  }
});

test("parseDeltas carries the hero WACCBIP consortium with Awandare's ORCID", () => {
  const projects = parseDeltas(json);
  const waccbip = projects.find((p) => /cell biology of infectious pathogens/i.test(p.title));
  assert.ok(waccbip, "WACCBIP-DELTAS present");
  assert.match(waccbip!.pi!.fullName, /awandare/i);
  assert.equal(waccbip!.pi!.orcid, "0000-0002-8793-3641");
  assert.equal(waccbip!.leadOrg!.name, "University of Ghana");
});

test("parseDeltas includes University of KwaZulu-Natal (cross-source anchor with DS-I)", () => {
  const projects = parseDeltas(json);
  const ukzn = projects.find((p) => /kwazulu-natal/i.test(p.leadOrg?.name ?? ""));
  assert.ok(ukzn, "UKZN is a DELTAS lead org (SANTHE)");
  assert.equal(ukzn!.leadOrg!.name, "University of KwaZulu-Natal");
});
