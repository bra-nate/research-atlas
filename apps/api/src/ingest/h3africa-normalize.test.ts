import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseH3Africa } from "./h3africa-normalize.js";

const json = readFileSync(
  fileURLToPath(new URL("./__fixtures__/h3africa.reporter.json", import.meta.url)),
  "utf8",
);

test("parseH3Africa dedupes award-years into unique core projects under H3Africa", () => {
  const projects = parseH3Africa(json);
  // 251 award-years in the fixture collapse to 18 distinct H3Africa core awards.
  assert.equal(projects.length, 18);
  for (const p of projects) {
    assert.equal(p.programName, "Human Heredity and Health in Africa");
    assert.ok(p.title.length > 0);
    assert.ok(p.leadOrg, "every award has a lead org");
    assert.ok(p.sourceUrl.startsWith("https://reporter.nih.gov/"));
  }
});

test("parseH3Africa extracts the AWI-Gen flagship with its PI", () => {
  const projects = parseH3Africa(json);
  const awigen = projects.find((p) => /awi-gen/i.test(p.title));
  assert.ok(awigen, "AWI-Gen present");
  assert.ok(awigen!.pi, "has a contact PI");
  assert.match(awigen!.pi!.fullName, /ramsay/i);
});

test("parseH3Africa emits a NIH grant per award keyed by core project number", () => {
  const projects = parseH3Africa(json);
  const withGrant = projects.find((p) => p.grant);
  assert.ok(withGrant, "at least one award carries a grant");
  assert.ok(withGrant!.grant!.awardNumber, "grant keyed by core project number");
  assert.equal(withGrant!.grant!.funder.name, "National Institutes of Health (NIH)");
  assert.equal(withGrant!.grant!.funder.orgType, "funder");
});

test("parseH3Africa title-cases cross-source anchor orgs (matches DELTAS/DS-I casing)", () => {
  const projects = parseH3Africa(json);
  // University of Cape Town and University of Ghana also appear via DELTAS/DS-I
  // Africa — title-casing (not RePORTER's ALL CAPS) lets lower()-keyed resolution
  // unify them into one org node, powering cross-programme navigation.
  const uct = projects.find((p) => /university of cape town/i.test(p.leadOrg?.name ?? ""));
  assert.ok(uct, "University of Cape Town is an H3Africa lead org");
  assert.equal(uct!.leadOrg!.name, "University Of Cape Town");
});
