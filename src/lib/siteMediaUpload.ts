import { API_BASE_URL, apiFetch } from "./api";

export type SiteMediaAssetType = "logo" | "hero" | "banner" | "product" | "gallery" | "favicon";

export type UploadedSiteMedia = {
  id: string;
  assetType?: string;
  url: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
};

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
export const MAX_SITE_MEDIA_BYTES = 25 * 1024 * 1024;

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || `HTTP ${response.status}`}${code}`);
  }
  return data;
}

export function validateSiteMediaFile(file: File) {
  const mimeType = String(file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new Error("فرمت تصویر پشتیبانی نمی‌شود. PNG، JPG، WEBP، GIF یا SVG انتخاب کن.");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("فایل تصویر خالی یا نامعتبر است.");
  if (file.size > MAX_SITE_MEDIA_BYTES) throw new Error("حجم تصویر باید حداکثر ۲۵ مگابایت باشد.");
  return mimeType;
}

function targetsLoadderApi(url: string) {
  return url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
}

export async function uploadSiteMedia({
  siteProjectId,
  file,
  assetType = "gallery",
  metadata = {},
}: {
  siteProjectId: string;
  file: File;
  assetType?: SiteMediaAssetType;
  metadata?: Record<string, unknown>;
}): Promise<UploadedSiteMedia> {
  if (!siteProjectId) throw new Error("پروژه فروشگاهی برای آپلود تصویر مشخص نیست.");
  const mimeType = validateSiteMediaFile(file);

  const created = await read(await apiFetch(`/api/site-projects/${siteProjectId}/media/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetType, fileName: file.name, mimeType, sizeBytes: file.size }),
  }));

  const upload = created.upload;
  if (!upload?.signedUrl || !upload?.path) throw new Error("سرور آدرس معتبر برای آپلود تصویر برنگرداند.");
  const signedUrl = String(upload.signedUrl);
  const response = await fetch(signedUrl, {
    method: "PUT",
    credentials: targetsLoadderApi(signedUrl) ? "include" : "omit",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ارسال تصویر به فضای ذخیره‌سازی ناموفق بود (HTTP ${response.status})${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
  }

  const completed = await read(await apiFetch(`/api/site-projects/${siteProjectId}/media/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetType,
      mimeType,
      sizeBytes: file.size,
      storageKey: upload.path,
      metadata: { name: file.name, ...metadata },
    }),
  }));
  if (!completed.media?.url) throw new Error("تصویر آپلود شد اما ثبت آن در Media Library کامل نشد.");
  return completed.media as UploadedSiteMedia;
}
