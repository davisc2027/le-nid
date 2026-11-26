// Upload limits shared by the browser forms (friendly messages) and mirrored by the storage bucket limits in
// migration 0020. The bucket is the real enforcement; these checks only save people a failed upload.

export const TODO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const FILES_MAX_BYTES = 50 * 1024 * 1024;

export const TODO_UPLOAD_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp",
] as const;

export const FILES_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation", "application/rtf",
  "text/plain", "text/csv", "text/markdown",
] as const;

const BY_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation", rtf: "application/rtf",
  txt: "text/plain", csv: "text/csv", md: "text/markdown",
};

/** The file's MIME type, falling back to its extension (some browsers give "" for HEIC and Office files). */
export function mimeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type.toLowerCase();
  return BY_EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

/** Returns a friendly problem description, or "" when the file is fine. */
export function checkUpload(
  file: { name: string; type: string; size: number },
  rule: { maxBytes: number; types: readonly string[]; allowed: string },
): string {
  if (file.size === 0) return "That file is empty.";
  if (file.size > rule.maxBytes) {
    return `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${Math.round(rule.maxBytes / 1048576)} MB.`;
  }
  if (!rule.types.includes(mimeOf(file))) return `That type of file isn't allowed. Use ${rule.allowed}.`;
  return "";
}

export const TODO_RULE = { maxBytes: TODO_UPLOAD_MAX_BYTES, types: TODO_UPLOAD_TYPES, allowed: "a PDF or a photo (JPG, PNG, HEIC or WebP)" };
export const FILES_RULE = { maxBytes: FILES_MAX_BYTES, types: FILES_TYPES, allowed: "a PDF, image, Office document or text file" };

/** Free-text caps used by the admin actions and the profile form. */
export const LIMITS = { name: 80, title: 200, body: 5000, notes: 2000 } as const;
