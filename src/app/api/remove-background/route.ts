import { NextRequest, NextResponse } from 'next/server';
import { removeBackground } from '@/lib/services/replicate/replicate';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    const result = await removeBackground({
      imageUrl,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Remove background API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove background' },
      { status: 500 }
    );
  }
}
