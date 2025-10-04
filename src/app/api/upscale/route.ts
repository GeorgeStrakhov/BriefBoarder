import { NextRequest, NextResponse } from 'next/server';
import { upscaleImage } from '@/lib/services/replicate/replicate';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, model } = await request.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    const result = await upscaleImage({
      imageUrl,
      model: model || 'topaz-image-upscaler',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Upscale API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upscale image' },
      { status: 500 }
    );
  }
}
