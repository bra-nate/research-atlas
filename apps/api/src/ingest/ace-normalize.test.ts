import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAce } from "./ace-normalize.js";

const json = readFileSync(
  fileURLToPath(new URL("./__fixtures__/ace.factsheets.json", import.meta.url)),
  "utf8",
);

test("parseAce maps every ACE centre to a project under the seeded ACE programme", () => {
  const projects = parseAce(json);
  assert.equal(projects.length, 41);
  for (const p of projects) {
    assert.equal(p.programName, "Africa Centres of Excellence");
    assert.ok(p.title.length > 0);
    assert.equal(p.pi, null, "no PI is asserted from the factsheets");
    assert.equal(p.grant, null, "no grant figures exist in the source");
    assert.ok(p.sourceUrl.length > 0);
  }
});

test("parseAce attaches the World Bank as funder and AAU as partner on every project", () => {
  const projects = parseAce(json);
  for (const p of projects) {
    const funder = p.partners.find((pt) => pt.role === "funder");
    assert.ok(funder, `${p.title} has a funder`);
    assert.equal(funder!.org.name, "World Bank Group");
    assert.equal(funder!.org.orgType, "funder");
    const aau = p.partners.find((pt) => pt.org.shortName === "AAU");
    assert.ok(aau, `${p.title} has the AAU partner`);
    assert.equal(aau!.role, "partner");
  }
});

test("parseAce sets the host university as the lead org", () => {
  const projects = parseAce(json);
  const cda = projects.find((p) => p.title === "Centre for Dryland Agriculture");
  assert.ok(cda, "CDA present");
  assert.equal(cda!.country, "Nigeria");
  assert.ok(cda!.leadOrg, "CDA has a lead org");
  assert.equal(cda!.leadOrg!.name, "Bayero University, Kano");
  assert.equal(cda!.leadOrg!.orgType, "university");
  const lead = cda!.partners.find((pt) => pt.role === "lead");
  assert.equal(lead!.org.name, "Bayero University, Kano");
});

test("parseAce brings faculty in as investigator members with their specializations", () => {
  const projects = parseAce(json);
  const cda = projects.find((p) => p.title === "Centre for Dryland Agriculture")!;
  assert.equal(cda.members.length, 10);
  for (const m of cda.members) assert.equal(m.role, "investigator");
  const sanusi = cda.members.find((m) => m.person.fullName === "Sanusi Gaya Mohammed");
  assert.ok(sanusi, "named faculty present");
  assert.deepEqual(sanusi!.person.specializations, ["plant breeding"]);
  // primary org is carried so name+org resolution can fire on re-runs / enrichment.
  assert.equal(sanusi!.person.primaryOrgName, "Bayero University, Kano");
  assert.equal(sanusi!.person.orcid, null);
});

test("parseAce preserves blank specializations as [] (never fabricated)", () => {
  const projects = parseAce(json);
  const blank = projects
    .flatMap((p) => p.members)
    .find((m) => m.person.specializations.length === 0);
  assert.ok(blank, "at least one faculty has no source specialization");
  assert.deepEqual(blank!.person.specializations, []);
});

test("parseAce handles escaped quotes / accents from the source verbatim", () => {
  const projects = parseAce(json);
  const ci = projects.find((p) => p.country === "Côte d'Ivoire");
  assert.ok(ci, "a Côte d'Ivoire centre survives apostrophe handling");
});
