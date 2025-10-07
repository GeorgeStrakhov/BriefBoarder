import Replicate from "replicate";
import { uploadFromUrl } from "@/lib/services/s3";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Model registry with abstraction layer
interface ModelConfig {
  replicateId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildInput: (prompt: string, aspectRatio: string) => Record<string, any>;
}

const IMAGE_GENERATION_MODELS: Record<string, ModelConfig> = {
  "imagen-4-ultra": {
    replicateId: "google/imagen-4-ultra",
    buildInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio,
      output_format: "png" as const,
      safety_filter_level: "block_only_high" as const,
    }),
  },
  "flux-pro-1-1": {
    replicateId: "black-forest-labs/flux-1.1-pro",
    buildInput: (prompt, aspectRatio) => ({
      prompt,
      aspect_ratio: aspectRatio,
      output_format: "webp" as const,
      output_quality: 80,
      safety_tolerance: 2,
      prompt_upsampling: true,
    }),
  },
  "flux-schnell": {
    replicateId: "black-forest-labs/flux-schnell",
    buildInput: (prompt, aspectRatio) => ({
      prompt,
      go_fast: true,
      megapixels: "1",
      num_outputs: 1,
      aspect_ratio: aspectRatio,
      output_format: "webp" as const,
      output_quality: 80,
      num_inference_steps: 4,
    }),
  },
};

export interface ImageGenerationOptions {
  prompt: string;
  model?: string; // Model name from registry
  aspectRatio?: "1:1" | "16:9" | "9:16";
  folder?: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  key: string;
  size: number;
}

// Image editing model registry
interface EditingModelConfig {
  replicateId: string;
  maxImages: number;
  buildInput: (
    prompt: string,
    imageInputs: string[],
    outputFormat: string,
    aspectRatio?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Record<string, any>;
}

const IMAGE_EDITING_MODELS: Record<string, EditingModelConfig> = {
  "nano-banana": {
    replicateId: "google/nano-banana",
    maxImages: 8,
    buildInput: (prompt, imageInputs, outputFormat, aspectRatio) => ({
      prompt,
      image_input: imageInputs,
      aspect_ratio: aspectRatio || "match_input_image",
      output_format: outputFormat,
    }),
  },
  "flux-kontext": {
    replicateId: "black-forest-labs/flux-kontext-pro",
    maxImages: 1,
    buildInput: (prompt, imageInputs, outputFormat, aspectRatio) => ({
      prompt,
      input_image: imageInputs[0], // Only takes one image
      aspect_ratio: aspectRatio || "match_input_image",
      output_format: outputFormat,
      safety_tolerance: 2,
      prompt_upsampling: false,
    }),
  },
};

export interface ImageEditingOptions {
  prompt: string;
  imageInputs: string[]; // Array of image URLs to edit
  model?: string; // Model name from registry
  outputFormat?: "jpg" | "png" | "webp";
  aspectRatio?: "1:1" | "16:9" | "9:16" | "match_input_image"; // Aspect ratio for output
  folder?: string;
}

export interface ImageEditingResult {
  imageUrl: string;
  key: string;
  size: number;
}

export async function generateImage(
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const {
    prompt,
    model = "imagen-4-ultra",
    aspectRatio = "1:1",
    folder = "generated-images",
  } = options;

  try {
    // Get model config from registry
    const modelConfig = IMAGE_GENERATION_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Build input using model-specific builder
    const input = modelConfig.buildInput(prompt, aspectRatio);

    // Run the model
    const output = await replicate.run(
      modelConfig.replicateId as `${string}/${string}`,
      { input },
    );

    // Handle different output formats (some models return arrays, some return objects)
    let replicateUrl: string;

    if (Array.isArray(output) && output.length > 0) {
      // flux-schnell returns an array
      const firstOutput = output[0];
      if (typeof firstOutput === "object" && "url" in firstOutput) {
        replicateUrl = (firstOutput as { url(): string }).url();
      } else {
        throw new Error("Invalid array output format from Replicate API");
      }
    } else if (output && typeof output === "object" && "url" in output) {
      // imagen-4-ultra and flux-pro-1-1 return an object
      replicateUrl = (output as { url(): string }).url();
    } else {
      throw new Error("Invalid response from Replicate API");
    }

    if (!replicateUrl) {
      throw new Error("No image URL returned from Replicate");
    }

    // Determine file extension and content type based on model
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const isWebp = model === "flux-pro-1-1" || model === "flux-schnell";
    const extension = isWebp ? "webp" : "png";
    const contentType = isWebp ? "image/webp" : "image/png";
    const filename = `${model}-${timestamp}.${extension}`;

    const uploadResult = await uploadFromUrl(replicateUrl, filename, {
      folder,
      contentType,
    });

    return {
      imageUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      size: uploadResult.size,
    };
  } catch (error) {
    console.error("Image generation error:", error);
    throw new Error(
      `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function editImage(
  options: ImageEditingOptions,
): Promise<ImageEditingResult> {
  const {
    prompt,
    imageInputs,
    model = "nano-banana",
    outputFormat = "jpg",
    aspectRatio,
    folder = "edited-images",
  } = options;

  try {
    // Get model config from registry
    const modelConfig = IMAGE_EDITING_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unknown editing model: ${model}`);
    }

    // Validate image count
    if (imageInputs.length > modelConfig.maxImages) {
      throw new Error(
        `${model} supports maximum ${modelConfig.maxImages} image(s), but ${imageInputs.length} provided`,
      );
    }

    // Build input using model-specific builder
    const input = modelConfig.buildInput(
      prompt,
      imageInputs,
      outputFormat,
      aspectRatio,
    );

    console.log(`[editImage] Building input for ${model}:`, {
      aspectRatio: aspectRatio || "match_input_image (default)",
      outputFormat,
      imageCount: imageInputs.length,
    });

    // Run the model
    const output = await replicate.run(
      modelConfig.replicateId as `${string}/${string}`,
      { input },
    );

    if (!output || typeof output !== "object" || !("url" in output)) {
      throw new Error("Invalid response from Replicate API");
    }

    const replicateUrl = (output as { url(): string }).url();
    if (!replicateUrl) {
      throw new Error("No image URL returned from Replicate");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${model}-${timestamp}.${outputFormat}`;

    const uploadResult = await uploadFromUrl(replicateUrl, filename, {
      folder,
      contentType: `image/${outputFormat}`,
    });

    return {
      imageUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      size: uploadResult.size,
    };
  } catch (error) {
    console.error("Image editing error:", error);
    throw new Error(
      `Failed to edit image: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Helper to get max images for a model
export function getMaxImagesForModel(model: string): number {
  return IMAGE_EDITING_MODELS[model]?.maxImages ?? 1;
}

// Image upscaling model registry
interface UpscalingModelConfig {
  replicateId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildInput: (imageUrl: string) => Record<string, any>;
}

const IMAGE_UPSCALING_MODELS: Record<string, UpscalingModelConfig> = {
  "topaz-image-upscaler": {
    replicateId: "topazlabs/image-upscale",
    buildInput: (imageUrl) => ({
      image: imageUrl,
      enhance_model: "Low Resolution V2",
      output_format: "jpg",
      upscale_factor: "4x",
      face_enhancement: true,
      subject_detection: "Foreground",
      face_enhancement_strength: 0.8,
      face_enhancement_creativity: 0.5,
    }),
  },
  "clarity-upscaler": {
    replicateId:
      "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
    buildInput: (imageUrl) => ({
      seed: 1337,
      image: imageUrl,
      prompt:
        "masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>",
      dynamic: 6,
      handfix: "disabled",
      pattern: false,
      sharpen: 0,
      sd_model: "juggernaut_reborn.safetensors [338b85bc4f]",
      scheduler: "DPM++ 3M SDE Karras",
      creativity: 0.35,
      lora_links: "",
      downscaling: false,
      resemblance: 0.6,
      scale_factor: 2,
      tiling_width: 112,
      output_format: "png",
      tiling_height: 144,
      custom_sd_model: "",
      negative_prompt:
        "(worst quality, low quality, normal quality:2) JuggernautNegative-neg",
      num_inference_steps: 18,
      downscaling_resolution: 768,
    }),
  },
};

export interface ImageUpscalingOptions {
  imageUrl: string;
  model?: string;
  folder?: string;
}

export interface ImageUpscalingResult {
  imageUrl: string;
  key: string;
  size: number;
}

export async function upscaleImage(
  options: ImageUpscalingOptions,
): Promise<ImageUpscalingResult> {
  const {
    imageUrl,
    model = "topaz-image-upscaler",
    folder = "upscaled-images",
  } = options;

  try {
    // Get model config from registry
    const modelConfig = IMAGE_UPSCALING_MODELS[model];
    if (!modelConfig) {
      throw new Error(`Unknown upscaling model: ${model}`);
    }

    // Build input using model-specific builder
    const input = modelConfig.buildInput(imageUrl);

    // Run the model
    const output = await replicate.run(
      modelConfig.replicateId as `${string}/${string}`,
      { input },
    );

    // Handle different output formats (some models return arrays, some return objects)
    let replicateUrl: string;

    if (Array.isArray(output) && output.length > 0) {
      // clarity-upscaler returns an array
      const firstOutput = output[0];
      if (typeof firstOutput === "object" && "url" in firstOutput) {
        replicateUrl = (firstOutput as { url(): string }).url();
      } else {
        throw new Error("Invalid array output format from Replicate API");
      }
    } else if (output && typeof output === "object" && "url" in output) {
      // topaz-image-upscaler returns an object
      replicateUrl = (output as { url(): string }).url();
    } else {
      throw new Error("Invalid response from Replicate API");
    }

    if (!replicateUrl) {
      throw new Error("No image URL returned from Replicate");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = model === "clarity-upscaler" ? "png" : "jpg";
    const contentType =
      model === "clarity-upscaler" ? "image/png" : "image/jpeg";
    const filename = `${model}-${timestamp}.${extension}`;

    const uploadResult = await uploadFromUrl(replicateUrl, filename, {
      folder,
      contentType,
    });

    return {
      imageUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      size: uploadResult.size,
    };
  } catch (error) {
    console.error("Image upscaling error:", error);
    throw new Error(
      `Failed to upscale image: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Background removal
export interface RemoveBackgroundOptions {
  imageUrl: string;
  folder?: string;
}

export interface RemoveBackgroundResult {
  imageUrl: string;
  key: string;
  size: number;
}

export async function removeBackground(
  options: RemoveBackgroundOptions,
): Promise<RemoveBackgroundResult> {
  const { imageUrl, folder = "background-removed" } = options;

  try {
    const input = {
      image: imageUrl,
      content_moderation: false,
      preserve_partial_alpha: false,
    };

    const output = await replicate.run("bria/remove-background", { input });

    if (!output || typeof output !== "object" || !("url" in output)) {
      throw new Error("Invalid response from Replicate API");
    }

    const replicateUrl = (output as { url(): string }).url();
    if (!replicateUrl) {
      throw new Error("No image URL returned from Replicate");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `bg-removed-${timestamp}.png`;

    const uploadResult = await uploadFromUrl(replicateUrl, filename, {
      folder,
      contentType: "image/png",
    });

    return {
      imageUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      size: uploadResult.size,
    };
  } catch (error) {
    console.error("Background removal error:", error);
    throw new Error(
      `Failed to remove background: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
