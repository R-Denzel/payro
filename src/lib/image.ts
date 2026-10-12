// Downscale a photo to a JPEG small enough for upload and the vision model.
export async function prepareReceiptImage(
  file: File,
  maxSide = 1600,
): Promise<{ blob: Blob; base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.85,
    ),
  );
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { blob, base64: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl };
}
