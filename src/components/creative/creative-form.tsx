"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useCreateShortcut } from "@/lib/use-create-shortcut";
import { createCreativeAssetAction } from "@/app/actions/creative";
import { useI18n } from "@/components/providers";
import type { Option } from "@/domain/options";

// Kept in sync with CREATIVE_ASSET_TYPES in src/domain/creative.ts (the schema's source
// of truth). Inlined here so this client component doesn't import the server domain module.
const ASSET_TYPES = ["post", "story", "reel", "banner", "packaging", "video", "print", "email", "web", "other"] as const;

/**
 * Add a creative asset to the library (audit DOM-03). Metadata-first entry — the
 * file is attached via the File platform as a follow-up, so this form carries no
 * client-supplied fileId. Brand is required (it is the asset's scope dimension).
 */
export function NewCreativeAssetButton({ brands, users }: { brands: Option[]; users: Option[] }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {t("clf.newAsset")}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("clf.drawerTitle")} description={t("clf.drawerSub")}>
        <ActionForm
          action={createCreativeAssetAction}
          submitLabel={t("clf.submit")}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        >
          <FormField label={t("clf.assetType")} name="assetType" required>
            <Select name="assetType" defaultValue="post">
              {ASSET_TYPES.map((a) => <option key={a} value={a}>{t(`assetType.${a}`)}</option>)}
            </Select>
          </FormField>
          <FormSection>
            <FormField label={t("common.brand")} name="brandId" required>
              <Select name="brandId" required defaultValue="">
                <option value="" disabled>{t("clf.selectBrand")}</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </Select>
            </FormField>
            <FormField label={t("common.platform")} name="platform">
              <Input name="platform" placeholder={t("clf.platformPh")} />
            </FormField>
            <FormField label={t("clf.designer")} name="designerId">
              <Select name="designerId" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </FormField>
            <FormField label={t("clf.tags")} name="tags">
              <Input name="tags" placeholder={t("clf.tagsPh")} />
            </FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}
