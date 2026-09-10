"use client";

import { useCreateShortcut } from "@/lib/use-create-shortcut";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Plus, Pencil, Archive, FolderPlus } from "lucide-react";
import { Button, Input, Textarea, Select, Drawer } from "@/components/ui";
import { ActionForm, FormField, FormSection } from "@/components/form/action-form";
import { useToast, useI18n } from "@/components/providers";
import { uploadFileAction, addFileVersionAction, updateFileMetaAction, archiveFileAction, createFolderAction } from "@/app/actions/files";
import type { Option } from "@/domain/options";
import { FILE_CATEGORY_LABELS } from "@/lib/files/display";

const CATEGORIES = ["document", "image", "video", "creative", "regulatory", "contract", "spreadsheet", "other"];

const fileInputClass =
  "block w-full text-[13px] text-ink-2 file:me-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium file:text-accent hover:file:bg-accent-soft/80";

/** Upload a brand-new file. `related` attaches it to an entity on create. */
export function UploadFileButton({
  options,
  folders,
  related,
  scope,
  label,
  variant = "primary",
}: {
  options: { brands: Option[]; countries: Option[]; companies: Option[] };
  folders?: Option[];
  related?: { type: string; id: string };
  // When attaching to an entity, the file inherits that entity's scope so access
  // stays consistent with the entity it belongs to.
  scope?: { companyId?: string | null; brandId?: string | null; countryId?: string | null };
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  useCreateShortcut(() => setOpen(true));
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> {label ?? t("filef.uploadFile")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("filef.uploadAFile")} description={t("filef.uploadSub")} width="580px">
        <ActionForm action={uploadFileAction} submitLabel={t("filef.upload")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          {related && <><input type="hidden" name="relatedType" value={related.type} /><input type="hidden" name="relatedId" value={related.id} /></>}
          {scope?.companyId && <input type="hidden" name="companyId" value={scope.companyId} />}
          {scope?.brandId && <input type="hidden" name="brandId" value={scope.brandId} />}
          {scope?.countryId && <input type="hidden" name="countryId" value={scope.countryId} />}
          <FormField label={t("filef.file")} name="file" required>
            <input type="file" name="file" required className={fileInputClass} />
          </FormField>
          <FormSection>
            <FormField label={t("common.category")} name="category">
              <Select name="category" defaultValue="document">{CATEGORIES.map((c) => <option key={c} value={c}>{FILE_CATEGORY_LABELS[c]}</option>)}</Select>
            </FormField>
            <FormField label={t("filef.visibility")} name="visibility">
              <Select name="visibility" defaultValue="internal"><option value="internal">{t("filef.internal")}</option><option value="restricted">{t("filef.restricted")}</option></Select>
            </FormField>
            {!related && (
              <>
                <FormField label={t("common.brand")} name="brandId">
                  <Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select>
                </FormField>
                <FormField label={t("common.market")} name="countryId">
                  <Select name="countryId" defaultValue=""><option value="">—</option>{options.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
                </FormField>
                {folders && folders.length > 0 && (
                  <FormField label={t("filef.folder")} name="folderId">
                    <Select name="folderId" defaultValue=""><option value="">—</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select>
                  </FormField>
                )}
              </>
            )}
            <FormField label={t("filef.tags")} name="tags" hint={t("filef.commaSep")}>
              <TagsInput />
            </FormField>
          </FormSection>
          <FormField label={t("common.description")} name="description">
            <Textarea name="description" placeholder={t("filef.phWhatFile")} className="min-h-14" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

/** Splits a comma-separated text field into repeated `tags` inputs on submit. */
function TagsInput() {
  const { t } = useI18n();
  const [raw, setRaw] = useState("");
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <>
      <Input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t("filef.phTags")} />
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
    </>
  );
}

export function AddVersionButton({ fileId }: { fileId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("filef.newVersion")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("filef.uploadNewVersion")} description={t("filef.versionSub")}>
        <ActionForm action={addFileVersionAction} submitLabel={t("filef.addVersion")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="fileId" value={fileId} />
          <FormField label={t("filef.file")} name="file" required>
            <input type="file" name="file" required className={fileInputClass} />
          </FormField>
          <FormField label={t("filef.note")} name="note">
            <Textarea name="note" placeholder={t("filef.phVersionNote")} className="min-h-14" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

export function EditFileButton({ file }: { file: { id: string; name: string; description: string | null; category: string; tags: string[]; visibility: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> {t("actions.edit")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("filef.editFile")} description={t("filef.editFileSub")}>
        <ActionForm action={updateFileMetaAction} submitLabel={t("common.save")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <input type="hidden" name="fileId" value={file.id} />
          <FormField label={t("common.name")} name="name" required>
            <Input name="name" defaultValue={file.name} required />
          </FormField>
          <FormSection>
            <FormField label={t("common.category")} name="category">
              <Select name="category" defaultValue={file.category}>{CATEGORIES.map((c) => <option key={c} value={c}>{FILE_CATEGORY_LABELS[c]}</option>)}</Select>
            </FormField>
            <FormField label={t("filef.visibility")} name="visibility">
              <Select name="visibility" defaultValue={file.visibility}><option value="internal">{t("filef.internal")}</option><option value="restricted">{t("filef.restricted")}</option></Select>
            </FormField>
          </FormSection>
          <FormField label={t("filef.tags")} name="tags" hint={t("filef.commaSep")}>
            <TagsInputDefault initial={file.tags.join(", ")} />
          </FormField>
          <FormField label={t("common.description")} name="description">
            <Textarea name="description" defaultValue={file.description ?? ""} className="min-h-14" />
          </FormField>
        </ActionForm>
      </Drawer>
    </>
  );
}

function TagsInputDefault({ initial }: { initial: string }) {
  const { t } = useI18n();
  const [raw, setRaw] = useState(initial);
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <>
      <Input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t("filef.phTags")} />
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
    </>
  );
}

export function ArchiveFileButton({ fileId, redirectTo }: { fileId: string; redirectTo?: string }) {
  const router = useRouter();
  const { toast } = useToast(); const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() =>
      start(async () => {
        const res = await archiveFileAction(fileId);
        if (res.ok) { toast({ kind: "success", title: t("filef.fileArchived") }); if (redirectTo) router.push(redirectTo); else router.refresh(); }
        else toast({ kind: "error", title: res.error });
      })
    }>
      <Archive className="h-4 w-4" /> {t("orgf.archive")}
    </Button>
  );
}

export function NewFolderButton({ options }: { options: { brands: Option[]; companies: Option[] } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  const SCOPES = ["shared", "department", "brand", "product", "regulatory", "creative", "restricted", "vault"];
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><FolderPlus className="h-4 w-4" /> {t("filef.newFolder")}</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("filef.newFolder")} description={t("filef.newFolderSub")}>
        <ActionForm action={createFolderAction} submitLabel={t("filef.createFolder")} onCancel={() => setOpen(false)} onSuccess={() => { setOpen(false); router.refresh(); }}>
          <FormField label={t("common.name")} name="name" required><Input name="name" required placeholder={t("filef.phFolderName")} /></FormField>
          <FormSection>
            <FormField label={t("filef.scope")} name="scopeType"><Select name="scopeType" defaultValue="shared">{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></FormField>
            <FormField label={t("common.brand")} name="brandId"><Select name="brandId" defaultValue=""><option value="">—</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</Select></FormField>
          </FormSection>
        </ActionForm>
      </Drawer>
    </>
  );
}
