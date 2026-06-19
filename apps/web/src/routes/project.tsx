import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  MEMBER_ROLE_LABELS,
  PARTNER_ROLE_LABELS,
  type MemberRole,
  type PartnerRole,
} from "@research-atlas/types";
import {
  useOrganization,
  usePerson,
  useProgram,
  useProject,
  useProjectGrants,
  useProjectMembers,
  useProjectPartners,
  useProjectPublications,
} from "../lib/hooks";
import {
  Breadcrumbs,
  EntityLink,
  IllustrativeBadge,
  PageStatus,
  ProvenanceLine,
  SectionCard,
  Tag,
} from "../components/ui";
import { ProfileHeader, RailBlock, TwoColumn } from "../components/profile-layout";

/** Project / consortium profile — its people, partner orgs, programme and funding. */
export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const project = useProject(id);
  const members = useProjectMembers(id);
  const partners = useProjectPartners(id);
  const pubs = useProjectPublications(id);
  const projectGrants = useProjectGrants(id);
  const program = useProgram(project.data?.program_id ?? undefined);
  const leadOrg = useOrganization(project.data?.lead_org_id ?? undefined);
  const pi = usePerson(project.data?.pi_person_id ?? undefined);

  const descriptor = useMemo(() => {
    if (!project.data) return null;
    return [project.data.status, project.data.country].filter(Boolean).join(" · ");
  }, [project.data]);

  if (project.isLoading) return <PageStatus loading label="project" />;
  if (project.error)
    return (
      <PageStatus
        notFound={(project.error as { status?: number }).status === 404}
        error
        label="project"
      />
    );
  const pr = project.data!;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          ...(program.data
            ? [{ label: program.data.name, to: `/programs/${program.data.id}` }]
            : []),
          { label: pr.title },
        ]}
      />

      <ProfileHeader
        name={pr.title}
        descriptor={descriptor}
        badge={<IllustrativeBadge status={pr.verification_status} />}
        facts={[
          {
            label: "Programme",
            value: program.data ? (
              <EntityLink to={`/programs/${program.data.id}`}>
                {program.data.name}
              </EntityLink>
            ) : null,
          },
          {
            label: "Lead organisation",
            value: leadOrg.data ? (
              <EntityLink to={`/organizations/${leadOrg.data.id}`}>
                {leadOrg.data.name}
              </EntityLink>
            ) : null,
          },
          {
            label: "Principal investigator",
            value: pi.data ? (
              <EntityLink to={`/people/${pi.data.id}`}>{pi.data.full_name}</EntityLink>
            ) : null,
          },
          { label: "Status", value: pr.status },
          { label: "Country", value: pr.country },
        ]}
      />

      <TwoColumn
        rail={
          <>
            {pr.themes.length > 0 && (
              <RailBlock title="Themes">
                <div className="flex flex-wrap gap-1.5">
                  {pr.themes.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </RailBlock>
            )}
            {pr.funding_note && (
              <RailBlock title="Funding">
                <p className="text-sm text-ink">{pr.funding_note}</p>
              </RailBlock>
            )}
            <div className="px-1">
              <ProvenanceLine
                source={pr.source}
                sourceUrl={pr.source_url}
                status={pr.verification_status}
              />
            </div>
          </>
        }
      >
        {pr.description && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{pr.description}</p>
          </SectionCard>
        )}

        <SectionCard title="People" count={members.data?.length ?? 0}>
          {members.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading people…</p>
          ) : !members.data?.length ? (
            <p className="text-sm text-ink-secondary">No people listed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.data.map((m) => (
                <li
                  key={m.person.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <EntityLink to={`/people/${m.person.id}`}>
                      {m.person.full_name}
                    </EntityLink>
                    {m.person.title && (
                      <div className="text-xs text-ink-secondary">
                        {m.person.title}
                      </div>
                    )}
                  </div>
                  {m.role && (
                    <Tag>{MEMBER_ROLE_LABELS[m.role as MemberRole] ?? m.role}</Tag>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Partner organisations"
          count={partners.data?.length ?? 0}
        >
          {partners.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading partners…</p>
          ) : !partners.data?.length ? (
            <p className="text-sm text-ink-secondary">
              No partner organisations listed yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {partners.data.map((p) => (
                <li
                  key={p.organization.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <EntityLink to={`/organizations/${p.organization.id}`}>
                    {p.organization.name}
                  </EntityLink>
                  {p.role && (
                    <Tag>{PARTNER_ROLE_LABELS[p.role as PartnerRole] ?? p.role}</Tag>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Funding" count={projectGrants.data?.length ?? 0}>
          {projectGrants.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading funding…</p>
          ) : !projectGrants.data?.length ? (
            <p className="text-sm text-ink-secondary">No grants linked yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {projectGrants.data.map(({ grant, funder }) => (
                <li
                  key={grant.id}
                  className="flex items-start justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <EntityLink to={`/grants/${grant.id}`}>{grant.name}</EntityLink>
                    {funder && (
                      <div className="text-xs text-ink-secondary">
                        <EntityLink to={`/organizations/${funder.id}`}>
                          {funder.name}
                        </EntityLink>
                      </div>
                    )}
                  </div>
                  {grant.amount != null && (
                    <span className="shrink-0 text-sm tabular-nums text-ink">
                      {formatAmount(grant.amount, grant.currency)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Outputs" count={pubs.data?.length ?? 0}>
          {pubs.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading publications…</p>
          ) : !pubs.data?.length ? (
            <p className="text-sm text-ink-secondary">No publications linked yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pubs.data.map(({ publication }) => (
                <li key={publication.id} className="py-2">
                  <EntityLink to={`/publications/${publication.id}`}>
                    {publication.title}
                  </EntityLink>
                  <div className="text-xs text-ink-secondary">
                    {[publication.journal, publication.publication_date]
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

/** Format a grant amount with its currency, falling back to a plain number. */
function formatAmount(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en")}${currency ? ` ${currency}` : ""}`;
  }
}
