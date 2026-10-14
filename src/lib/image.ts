// Photo helpers shared by the AI readers (memo scanner, list scanner).

const MAX_SIDE = 1600;

// Phone photos are 3–12 MB; the readers only need ~1600px. Downscale and
// re-encode as JPEG in the browser (drawing an <img> also applies EXIF rotation).
export async function toJpeg(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The first image in a paste (Ctrl+V of a screenshot), if any. */
export function pastedImage(e: ClipboardEvent): File | null {
  return [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/")) ?? null;
}
