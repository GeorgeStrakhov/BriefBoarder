/**
 * Cloudflare Image Transformation Utilities
 * https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */

export type ImageFit = "scale-down" | "contain" | "cover" | "crop" | "pad";

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: ImageFit;
  quality?: number; // 1-100
  format?: "auto" | "webp" | "avif" | "json" | "jpeg" | "png";
}

/**
 * Transform an image URL using Cloudflare's image transformation service
 *
 * @param url - The original image URL
 * @param options - Transformation options
 * @returns Transformed URL with Cloudflare image transformations applied
 *
 * @example
 * transformImageUrl("https://cdn.yourdomain.com/avatars/image.png", {
 *   width: 1080,
 *   height: 1920,
 *   fit: "cover"
 * })
 * // Returns: "https://cdn.yourdomain.com/cdn-cgi/image/width=1080,height=1920,fit=cover/avatars/image.png"
 */
export function transformImageUrl(
  url: string,
  options: ImageTransformOptions,
): string {
  if (!url) return url;

  const cdnEndpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
  if (!cdnEndpoint) {
    console.warn("NEXT_PUBLIC_S3_ENDPOINT not set, returning original URL");
    return url;
  }

  // Only transform URLs from our CDN
  if (!url.startsWith(cdnEndpoint)) {
    return url;
  }

  // Build transformation parameters
  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.format) params.push(`format=${options.format}`);

  if (params.length === 0) {
    return url;
  }

  // Extract the path after the CDN endpoint
  const path = url.replace(cdnEndpoint, "");

  // Construct transformed URL
  return `${cdnEndpoint}/cdn-cgi/image/${params.join(",")}${path}`;
}

/**
 * Transform image to 9:16 aspect ratio (YouTube Shorts / mobile vertical)
 *
 * @param url - The original image URL
 * @param size - "full" (1080x1920) or "half" (540x960)
 * @returns Transformed URL with 9:16 aspect ratio
 */
export function transformToMobileAspect(
  url: string,
  size: "full" | "half" = "full",
): string {
  const dimensions =
    size === "full"
      ? { width: 1080, height: 1920 }
      : { width: 540, height: 960 };

  return transformImageUrl(url, {
    ...dimensions,
    fit: "cover",
    format: "auto",
  });
}

/**
 * Transform image to square aspect ratio
 *
 * @param url - The original image URL
 * @param size - Dimension in pixels (default: 512)
 * @returns Transformed URL with square aspect ratio
 */
export function transformToSquare(url: string, size: number = 512): string {
  return transformImageUrl(url, {
    width: size,
    height: size,
    fit: "cover",
    format: "auto",
  });
}

/**
 * Optimize image for web display with quality and format settings
 *
 * @param url - The original image URL
 * @param quality - Quality percentage (1-100, default: 85)
 * @returns Transformed URL with optimized quality
 */
export function optimizeImage(url: string, quality: number = 85): string {
  return transformImageUrl(url, {
    quality,
    format: "auto",
    fit: "scale-down",
  });
}
