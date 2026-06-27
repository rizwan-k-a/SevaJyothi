// Client-side image compression for low-bandwidth uploads.
// Targets ~1600px longest edge at JPEG q=0.82 — typically 80-92% size reduction
// vs raw camera output, while staying readable for technician triage.

export type CompressOpts = {
  maxEdge?: number;   // longest edge in px
  quality?: number;   // 0..1 (JPEG)
  mimeType?: "image/jpeg" | "image/webp";
};

export async function compressImageFile(
  file: File,
  opts: CompressOpts = {},
): Promise<{ dataUrl: string; bytes: number; width: number; height: number }> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  const mimeType = opts.mimeType ?? "image/jpeg";

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  let dataUrl: string;
  if ("convertToBlob" in canvas) {
    const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality });
    dataUrl = await blobToDataUrl(blob);
  } else {
    dataUrl = (canvas as HTMLCanvasElement).toDataURL(mimeType, quality);
  }
  // Approximate byte length from base64 payload.
  const b64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.floor((b64.length * 3) / 4);
  return { dataUrl, bytes, width: w, height: h };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoke after decode completes — image stays usable until GC'd.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ""));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
