# S3 Service

A simple S3/R2 service for uploading files from server-side Next.js code, built to work seamlessly with Vercel deployment.

## Setup

### Environment Variables

Add to your `.env` file:

```bash
S3_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com/your-bucket-name
S3_ACCESS_ID_KEY=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_REGION=weur
S3_PUBLIC_ENDPOINT=https://cdn.yourdomain.org
S3_BUCKET_NAME=your-bucket-name  # Optional if included in endpoint URL
```

### Installation

The service uses AWS SDK v3:

```bash
pnpm add @aws-sdk/client-s3 uuid @types/uuid
```

## Usage

### Basic File Upload

```typescript
import { uploadFile } from "@/services/s3";

// Upload a Buffer
const buffer = Buffer.from("Hello World");
const result = await uploadFile(buffer, "hello.txt");
console.log(result.publicUrl); // https://cdn.yourdomain.org/a1b2c3d4-...-hello.txt

// Upload a Blob (from form data)
const formData = await request.formData();
const file = formData.get("file") as File;
const result = await uploadFile(file, file.name);

// Upload with folder organization
const result = await uploadFile(imageBuffer, "profile.jpg", {
  folder: "avatars",
});
// Result: https://cdn.yourdomain.org/avatars/uuid-profile.jpg
```

### Upload Multiple Files

```typescript
import { uploadFiles } from "@/services/s3";

const files = [
  { file: buffer1, filename: "doc1.pdf" },
  { file: buffer2, filename: "doc2.pdf" },
  { file: buffer3, filename: "image.jpg" },
];

const results = await uploadFiles(files, {
  folder: "documents",
});
```

### Upload from Base64

```typescript
import { uploadBase64File } from "@/services/s3";

// From a data URL
const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANS...";
const result = await uploadBase64File(dataUrl, "image.png", {
  folder: "uploads",
});

// From raw base64 string
const base64String = "iVBORw0KGgoAAAANS...";
const result = await uploadBase64File(base64String, "document.pdf");
```

### Upload from URL

```typescript
import { uploadFromUrl } from "@/services/s3";

// Download and re-upload an image
const result = await uploadFromUrl(
  "https://example.com/image.jpg",
  "saved-image.jpg", // Optional, extracted from URL if not provided
  { folder: "external" },
);

// Let the service determine filename from URL
const result = await uploadFromUrl("https://example.com/document.pdf");
```

### Working with URLs and Keys

```typescript
import { getPublicUrl, getKeyFromUrl } from "@/services/s3";

// Generate public URL from a key
const publicUrl = getPublicUrl("avatars/uuid-profile.jpg");
// Returns: https://cdn.yourdomain.org/avatars/uuid-profile.jpg

// Extract key from public URL
const key = getKeyFromUrl(
  "https://cdn.yourdomain.org/avatars/uuid-profile.jpg",
);
// Returns: avatars/uuid-profile.jpg
```

## API Reference

### Types

```typescript
interface UploadOptions {
  folder?: string; // Organize files in folders
  contentType?: string; // MIME type (auto-detected if not provided)
  metadata?: Record<string, string>; // Custom metadata
}

interface UploadResult {
  key: string; // S3 object key
  publicUrl: string; // Public CDN URL
  size: number; // File size in bytes
}
```

### Functions

- **`uploadFile(file, filename, options?)`** - Upload a single file
- **`uploadFiles(files[], options?)`** - Upload multiple files in parallel
- **`uploadBase64File(base64, filename, options?)`** - Upload from base64 data
- **`uploadFromUrl(url, filename?, options?)`** - Download and upload from URL
- **`getPublicUrl(key)`** - Generate public URL from S3 key
- **`getKeyFromUrl(url)`** - Extract S3 key from public URL

## Examples

### API Route for File Upload

```typescript
// app/api/upload/route.ts
import { uploadFile } from "@/services/s3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const result = await uploadFile(file, file.name, {
      folder: "uploads",
    });

    return NextResponse.json({
      url: result.publicUrl,
      size: result.size,
    });
  } catch (error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

### Profile Avatar Upload

```typescript
import { uploadFile } from "@/services/s3";
import { db } from "@/lib/db";

async function updateUserAvatar(userId: string, imageFile: File) {
  // Upload to S3
  const result = await uploadFile(imageFile, imageFile.name, {
    folder: `users/${userId}/avatar`,
    metadata: {
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Update database
  await db
    .update(users)
    .set({ avatarUrl: result.publicUrl })
    .where(eq(users.id, userId));

  return result.publicUrl;
}
```

### Task Proof Upload

```typescript
import { uploadFile } from "@/services/s3";

async function uploadTaskProof(taskId: string, proofFile: File) {
  const result = await uploadFile(proofFile, proofFile.name, {
    folder: `tasks/${taskId}/proofs`,
    contentType: proofFile.type,
    metadata: {
      taskId,
      originalName: proofFile.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Save to database
  await db.insert(taskProofs).values({
    taskId,
    proofUrl: result.publicUrl,
    fileSize: result.size,
    fileName: proofFile.name,
  });

  return result;
}
```

### Batch Document Processing

```typescript
import { uploadFiles, uploadFromUrl } from "@/services/s3";

async function processDocuments(
  documents: Array<{ url: string; name: string }>,
) {
  // Download and upload external documents
  const uploadPromises = documents.map((doc) =>
    uploadFromUrl(doc.url, doc.name, {
      folder: "processed-documents",
      metadata: {
        source: "external",
        processedAt: new Date().toISOString(),
      },
    }),
  );

  const results = await Promise.all(uploadPromises);

  // Store results in database
  await db.insert(documents).values(
    results.map((result, index) => ({
      name: documents[index].name,
      url: result.publicUrl,
      key: result.key,
      size: result.size,
    })),
  );

  return results;
}
```

## Security

This service implements "security by obscurity" by:

1. **UUID Prefixing**: Every uploaded file gets a UUID prefix, making URLs unguessable
2. **No Directory Listing**: R2/S3 buckets don't allow directory browsing
3. **Direct Server Upload**: Files are uploaded directly from your server, not from clients

Example URL structure:

```
https://cdn.yourdomain.org/avatars/a1b2c3d4-5678-90ab-cdef-123456789012.jpg
```

## Content Type Detection

The service automatically detects content types for common file extensions:

- **Images**: jpg, jpeg, png, gif, webp, svg, ico
- **Documents**: pdf, doc, docx, xls, xlsx, ppt, pptx
- **Text**: txt, csv, json, xml
- **Media**: mp4, avi, mov, mp3, wav
- **Archives**: zip, rar, tar, gz

For unrecognized extensions, it defaults to `application/octet-stream`.

## Error Handling

All functions throw descriptive errors:

```typescript
try {
  const result = await uploadFile(file, filename);
} catch (error) {
  console.error("Upload failed:", error.message);
  // Handle specific error cases
}
```

## Performance Tips

1. **Parallel Uploads**: Use `uploadFiles()` for multiple files instead of sequential uploads
2. **Appropriate File Sizes**: Consider chunking very large files
3. **CDN Caching**: Your CDN endpoint should cache files for better performance
4. **Metadata**: Use metadata to store additional information without database queries

## Vercel Deployment

This service is optimized for Vercel:

- Uses environment variables that work with Vercel's system
- Handles Blob/File objects from Next.js API routes
- Supports streaming for efficient memory usage
- Works within Vercel's serverless function limits

## R2/S3 Bucket Configuration

Ensure your R2/S3 bucket is configured for public access:

1. **Public Access**: Enable public access for the bucket
2. **CORS**: Configure CORS if accessing from browser:
   ```json
   {
     "AllowedOrigins": ["*"],
     "AllowedMethods": ["GET"],
     "AllowedHeaders": ["*"]
   }
   ```
3. **Custom Domain**: Point your CDN domain to the R2/S3 bucket
