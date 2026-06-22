import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { MEMBER_ROLE_LABELS, type MemberRole } from "@research-atlas/types";
import {
  useOrganization,
  usePerson,
  usePersonProjects,
  usePersonPublications,
  usePrograms,
} from "../lib/hooks";
import type { PersonProject } from "../lib/api";
import { formatField } from "../lib/format";
import {
  Breadcrumbs,
  ClaimStub,
  EntityLink,
  IllustrativeBadge,
  PageStatus,
  ProvenanceLine,
  SectionCard,
  Tag,
  UpdatedLine,
} from "../components/ui";
import { ProfileHeader, RailBlock, TwoColumn } from "../components/profile-layout";

const roleLabel = (role: string | null) =>
  role ? (MEMBER_ROLE_LABELS[role as MemberRole] ?? role) : null;

/**
 * Person profile — the hero. Aggregates a person's project_members across ALL
 * programmes into a single Footprint, grouped by programme/funder, plus an
 * Outputs section. No source portal shows this cross-consortium span.
 */
export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const person = usePerson(id);
  const projects = usePersonProjects(id);
  const pubs = usePersonPublications(id);
  const org = useOrganization(person.data?.primary_org_id ?? undefined);
  const programs = usePrograms();

  const programById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    for (const p of programs.data ?? []) m.set(p.id, { name: p.name });
    return m;
  }, [programs.data]);

  // Group the footprint by programme, preserving "no programme" as a bucket.
  const grouped = useMemo(() => {
    const buckets = new Map<string, PersonProject[]>();
    for (const row of projects.data ?? []) {
      const key = row.project.program_id ?? "__none__";
      const arr = buckets.get(key) ?? [];
      arr.push(row);
      buckets.set(key, arr);
    }
    return [...buckets.entries()];
  }, [projects.data]);

  if (person.isLoading) return <PageStatus loading label="person" />;
  if (person.error)
    return (
      <PageStatus notFound={(person.error as { status?: number }).status === 404} error label="person" />
    );
  const p = person.data!;

  const programmeCount = new Set(
    (projects.data ?? [])
      .map((r) => r.project.program_id)
      .filter((x): x is string => !!x),
  ).size;
  const institutionCount = new Set(
    [
      p.primary_org_id,
      ...(projects.data ?? []).map((r) => r.project.lead_org_id),
    ].filter((x): x is string => !!x),
  ).size;
  const pubCount = pubs.data?.length ?? p.works_count ?? 0;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "People", to: "/directory?tab=people" },
          { label: p.full_name },
        ]}
      />

      <ProfileHeader
        name={p.full_name}
        monogramSrc={p.photo_url}
        badge={<IllustrativeBadge status={p.verification_status} />}
        descriptor={
          <>
            {[p.title, p.highest_qualification].filter(Boolean).join(" · ")}
            {org.data && (
              <>
                {(p.title || p.highest_qualification) && " · "}
                <EntityLink to={`/organizations/${org.data.id}`}>
                  {org.data.name}
                </EntityLink>
              </>
            )}
          </>
        }
        facts={[
          {
            label: "Active across",
            value: `${programmeCount} programme${programmeCount === 1 ? "" : "s"} · ${institutionCount} institution${institutionCount === 1 ? "" : "s"}`,
          },
          { label: "Publications", value: pubCount || "—" },
          {
            label: "Last active",
            value: p.last_active_year ?? null,
          },
          {
            label: "ORCID",
            value: p.orcid ? (
              <a
                href={`https://orcid.org/${p.orcid}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-brand hover:underline"
              >
                {p.orcid}
              </a>
            ) : null,
          },
        ]}
      />

      <TwoColumn
        rail={
          <>
            {(p.specializations.length > 0 || p.skills.length > 0) && (
              <RailBlock title="Specialisations & skills">
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...p.specializations, ...p.skills])].map((s) => (
                    <Tag key={s}>{formatField(s)}</Tag>
                  ))}
                </div>
              </RailBlock>
            )}
            <RailBlock title="At a glance">
              <dl className="space-y-1.5 text-sm">
                <Stat label="Programmes" value={programmeCount} />
                <Stat label="Projects / consortia" value={projects.data?.length ?? 0} />
                <Stat label="Publications" value={pubCount} />
              </dl>
            </RailBlock>
            {(p.profile_url || p.orcid) && (
              <RailBlock title="Links">
                <ul className="space-y-1.5 text-sm">
                  {p.orcid && (
                    <li>
                      <a
                        href={`https://orcid.org/${p.orcid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        ORCID profile
                      </a>
                    </li>
                  )}
                  {p.profile_url && (
                    <li>
                      <a
                        href={p.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Source profile
                      </a>
                    </li>
                  )}
                </ul>
              </RailBlock>
            )}
            <ClaimStub />
            <div className="space-y-1 px-1">
              <ProvenanceLine
                source={p.source}
                sourceUrl={p.source_url}
                status={p.verification_status}
              />
              <UpdatedLine ingestedAt={p.ingested_at} />
            </div>
          </>
        }
      >
        {p.bio && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{p.bio}</p>
          </SectionCard>
        )}

        <SectionCard title="Footprint" count={projects.data?.length ?? 0}>
          {projects.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading projects…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-ink-secondary">
              No projects or consortia linked yet.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([programId, rows]) => {
                const prog =
                  programId !== "__none__" ? programById.get(programId) : null;
                return (
                  <div key={programId}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                      {prog ? (
                        <EntityLink to={`/programs/${programId}`}>
                          {prog.name}
                        </EntityLink>
                      ) : (
                        "Other"
                      )}
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((row) => (
                        <li
                          key={row.project.id}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <EntityLink to={`/projects/${row.project.id}`}>
                            {row.project.title}
                          </EntityLink>
                          {roleLabel(row.role) && (
                            <Tag>{roleLabel(row.role)}</Tag>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Outputs" count={pubs.data?.length ?? 0}>
          {pubs.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading publications…</p>
          ) : !pubs.data?.length ? (
            <p className="text-sm text-ink-secondary">
              No publications linked yet
              {p.works_count
                ? ` — OpenAlex reports ${p.works_count} works for this person.`
                : "."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pubs.data.map((row) => (
                <li key={row.publication.id} className="py-2">
                  <div className="flex items-start justify-between gap-3">
                    <EntityLink to={`/publications/${row.publication.id}`}>
                      {row.publication.title}
                    </EntityLink>
                    {row.match_confidence != null && row.match_confidence < 1 && (
                      <span
                        className="shrink-0"
                        title="Author matched by name and institution — not confirmed by ORCID"
                      >
                        <Tag>possible match</Tag>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-secondary">
                    {[row.publication.journal, row.publication.publication_date]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </TwoColumn>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
