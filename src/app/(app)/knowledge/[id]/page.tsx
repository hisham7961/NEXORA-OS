import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getArticle, canApproveKnowledge } from "@/domain/knowledge";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, StatusBadge, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { EditDraftButton, ArticleLifecycle } from "@/components/knowledge/article-controls";
import { EntityFiles } from "@/components/files/entity-files";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDate, formatDateTime } from "@/lib/format";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Article" };

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("knowledge.view");
  const { t } = await getServerI18n();
  const { id } = await params;

  let article;
  try {
    article = await getArticle(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!article) notFound();

  const canEdit = canAnywhere(principal, "knowledge.edit");
  const canApprove = canApproveKnowledge(principal, article.brandId);
  const [activity, lookups] = await Promise.all([getActivity("KnowledgeArticle", id), getLookups()]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : t("common.system"),
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));
  const draft = article.versions.find((v) => v.status === "draft");
  const inReview = article.versions.find((v) => v.status === "in_review");
  const publishedVersion = article.versions.find((v) => v.status === "published");

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/knowledge" className="hover:text-ink-2">{t("dp.kbNav")}</Link> / {article.title}</div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><BookOpen className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">{article.title}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <StatusBadge module="generic" status={article.status} />
              <Badge category="neutral">{t("dp.currentV", { version: article.version })}</Badge>
              {article.category && <span className="capitalize">{article.category.replace(/_/g, " ")}</span>}
              <BrandChip name={refName(lookups.brands, article.brandId)} color={article.brandId ? lookups.brands.get(article.brandId)?.meta : null} />
              {article.tags.map((tg) => <Badge key={tg} category="info">{tg}</Badge>)}
            </div>
          </div>
        </div>
        {canEdit && draft && <EditDraftButton article={{ id: article.id, title: article.title, category: article.category, tags: article.tags, draftBody: draft.body }} />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title={t("dp.publishedContent")} description={publishedVersion ? t("dp.publishedVdesc", { version: publishedVersion.version, date: formatDate(publishedVersion.publishedAt, locale) }) : t("dp.notPublishedYet")} />
            <PanelBody>
              {article.status === "published" && article.body ? (
                <div className="prose-nexora whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{article.body}</div>
              ) : (
                <p className="text-[13px] text-ink-3">{t("dp.noPublished")}</p>
              )}
            </PanelBody>
          </Panel>

          {(draft || inReview) && (
            <Panel>
              <PanelHeader title={inReview ? t("dp.inReviewDraft") : t("dp.workingDraft")} description={t("dp.notVisible")} />
              <PanelBody><p className="whitespace-pre-wrap text-[13px] text-ink-2">{(inReview ?? draft)!.body}</p></PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader title={t("dp.versionHistory")} description={t("dp.versionHistorySub")} />
            <ul className="divide-y divide-line">
              {article.versions.map((v) => (
                <li key={v.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-2">v{v.version}</span>
                    <StatusBadge module="generic" status={v.status} />
                    <span className="text-[11px] text-ink-3">{formatDateTime(v.createdAt, locale)}</span>
                    {v.authorId && <span className="text-[11px] text-ink-3">· {refName(lookups.users, v.authorId)}</span>}
                    {v.approvedById && <span className="text-[11px] text-success">· {t("dp.publishedByName", { name: refName(lookups.users, v.approvedById) })}</span>}
                  </div>
                  {v.changeNote && <div className="mt-0.5 text-[11px] text-ink-3">{t("dp.changeNote", { note: v.changeNote })}</div>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title={t("dp.activity")} />
            <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty={t("dp.noActivity")} /></PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          {canEdit && (
            <Panel>
              <PanelHeader title={t("dp.lifecycle")} description={t("dp.kbLifecycleSub")} />
              <PanelBody><ArticleLifecycle articleId={article.id} status={article.status} hasDraft={!!draft} hasReview={!!inReview} canApprove={canApprove} /></PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader title={t("dp.details")} />
            <PanelBody>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.author")}</dt><dd>{article.authorId ? <UserChip name={refName(lookups.users, article.authorId)} color={lookups.users.get(article.authorId)?.meta} /> : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.reviewer")}</dt><dd>{article.reviewerId ? <UserChip name={refName(lookups.users, article.reviewerId)} color={lookups.users.get(article.reviewerId)?.meta} /> : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.lastReviewed")}</dt><dd className="text-ink">{formatDate(article.lastReviewedAt, locale)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">{t("dp.nextReview")}</dt><dd className="text-ink">{formatDate(article.reviewDueAt, locale)}</dd></div>
              </dl>
            </PanelBody>
          </Panel>
          <EntityFiles principal={principal} entityType="KnowledgeArticle" entityId={article.id} scope={{ brandId: article.brandId, countryId: article.countryId }} />
        </div>
      </div>
    </>
  );
}
