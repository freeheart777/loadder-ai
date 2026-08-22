import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import sharp from "sharp";
import { MEDIA_OPTIMIZATION_POLICY, acceptOptimization } from "./media-optimization-policy.mjs";

const sha256 = (body) => crypto.createHash("sha256").update(body).digest("hex");
const sha256File = (path) => new Promise((resolve, reject) => { const digest = crypto.createHash("sha256"), stream = createReadStream(path); stream.on("data", (chunk) => digest.update(chunk)); stream.on("error", reject); stream.on("end", () => resolve(digest.digest("hex"))); });
const mimeFor = (format) => ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[format];

export async function verifyAndOptimizeImage(path, declaredMimeType, originalByteSize) {
  const decoder = sharp(path, { animated: false, limitInputPixels: MEDIA_OPTIMIZATION_POLICY.image.maxPixels });
  const metadata = await decoder.metadata();
  const mimeType = mimeFor(metadata.format);
  if (!mimeType || mimeType !== declaredMimeType || metadata.pages > 1 || !metadata.width || !metadata.height || metadata.width < 320 || metadata.height < 320 || metadata.width > 8192 || metadata.height > 8192 || metadata.width * metadata.height > 40_000_000) throw Object.assign(new Error("CONTENT_ASSET_MEDIA_INVALID"), { code: "CONTENT_ASSET_MEDIA_INVALID" });
  const sourceSha256 = await sha256File(path);
  if (metadata.format === "webp") return { original: { mimeType, width: metadata.width, height: metadata.height, sha256: sourceSha256, byteSize: originalByteSize }, canonical: null, outcome: "OPTIMIZATION_SKIPPED", decision: { accepted: false, savingPercent: 0 } };
  const candidate = await sharp(path, { limitInputPixels: 40_000_000 }).rotate().webp(metadata.hasAlpha ? { lossless: true } : { quality: 90, smartSubsample: true }).toBuffer();
  const verified = await sharp(candidate, { limitInputPixels: 40_000_000 }).metadata();
  const compatibilityPassed = verified.width === metadata.width && verified.height === metadata.height && Boolean(verified.hasAlpha) === Boolean(metadata.hasAlpha);
  const decision = acceptOptimization({ originalBytes: originalByteSize, candidateBytes: candidate.length, qualityPassed: metadata.hasAlpha, compatibilityPassed, minimumSavingPercent: MEDIA_OPTIMIZATION_POLICY.imageMinimumSavingPercent });
  return { original: { mimeType, width: metadata.width, height: metadata.height, sha256: sourceSha256, byteSize: originalByteSize }, canonical: decision.accepted ? { body: candidate, byteSize: candidate.length, mimeType: "image/webp", sha256: sha256(candidate) } : null, outcome: decision.accepted ? "LOSSLESS_OPTIMIZED" : "ORIGINAL_KEPT", decision };
}

const exec = (file, args) => new Promise((resolve, reject) => execFile(file, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout)));
export async function verifyVideo(path, originalByteSize) {
  try {
    const raw = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", path]);
    const parsed = JSON.parse(raw), video = parsed.streams?.find((stream) => stream.codec_type === "video"), audio = parsed.streams?.find((stream) => stream.codec_type === "audio"), duration = Number(parsed.format?.duration);
    if (!video || video.codec_name !== "h264" || (audio && audio.codec_name !== "aac") || duration < 1 || duration > 180 || video.width > 3840 || video.height > 2160 || Math.min(video.width, video.height) < 320) throw new Error("invalid");
    return { mimeType: "video/mp4", width: video.width, height: video.height, durationMs: Math.round(duration * 1000), sha256: await sha256File(path), byteSize: originalByteSize, outcome: "OPTIMIZATION_SKIPPED" };
  } catch { throw Object.assign(new Error("CONTENT_ASSET_MEDIA_INVALID"), { code: "CONTENT_ASSET_MEDIA_INVALID" }); }
}
