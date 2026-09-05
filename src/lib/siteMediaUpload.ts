import { apiFetch } from "./api";

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

function encodeMetadata(metadata: Record<string, unknown>) {
  const json = JSON.stringify(metadata || {});
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

  const uploaded = await read(await apiFetch(`/api/site-projects/${siteProjectId}/media/upload`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "x-loadder-asset-type": assetType,
      "x-loadder-file-name": file.name,
      "x-loadder-media-metadata": encodeMetadata({ name: file.name, ...metadata }),
    },
    body: file,
  }));

  if (!uploaded.media?.url) throw new Error("تصویر ذخیره شد اما Media Library پاسخ معتبر نداد.");
  return uploaded.media as UploadedSiteMedia;
}
