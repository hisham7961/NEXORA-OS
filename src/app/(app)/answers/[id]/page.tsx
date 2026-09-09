import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MessageSquareQuote } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getAnswer, canApproveAnswers } from "@/domain/answers";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { AnswerLifecycle, CopyAnswerButton } from "@/components/answers/answer-controls";
import { BrandChip, CountryChip, UserChip } from "@/components/entity-chips";
import { formatDateTime, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Approved Answer" };

export default async function AnswerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("answers.view");
  const { id } = await params;

  let answer;
  try {
    answer = await getAnswer(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!answer) notFound();

  const canEdit = canAnywhere(principal, "answers.edit");
  const canApprove = canApproveAnswers(principal, answer.brandId);
  const [activity, lookups] = await Promise.all([getActivity("ApprovedAnswer", id), getLookups()]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));
  const hasDraft = answer.versions.some((v) => v.status === "draft");
  const hasPending = answer.versions.some((v) => v.status === "pending");
  const currentApproved = answer.versions.find((v) => v.status === "approved");

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/answers" className="hover:text-ink-2">Approved Answers</Link> / answer</div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><MessageSquareQuote className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{answer.question}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <StatusBadge module="generic" status={answer.status} />
              <Badge category="neutral">Current v{answer.version}</Badge>
              <span className="uppercase">{answer.language}</span>
              {answer.category && <span className="capitalize">· {answer.category.replace(/_/g, " ")}</span>}
              <BrandChip name={refName(lookups.brands, answer.brandId)} color={answer.brandId ? lookups.brands.get(answer.brandId)?.meta : null} />
              <CountryChip name={refName(lookups.countries, answer.countryId)} iso2={answer.countryId ? lookups.countries.get(answer.countryId)?.meta : null} />
            </div>
          </div>
        </div>
        {answer.status === "approved" && answer.answer && <CopyAnswerButton answerId={answer.id} text={answer.answer} label="Copy approved answer" />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader
              title="Current approved answer"
              description={currentApproved ? `v${currentApproved.version} · effective ${formatDate(currentApproved.effectiveAt, locale)}` : "No approved version yet."}
            />
            <PanelBody>
              {answer.status === "approved" && answer.answer ? (
                <p className="whitespace-pre-wrap text-[13px] text-ink">{answer.answer}</p>
              ) : (
                <p className="text-[13px] text-ink-3">This answer is not approved yet — agents cannot use it.</p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Version history" description="Every version is retained — nothing is destroyed on edit (§15)." />
            <ul className="divide-y divide-line">
              {answer.versions.map((v) => (
                <li key={v.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-2">v{v.version}</span>
                    <StatusBadge module="generic" status={v.status} />
                    <span className="text-[11px] text-ink-3">{formatDateTime(v.createdAt, locale)}</span>
                    {v.authorId && <span className="text-[11px] text-ink-3">· {refName(lookups.users, v.authorId)}</span>}
                    {v.approvedById && <span className="text-[11px] text-success">· approved by {refName(lookups.users, v.approvedById)}</span>}
                  </div>
                  {v.changeNote && <div className="mt-0.5 text-[11px] text-ink-3">Change: {v.changeNote}</div>}
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-2">{v.answer}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Activity" />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No activity yet." /></PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          {canEdit && (
            <Panel>
              <PanelHeader title="Lifecycle" description="Draft → Pending → Approved → Retired." />
              <PanelBody><AnswerLifecycle answerId={answer.id} status={answer.status} hasDraft={hasDraft} hasPending={hasPending} canApprove={canApprove} /></PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Details" />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-ink-3">Author</dt><dd>{answer.authorId ? <UserChip name={refName(lookups.users, answer.authorId)} color={lookups.users.get(answer.authorId)?.meta} /> : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Approved by</dt><dd>{answer.approvedById ? <UserChip name={refName(lookups.users, answer.approvedById)} color={lookups.users.get(answer.approvedById)?.meta} /> : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Effective</dt><dd className="text-ink">{formatDate(answer.effectiveDate, locale)}</dd></div>
              </dl>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
