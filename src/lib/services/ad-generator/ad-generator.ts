import { getRandomTrick } from "@/lib/services/caa/approaches/advertising-tricks";
import { getApproach } from "@/lib/services/caa/approaches/registry";
import { LLMClient } from "@/lib/services/caa/llm-client";
import {
  generateImage,
  editImage,
} from "@/lib/services/replicate/replicate";
import { Asset } from "@/config/assets";
import { transformImageUrl } from "@/lib/utils/image-transform";

export interface GenerateAdOptions {
  briefName: string;
  briefDescription: string;
  approach: string; // "simple" | "dramatic" | ...
  availableAssets: Asset[];
  preferredTypeface: string; // From user preferences
  aspectRatio?: "1:1" | "16:9" | "9:16"; // User's selected aspect ratio
  settings: {
    imageGenerationModel: string;
    imageEditingModel: string;
    caaModel: string; // LLM model
  };
}

export interface GeneratedAd {
  imageUrl: string; // Final composited ad (or just background if textPlacement is "integrated" or "none")
  s3Key: string;
  headline?: string; // Optional - may not have text
  textPlacement: "overlay" | "integrated" | "none";
  trick: {
    id: string;
    name: string;
  };
  reasoning: string;
}

export async function generateAd(
  options: GenerateAdOptions
): Promise<GeneratedAd> {
  console.log("\n=== AUTO AD GENERATION START ===");
  console.log("Options:", {
    briefName: options.briefName,
    briefDescription: options.briefDescription,
    approach: options.approach,
    preferredTypeface: options.preferredTypeface,
    aspectRatio: options.aspectRatio || "9:16 (default)",
    settings: options.settings,
    availableAssets: options.availableAssets.map((a) => ({
      name: a.name,
      label: a.label,
    })),
  });

  // 1. Pick random advertising trick
  const trick = getRandomTrick();
  console.log("\n[Step 1] Selected advertising trick:", {
    id: trick.id,
    name: trick.name,
    description: trick.description,
  });

  // 2. Get selected creative approach
  const approach = getApproach(options.approach);
  console.log("\n[Step 2] Selected approach:", {
    id: approach.id,
    name: approach.name,
  });

  // 3. Create LLM client
  const llm = new LLMClient(options.settings.caaModel);
  console.log("\n[Step 3] LLM client created with model:", options.settings.caaModel);

  // 4. Generate ad concept via approach
  console.log("\n[Step 4] Generating ad concept...");
  const concept = await approach.generateAutonomousAd(
    {
      briefName: options.briefName,
      briefDescription: options.briefDescription,
      trick,
      availableAssets: options.availableAssets,
      preferredTypeface: options.preferredTypeface,
      aspectRatio: options.aspectRatio || "9:16", // Pass user's selected aspect ratio
      settings: {
        imageGenerationModel: options.settings.imageGenerationModel,
        imageEditingModel: options.settings.imageEditingModel,
        model: options.settings.caaModel,
      },
    },
    llm
  );
  console.log("\n[Step 4] Ad concept generated:", {
    headline: concept.headline,
    imagePrompt: concept.imagePrompt,
    textPlacement: concept.textPlacement,
    aspectRatio: concept.aspectRatio,
    reasoning: concept.reasoning,
  });

  // 5. Generate background image
  console.log("\n[Step 5] Generating background image...");
  console.log("Image generation params:", {
    prompt: concept.imagePrompt,
    model: options.settings.imageGenerationModel,
    aspectRatio: concept.aspectRatio || "9:16",
  });

  const backgroundImage = await generateImage({
    prompt: concept.imagePrompt,
    model: options.settings.imageGenerationModel,
    aspectRatio: concept.aspectRatio || "9:16",
  });

  console.log("\n[Step 5] Background image generated:", {
    imageUrl: backgroundImage.imageUrl,
    s3Key: backgroundImage.key,
    size: backgroundImage.size,
  });

  // Validate background image aspect ratio
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log("\n[Step 5] Background image dimensions:", {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(3),
        expectedAspectRatio: "0.563 (9:16)",
      });
      resolve();
    };
    img.onerror = () => {
      console.error("Failed to load background image for validation");
      resolve();
    };
    img.src = backgroundImage.imageUrl;
  });

  // 6. Determine if we need compositing
  // If textPlacement is "integrated" or "none", we're done - just return the background
  console.log("\n[Step 6] Checking if compositing needed...");
  console.log("Text placement:", concept.textPlacement);

  if (
    concept.textPlacement === "integrated" ||
    concept.textPlacement === "none"
  ) {
    console.log("No compositing needed, returning background image as-is");
    console.log("\n=== AUTO AD GENERATION COMPLETE ===\n");
    return {
      imageUrl: backgroundImage.imageUrl,
      s3Key: backgroundImage.key,
      headline: concept.headline,
      textPlacement: concept.textPlacement,
      trick: {
        id: trick.id,
        name: trick.name,
      },
      reasoning: concept.reasoning,
    };
  }

  // 7. Composite with nano-banana (textPlacement === "overlay")
  console.log("\n[Step 7] Compositing with nano-banana...");
  const logo = options.availableAssets.find((a) => a.name === "logo");
  console.log("Logo asset found:", logo ? `Yes (${logo.name})` : "No");

  // IMPORTANT: nano-banana doesn't support transparent PNGs
  // Transform all images to JPEG format via Cloudflare transformation
  const backgroundJpeg = transformImageUrl(backgroundImage.imageUrl, {
    format: "jpeg",
    quality: 90,
  });
  console.log("Background image transformed:", {
    original: backgroundImage.imageUrl,
    jpeg: backgroundJpeg,
  });

  const imageInputs = [backgroundJpeg];
  if (logo) {
    const logoJpeg = transformImageUrl(logo.url, {
      format: "jpeg",
      quality: 90,
    });
    console.log("Logo image transformed:", {
      original: logo.url,
      jpeg: logoJpeg,
    });
    imageInputs.push(logoJpeg);
  }

  // Build composite prompt with explicit image references
  const compositePrompt = logo
    ? `Create a mobile advertisement layout:

INPUT IMAGES:
- First image: Background/main visual (use as-is, maintain its style and composition)
- Second image: Logo (place this logo subtly in the bottom corner)

LAYOUT REQUIREMENTS:
${concept.headline ? `- Add headline text: "${concept.headline}"` : ""}
${concept.headline ? `- Use ${options.preferredTypeface} typeface for the headline` : ""}
${concept.headline ? "- Place headline prominently with excellent legibility and contrast" : ""}
- Place the logo from the second image subtly in the bottom corner
- Maintain the overall mood and style of the background image
- Ensure professional, polished appearance
- DO NOT generate a new logo - use the exact logo from the second input image`
    : `Create a mobile advertisement layout with:
${concept.headline ? `- Headline text: "${concept.headline}"` : ""}
${concept.headline ? `- Use ${options.preferredTypeface} typeface for the headline` : ""}
${concept.headline ? "- Place headline prominently with excellent legibility and contrast" : ""}
- Maintain the overall mood and style of the background image
- Ensure professional, polished appearance`;

  console.log("Composite prompt:", compositePrompt);
  console.log("Image inputs (JPEG transformed):", imageInputs);
  console.log("Editing model:", options.settings.imageEditingModel);

  const finalAd = await editImage({
    prompt: compositePrompt,
    imageInputs,
    model: options.settings.imageEditingModel, // nano-banana
    outputFormat: "jpg", // JPEG format (nano-banana doesn't support transparent PNGs well)
    aspectRatio: concept.aspectRatio || "9:16", // Explicitly enforce aspect ratio
  });

  console.log("\n[Step 7] Final ad composited:", {
    imageUrl: finalAd.imageUrl,
    s3Key: finalAd.key,
    size: finalAd.size,
  });

  // Validate aspect ratio by loading the image
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log("\n[Step 7] Final ad image dimensions:", {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(3),
        expectedAspectRatio: "0.563 (9:16)",
      });
      resolve();
    };
    img.onerror = () => {
      console.error("Failed to load final ad image for validation");
      resolve();
    };
    img.src = finalAd.imageUrl;
  });

  console.log("\n=== AUTO AD GENERATION COMPLETE ===\n");

  return {
    imageUrl: finalAd.imageUrl,
    s3Key: finalAd.key,
    headline: concept.headline,
    textPlacement: concept.textPlacement,
    trick: {
      id: trick.id,
      name: trick.name,
    },
    reasoning: concept.reasoning,
  };
}
