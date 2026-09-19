"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useCreateShortcut } from "@/lib/use-create-shortcut";
import { createDocumentAction } from "@/app/actions/documents";
import { useI18n } from "@/components/providers";
import type { Option } from "@/domain/options";

type DocType = { id: string; name: string };

/**
 * Create a document or certificate (audit DOM-01/02). Certificates are Documents
 * with a regulatory type, so the same drawer serves both — `certificate` only
 * changes the labels and the default type list passed in by the page.
 */
export function NewDocumentButton({
  companies,
  brands,
  countries,
  documentTypes,
  certificate = false,
}: {
  companies: Option[];
  brands: Option[];
  countries: Option[];
  documentTypes: DocType[];
  certificate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {t(certificate ? "docf.newCertificate" : "docf.newDocument")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t(certificate ? "docf.drawerCertTitle" : "docf.drawerDocTitle")}
        description={t(certificate ? "docf.drawerCertSub" : "docf.drawerDocSub")}
      >
        <ActionForm
          action={createDocumentAction}
          submitLabel={t(certificate ? "docf.addCertificate" : "docf.addDocument")}
          onCancel={() => setOpen(false)}
          onSuccess={() => { setOpen(false); router.refresh(); }}
        >
          <FormField label={t("docf.title")} name="title" required>
            <Input name="title" required placeholder={t("docf.titlePh")} />
          </FormField>
          <FormSection>
            <FormField label={t("docf.type")} name="documentTypeId">
              <Select name="documentTypeId" defaultValue="">
                <option value="">{t("docf.selectType")}</option>
                {documentTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
            <FormField label={t("docf.number")} name="number">
              <Input name="number" />
            </FormField>
            <FormField label={t("common.company")} name="companyId">
              <Select name="companyId" defaultValue=""><option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.brand")} name="brandId">
              <Select name="brandId" defaultValue=""><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
            </FormField>
            <FormField label={t("common.market")} name="countryId">
              <Select name="countryId" defaultValue=""><option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
            <FormField label={t("docf.visibility")} name="visibility">
              <Select name="visibility" defaultValue="internal">
                <option value="internal">{t("docf.internal")}</option>
                <option value="restricted">{t("docf.restricted")}</option>
              </Select>
            </FormField>
            <FormField label={t("docf.issueDate")} name="issueDate">
              <Input type="date" name="issueDate" />
            </FormField>
            <FormField label={t("docf.expiryDate")} name="expiryDate">
              <Input type="date" name="expiryDate" />
            </FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}
