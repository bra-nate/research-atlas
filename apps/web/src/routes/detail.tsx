import { useParams } from "react-router-dom";
import { CAPABILITY_KIND_LABELS } from "@research-atlas/types";
import {
  useCapability,
  useGrant,
  useOrganization,
  usePublication,
  usePublicationAuthors,
} from "../lib/hooks";
import {
  Breadcrumbs,
  EntityLink,
  IllustrativeBadge,
  MonoCode,
  PageStatus,
  ProvenanceLine,
  SectionCard,
  Tag,
} from "../components/ui";
import { ProfileHeader, RailBlock, TwoColumn } from "../components/profile-layout";

/** Light single-column profiles for leaf entities. */

export function PublicationPage() {
  const { id } = useParams<{ id: string }>();
  const pub = usePublication(id);
  const authors = usePublicationAuthors(id);

  if (pub.isLoading) return <PageStatus loading label="publication" />;
  if (pub.error)
    return (
      <PageStatus
        notFound={(pub.error as { status?: number }).status === 404}
        error
        label="publication"
      />
    );
  const p = pub.data!;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "Publications" },
          { label: p.title },
        ]}
      />
      <ProfileHeader
        name={p.title}
        descriptor={[p.journal, p.publication_date].filter(Boolean).join(" · ")}
        badge={<IllustrativeBadge status={p.verification_status} />}
        facts={[
          {
            label: "DOI",
            value: p.doi ? (
              <a
                href={`https://doi.org/${p.doi}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[13px] text-brand hover:underline"
              >
                {p.doi}
              </a>
            ) : null,
          },
          { label: "Published", value: p.publication_date },
        ]}
      />
      <TwoColumn
        rail={
          <>
            {p.url && (
              <RailBlock title="Links">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  View publication
                </a>
              </RailBlock>
            )}
            <div className="px-1">
              <ProvenanceLine
                source={p.source}
                sourceUrl={p.source_url}
                status={p.verification_status}
              />
            </div>
          </>
        }
      >
        {p.abstract && (
          <SectionCard title="Abstract">
            <p className="text-sm leading-relaxed text-ink">{p.abstract}</p>
          </SectionCard>
        )}
        <SectionCard title="Authors" count={authors.data?.length ?? 0}>
          {authors.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading authors…</p>
          ) : !authors.data?.length ? (
            <p className="text-sm text-ink-secondary">No authors linked yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {authors.data.map((a) => (
                <li key={a.person.id} className="py-2">
                  <EntityLink to={`/people/${a.person.id}`}>
                    {a.person.full_name}
                  </EntityLink>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </TwoColumn>
    </div>
  );
}

export function GrantPage() {
  const { id } = useParams<{ id: string }>();
  const grant = useGrant(id);
  const funder = useOrganization(grant.data?.funder_org_id ?? undefined);

  if (grant.isLoading) return <PageStatus loading label="grant" />;
  if (grant.error)
    return (
      <PageStatus
        notFound={(grant.error as { status?: number }).status === 404}
        error
        label="grant"
      />
    );
  const g = grant.data!;
  const amount =
    g.amount != null
      ? new Intl.NumberFormat("en", {
          style: g.currency ? "currency" : "decimal",
          currency: g.currency ?? undefined,
          maximumFractionDigits: 0,
        }).format(g.amount)
      : null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "Grants" },
          { label: g.name },
        ]}
      />
      <ProfileHeader
        name={g.name}
        badge={<IllustrativeBadge status={g.verification_status} />}
        facts={[
          {
            label: "Funder",
            value: funder.data ? (
              <EntityLink to={`/organizations/${funder.data.id}`}>
                {funder.data.name}
              </EntityLink>
            ) : null,
          },
          { label: "Amount", value: amount },
          { label: "Award number", value: g.award_number ? <MonoCode>{g.award_number}</MonoCode> : null },
          {
            label: "Period",
            value: [g.start_date, g.end_date].filter(Boolean).join(" – ") || null,
          },
        ]}
      />
      <TwoColumn
        rail={
          <div className="px-1">
            <ProvenanceLine
              source={g.source}
              sourceUrl={g.source_url}
              status={g.verification_status}
            />
          </div>
        }
      >
        {g.description && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{g.description}</p>
          </SectionCard>
        )}
      </TwoColumn>
    </div>
  );
}

export function CapabilityPage() {
  const { id } = useParams<{ id: string }>();
  const cap = useCapability(id);
  const org = useOrganization(cap.data?.org_id ?? undefined);

  if (cap.isLoading) return <PageStatus loading label="capability" />;
  if (cap.error)
    return (
      <PageStatus
        notFound={(cap.error as { status?: number }).status === 404}
        error
        label="capability"
      />
    );
  const c = cap.data!;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "Capabilities", to: "/directory" },
          { label: c.name },
        ]}
      />
      <ProfileHeader
        name={c.name}
        descriptor={[c.category, c.city, c.country].filter(Boolean).join(" · ")}
        badge={<IllustrativeBadge status={c.verification_status} />}
        facts={[
          { label: "Kind", value: <Tag>{CAPABILITY_KIND_LABELS[c.kind]}</Tag> },
          {
            label: "Organisation",
            value: org.data ? (
              <EntityLink to={`/organizations/${org.data.id}`}>
                {org.data.name}
              </EntityLink>
            ) : null,
          },
          { label: "Location", value: [c.city, c.country].filter(Boolean).join(", ") || null },
        ]}
      />
      <TwoColumn
        rail={
          <div className="px-1">
            <ProvenanceLine
              source={c.source}
              sourceUrl={c.source_url}
              status={c.verification_status}
            />
          </div>
        }
      >
        {c.description && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{c.description}</p>
          </SectionCard>
        )}
        {c.access_note && (
          <SectionCard title="Access">
            <p className="text-sm leading-relaxed text-ink">{c.access_note}</p>
          </SectionCard>
        )}
      </TwoColumn>
    </div>
  );
}
