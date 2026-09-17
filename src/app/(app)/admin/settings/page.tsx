import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getSettingsForAdmin } from "@/domain/settings";
import { PageHeader } from "@/components/ui";
import { SettingsEditor } from "@/components/admin/settings-editor";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const { settings } = await getSettingsForAdmin(principal);
  const canManage = canAnywhere(principal, "settings.manage");

  return (
    <>
      <PageHeader title={t("admin.systemSettings")} description={t("admin.systemSettingsSub")} />
      <SettingsEditor settings={settings} canManage={canManage} />
    </>
  );
}
