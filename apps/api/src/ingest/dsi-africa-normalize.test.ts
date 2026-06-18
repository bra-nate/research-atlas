import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDsiAfrica } from "./dsi-africa-normalize.js";

const json = readFileSync(
  fileURLToPath(new URL("./__fixtures__/dsi-africa.reporter.json", import.meta.url)),
  "utf8",
);

test("parseDsiAfrica dedupes award-years into unique core projects under DS-I Africa", () => {
  const projects = parseDsiAfrica(json);
  // 77 award-years in the fixture collapse to 12 distinct DS-I Africa awards.
  assert.equal(projects.length, 12);
  for (const p of projects) {
    assert.equal(p.programName, "DS-I Africa");
    assert.ok(p.title.length > 0);
    assert.ok(p.leadOrg, "every award has a lead org");
    assert.ok(p.sourceUrl.startsWith("https://reporter.nih.gov/"));
  }
});

test("parseDsiAfrica extracts the eLwazi platform with PI and University of Cape Town", () => {
  const projects = parseDsiAfrica(json);
  const elwazi = projects.find((p) => /elwazi/i.test(p.title));
  assert.ok(elwazi, "eLwazi ODSP present");
  assert.ok(elwazi!.pi, "has a contact PI");
  assert.match(elwazi!.pi!.fullName, /mulder/i);
  assert.match(elwazi!.leadOrg!.name, /university of cape town/i);
});

test("parseDsiAfrica title-cases the cross-source anchor org (matches DELTAS casing)", () => {
  const projects = parseDsiAfrica(json);
  const uctAwards = projects.filter((p) => /university of cape town/i.test(p.leadOrg?.name ?? ""));
  assert.ok(uctAwards.length >= 1, "University of Cape Town is a DS-I lead org");
  // Title-cased, not RePORTER's ALL CAPS — so lower()-keyed resolution unifies
  // it with the DELTAS-sourced "University of Cape Town".
  assert.equal(uctAwards[0].leadOrg!.name, "University Of Cape Town");
});
