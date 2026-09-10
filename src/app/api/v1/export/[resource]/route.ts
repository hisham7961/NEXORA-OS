import { route } from "@/lib/api/handler";
import { runExport } from "@/domain/exporters";

export const GET = route<{ resource: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const url = new URL(req.url);
  const { csv, filename } = await runExport({ principal, ip, userAgent }, params.resource, url.searchParams);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
