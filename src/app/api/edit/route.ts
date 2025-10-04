import { NextRequest, NextResponse } from 'next/server';
import { editImage } from '@/lib/services/replicate/replicate';

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageInputs, model } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!imageInputs || !Array.isArray(imageInputs) || imageInputs.length === 0) {
      return NextResponse.json(
        { error: 'At least one image input is required' },
        { status: 400 }
      );
    }

    const result = await editImage({
      prompt,
      imageInputs,
      model,
      outputFormat: 'jpg',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Edit API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to edit image' },
      { status: 500 }
    );
  }
}
