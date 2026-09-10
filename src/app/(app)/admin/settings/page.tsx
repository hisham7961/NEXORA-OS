import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { getSettingsForAdmin } from "@/domain/settings";
import { PageHeader } from "@/components/ui";
import { SettingsEditor } from "@/components/admin/settings-editor";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { settings } = await getSettingsForAdmin(principal);
  const canManage = canAnywhere(principal, "settings.manage");

  return (
    <>
      <PageHeader title="System Settings" description="Administrable platform configuration. Validated, permission-gated and audited. Secrets are environment-managed and shown only as configured / not set." />
      <SettingsEditor settings={settings} canManage={canManage} />
    </>
  );
}
