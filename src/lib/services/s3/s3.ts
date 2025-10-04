import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT_URL,
  region: process.env.S3_REGION || "weur",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_ID_KEY!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export interface UploadOptions {
  folder?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  publicUrl: string;
  size: number;
}

/**
 * Convert a filename to URL-friendly format with UUID
 * @param filename Original filename
 * @returns Slugified filename with UUID appended
 */
function createUniqueFilename(filename: string): string {
  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const nameWithoutExtension =
    lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";

  // Slugify the name part with robust handling
  const slugifiedName = slugify(nameWithoutExtension, {
    lower: true, // Convert to lowercase
    strict: true, // Strip special characters except replacement
    remove: /[*+~.()'"!:@]/g, // Remove these characters
    replacement: "-", // Replace spaces and other chars with -
    trim: true, // Trim leading/trailing replacement chars
  });

  // Ensure we have a valid name (fallback if slugify results in empty string)
  const safeName = slugifiedName || "file";

  // Limit length and add UUID
  const truncatedName = safeName.substring(0, 50);
  const uuid = uuidv4();

  return `${truncatedName}-${uuid}${extension}`;
}

/**
 * Upload a file to S3/R2 bucket
 * @param file File buffer or Blob
 * @param filename Original filename (will be slugified with UUID appended)
 * @param options Upload options
 * @returns Upload result with public URL
 */
export async function uploadFile(
  file: Buffer | Blob | Uint8Array,
  filename: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { folder = "", contentType, metadata } = options;

  const uniqueFilename = createUniqueFilename(filename);
  const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

  let fileBuffer: Buffer;
  let fileSize: number;

  if (file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    fileSize = file.size;
  } else if (file instanceof Uint8Array) {
    fileBuffer = Buffer.from(file);
    fileSize = file.length;
  } else {
    fileBuffer = file as Buffer;
    fileSize = (file as Buffer).length;
  }

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType || getContentType(filename),
    Metadata: metadata,
  });

  try {
    await s3Client.send(command);

    const publicUrl = `${process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT}/${key}`;

    return {
      key,
      publicUrl,
      size: fileSize,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Upload multiple files in parallel
 * @param files Array of files with their filenames
 * @param options Upload options (applied to all files)
 * @returns Array of upload results
 */
export async function uploadFiles(
  files: Array<{ file: Buffer | Blob | Uint8Array; filename: string }>,
  options: UploadOptions = {},
): Promise<UploadResult[]> {
  const uploadPromises = files.map(({ file, filename }) =>
    uploadFile(file, filename, options),
  );

  return Promise.all(uploadPromises);
}

/**
 * Upload a base64 encoded file
 * @param base64Data Base64 encoded file data
 * @param filename Original filename
 * @param options Upload options
 * @returns Upload result with public URL
 */
export async function uploadBase64File(
  base64Data: string,
  filename: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const base64WithoutPrefix = base64Data.replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(base64WithoutPrefix, "base64");

  return uploadFile(buffer, filename, options);
}

/**
 * Upload a file from a URL
 * @param url URL of the file to upload
 * @param filename Filename to save as (or extracted from URL)
 * @param options Upload options
 * @returns Upload result with public URL
 */
export async function uploadFromUrl(
  url: string,
  filename?: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") || undefined;

    if (!filename) {
      const urlPath = new URL(url).pathname;
      filename = urlPath.split("/").pop() || "file";
    }

    return uploadFile(blob, filename, {
      ...options,
      contentType: options.contentType || contentType,
    });
  } catch (error) {
    console.error("URL upload error:", error);
    throw new Error(
      `Failed to upload from URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Helper function to determine content type from filename
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();

  const contentTypes: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",

    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Text
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",

    // Media
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",

    // Archives
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
  };

  return contentTypes[ext || ""] || "application/octet-stream";
}

/**
 * Generate a public URL for a given key
 * @param key The S3 object key
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT}/${key}`;
}

/**
 * Extract the key from a public URL
 * @param publicUrl The public URL
 * @returns The S3 object key
 */
export function getKeyFromUrl(publicUrl: string): string {
  const endpoint =
    process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT || "";
  return publicUrl.replace(`${endpoint}/`, "");
}

/**
 * Transform an image URL using Cloudflare's URL-based transformations
 * @param originalUrl The original image URL
 * @returns Transformed URL with Cloudflare image optimizations
 */
export function getTransformedImageUrl(originalUrl: string): string {
  try {
    // Use NEXT_PUBLIC_S3_ENDPOINT for frontend access, fallback to S3_PUBLIC_ENDPOINT for server
    const cdnEndpoint =
      process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT;

    if (!cdnEndpoint || !originalUrl.startsWith(cdnEndpoint)) {
      return originalUrl;
    }

    // Parse URL to handle slashes correctly
    const url = new URL(originalUrl);
    const origin = url.origin; // e.g., "https://cdn.yourdomain.com"
    const pathname = url.pathname; // e.g., "/user-photos/photo-uuid.jpg"

    // Build transform parameters (hardcoded for now)
    const transformParams = "width=1024,quality=75,fit=scale-down,format=jpeg";
    const transformPath = `/cdn-cgi/image/${transformParams}`;

    // Combine: origin + transform + original path
    // pathname already has leading slash, transformPath has leading slash
    const transformedUrl = `${origin}${transformPath}${pathname}`;

    return transformedUrl;
  } catch (error) {
    console.error(
      `[IMAGE_TRANSFORM] Error transforming URL: ${originalUrl}`,
      error,
    );
    // Return original URL as fallback
    return originalUrl;
  }
}
