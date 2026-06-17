import { useParams } from "react-router-dom";
import { useProgram, useProgramProjects } from "../lib/hooks";
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

/** Programme / funder profile — the consortia and projects it funds. */
export function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const program = useProgram(id);
  const projects = useProgramProjects(id);

  if (program.isLoading) return <PageStatus loading label="programme" />;
  if (program.error)
    return (
      <PageStatus
        notFound={(program.error as { status?: number }).status === 404}
        error
        label="programme"
      />
    );
  const pg = program.data!;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Directory", to: "/directory" },
          { label: "Programmes" },
          { label: pg.name },
        ]}
      />

      <ProfileHeader
        name={pg.name}
        monogramSrc={pg.logo_url}
        descriptor={[pg.short_name, pg.region].filter(Boolean).join(" · ")}
        badge={<IllustrativeBadge status={pg.verification_status} />}
        facts={[
          { label: "Region", value: pg.region },
          {
            label: "Funders",
            value: pg.funders.length ? pg.funders.join(", ") : null,
          },
          { label: "Consortia / projects", value: projects.data?.length ?? "—" },
        ]}
      />

      <TwoColumn
        rail={
          <>
            {pg.focus_areas.length > 0 && (
              <RailBlock title="Focus areas">
                <div className="flex flex-wrap gap-1.5">
                  {pg.focus_areas.map((f) => (
                    <Tag key={f}>{f}</Tag>
                  ))}
                </div>
              </RailBlock>
            )}
            {pg.website && (
              <RailBlock title="Links">
                <a
                  href={pg.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  Programme website
                </a>
              </RailBlock>
            )}
            <div className="px-1">
              <ProvenanceLine
                source={pg.source}
                sourceUrl={pg.source_url}
                status={pg.verification_status}
              />
            </div>
          </>
        }
      >
        {pg.description && (
          <SectionCard title="About">
            <p className="text-sm leading-relaxed text-ink">{pg.description}</p>
          </SectionCard>
        )}

        <SectionCard title="Consortia & projects" count={projects.data?.length ?? 0}>
          {projects.isLoading ? (
            <p className="text-sm text-ink-secondary">Loading projects…</p>
          ) : !projects.data?.length ? (
            <p className="text-sm text-ink-secondary">No projects listed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {projects.data.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <EntityLink to={`/projects/${p.id}`}>{p.title}</EntityLink>
                    {p.country && (
                      <div className="text-xs text-ink-secondary">{p.country}</div>
                    )}
                  </div>
                  {p.status && <Tag>{p.status}</Tag>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </TwoColumn>
    </div>
  );
}
