import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/services/s3/s3';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const result = await uploadFile(file, file.name, {
      folder: 'briefs',
    });

    return NextResponse.json({
      s3Url: result.publicUrl,
      s3Key: result.key,
      size: result.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}
