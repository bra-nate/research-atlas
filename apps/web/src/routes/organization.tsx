import { useParams } from "react-router-dom";
import {
  CAPABILITY_KIND_LABELS,
  ORG_TYPE_LABELS,
} from "@research-atlas/types";
import {
  useOrganization,
  useOrgCapabilities,
  useOrgPeople,
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

/** Organisation profile — its people and capabilities. */
export function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const org = useOrganization(id);
  const people = useOrgPeople(id);
  const caps = useOrgCapabilities(id);

  if (org.isLoading) return <PageStatus loading label="organisation" />;
  if (org.error)
    return (
      <PageStatus
        notFound={(org.error as { status?: number }).status === 404}
        error
        label="organisation"
      />
    );
  const o = org.data!;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "Organisations", to: "/directory" },
          { label: o.name },
        ]}
      />

      <ProfileHeader
        name={o.name}
        monogramSrc={o.logo_url}
        descriptor={[
          ORG_TYPE_LABELS[o.org_type] ?? o.org_type,
          o.country,
        ]
          .filter(Boolean)
          .join(" · ")}
        badge={<IllustrativeBadge status={o.verification_status} />}
        facts={[
          { label: "Type", value: ORG_TYPE_LABELS[o.org_type] ?? o.org_type },
          { label: "Country", value: o.country },
          { label: "ROR", value: o.ror_id ? <MonoCode>{o.ror_id}</MonoCode> : null },
        ]}
      />

      <TwoColumn
        rail={
          <>
            {o.website && (
              <RailBlock title="Links">
                <a
                  href={o.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  Website
                </a>
              </RailBlock>
            )}
            <div className="px-1">
              <ProvenanceLine
                source={o.source}
                sourceUrl={o.source_url}
                status={o.verification_status}
              />
            </div>
          </>
        }
      >
        {o.description && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{o.description}</p>
          </SectionCard>
        )}

        <SectionCard title="People" count={people.data?.length ?? 0}>
          {people.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading people…</p>
          ) : !people.data?.length ? (
            <p className="text-sm text-ink-secondary">No people listed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {people.data.map((p) => (
                <li key={p.id} className="py-2">
                  <EntityLink to={`/people/${p.id}`}>{p.full_name}</EntityLink>
                  {(p.title || p.specializations.length > 0) && (
                    <div className="text-xs text-ink-secondary">
                      {[p.title, p.specializations.slice(0, 3).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Capabilities" count={caps.data?.length ?? 0}>
          {caps.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading capabilities…</p>
          ) : !caps.data?.length ? (
            <p className="text-sm text-ink-secondary">No capabilities listed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {caps.data.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <EntityLink to={`/capabilities/${c.id}`}>{c.name}</EntityLink>
                    {(c.category || c.city) && (
                      <div className="text-xs text-ink-secondary">
                        {[c.category, c.city].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <Tag>{CAPABILITY_KIND_LABELS[c.kind]}</Tag>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </TwoColumn>
    </div>
  );
}
