import { toast } from "sonner";
import Konva from "konva";
import { CanvasImage } from "@/stores/canvasStore";
import { transformImageUrl } from "@/lib/utils/image-transform";
import { Asset } from "@/config/assets";

interface GenerationContext {
  images: CanvasImage[];
  getImages: () => CanvasImage[]; // Get fresh images from store
  settings: {
    imageGenerationModel: string;
    imageEditingModel: string;
    defaultAspectRatio: string;
    caaEnabled: boolean;
    caaApproach: string;
    caaModel: string;
  };
  dimensions: { width: number; height: number };
  stagePosition: { x: number; y: number };
  zoom: number;
  selectedIndices: number[];
  addImage: (image: Omit<CanvasImage, "zIndex">) => void;
  updateImage: (index: number, updates: Partial<CanvasImage>) => void;
  setSelectedIndices: (indices: number[]) => void;
  deleteSelectedImages: () => void;
  getAllImageRefs: () => Map<
    number,
    Konva.Image | Konva.Group | Konva.Text | null
  >;
}

// Calculate bounding box for selected images
export function getSelectionBounds(
  selectedIndices: number[],
  getAllImageRefs: () => Map<
    number,
    Konva.Image | Konva.Group | Konva.Text | null
  >,
): { x: number; y: number; width: number; height: number } | null {
  if (selectedIndices.length === 0) return null;

  const imageRefsMap = getAllImageRefs();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  selectedIndices.forEach((index) => {
    const node = imageRefsMap.get(index);
    if (!node) return;

    // Use getClientRect with relativeTo stage to get correct coordinates
    const stage = node.getStage();
    if (!stage) return;

    const rect = node.getClientRect({ relativeTo: stage });

    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Helper: Create AI-generated post-it
export function createAIPostIt(
  text: string,
  position: { x: number; y: number } | undefined,
  addImage: (image: Omit<CanvasImage, "zIndex">) => void,
  selectedIndices: number[],
  getAllImageRefs: () => Map<
    number,
    Konva.Image | Konva.Group | Konva.Text | null
  >,
) {
  console.log("[PostIt] Creating AI post-it with text:", text.substring(0, 50) + "...");
  // Smart positioning: top-right of selected images bounding box
  const bounds = getSelectionBounds(selectedIndices, getAllImageRefs);

  const posX = position?.x ?? (bounds ? bounds.x + bounds.width + 20 : 200);
  const posY = position?.y ?? (bounds ? bounds.y : 200);
  console.log("[PostIt] Position calculated:", { posX, posY });

  // Create canvas with grey background
  const canvas = document.createElement("canvas");
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("[PostIt] Failed to get canvas context");
    return;
  }

  ctx.fillStyle = "#E8E8E8"; // Grey for AI post-its
  ctx.fillRect(0, 0, size, size);

  const dataUrl = canvas.toDataURL();
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = dataUrl;

  img.onload = () => {
    const postitId = crypto.randomUUID();
    console.log("[PostIt] Post-it image loaded, adding to canvas with id:", postitId);
    addImage({
      id: postitId,
      image: img,
      width: size,
      height: size,
      x: posX,
      y: posY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      sourceType: "postit",
      text: text,
      color: "#E8E8E8",
      isAIGenerated: true,
      s3Url: dataUrl,
    });
    console.log("[PostIt] Post-it added successfully");
  };
}

// Helper: Generate image with given prompt
export async function generateImageWithPrompt(
  enhancedPrompt: string,
  ctx: GenerationContext,
) {
  console.log("[Generate] Starting generation with prompt:", enhancedPrompt);
  const model = ctx.settings.imageGenerationModel;
  const aspectRatio = ctx.settings.defaultAspectRatio;

  // Always use square placeholder
  const placeholderPath = "/loading/generating_1x1.png";
  const width = 400;
  const height = 400;

  const imageId = crypto.randomUUID();
  console.log("[Generate] Created imageId:", imageId);

  // Calculate position in visible viewport
  const centerX = (ctx.dimensions.width / 2 - ctx.stagePosition.x) / ctx.zoom;
  const centerY = (ctx.dimensions.height / 2 - ctx.stagePosition.y) / ctx.zoom;

  // Add random offset to avoid stacking
  const offsetX = (Math.random() - 0.5) * 200;
  const offsetY = (Math.random() - 0.5) * 200;

  const x = centerX + offsetX - width / 2;
  const y = centerY + offsetY - height / 2;

  // Load placeholder PNG
  const placeholderImage = new window.Image();
  placeholderImage.crossOrigin = "anonymous";
  placeholderImage.src = placeholderPath;

  placeholderImage.onload = () => {
    console.log("[Generate] Placeholder loaded, adding to canvas with id:", imageId);
    ctx.addImage({
      id: imageId,
      image: placeholderImage,
      width,
      height,
      isGenerating: true,
      sourceType: "generated",
      prompt: enhancedPrompt,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    console.log("[Generate] Current images array length:", ctx.images.length);

    // Generate image in background
    (async () => {
      try {
        console.log("[Generate] Calling /api/generate");
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            model,
            aspectRatio,
          }),
        });

        const data = await response.json();
        console.log("[Generate] API response:", { ok: response.ok, hasImageUrl: !!data.imageUrl });

        if (response.ok) {
          const generatedImg = new window.Image();
          generatedImg.crossOrigin = "anonymous";
          generatedImg.src = data.imageUrl;
          generatedImg.onload = () => {
            console.log("[Generate] Generated image loaded, finding placeholder by id:", imageId);
            const MAX_SIZE = 500;
            const scale = Math.min(
              1,
              MAX_SIZE / Math.max(generatedImg.width, generatedImg.height),
            );
            const scaledWidth = generatedImg.width * scale;
            const scaledHeight = generatedImg.height * scale;

            // Find image by ID instead of using stale index
            const currentImages = ctx.getImages(); // Get fresh images from store
            const imageIndex = currentImages.findIndex((img) => img.id === imageId);
            console.log("[Generate] Found placeholder at index:", imageIndex, "out of", currentImages.length);
            if (imageIndex !== -1) {
              console.log("[Generate] Updating image at index", imageIndex);
              ctx.updateImage(imageIndex, {
                image: generatedImg,
                s3Url: data.imageUrl,
                s3Key: data.key,
                isGenerating: false,
                width: scaledWidth,
                height: scaledHeight,
              });
              toast.success("Image generated successfully!");
            } else {
              console.error("[Generate] ERROR: Could not find image with id:", imageId);
              console.log("[Generate] Available image IDs:", currentImages.map(img => img.id));
            }
          };
        } else {
          console.error("[Generate] API error:", data.error);
          // Find and delete by ID
          const currentImages = ctx.getImages();
          const imageIndex = currentImages.findIndex((img) => img.id === imageId);
          if (imageIndex !== -1) {
            ctx.setSelectedIndices([imageIndex]);
            setTimeout(() => ctx.deleteSelectedImages(), 0);
          }
          toast.error(data.error || "Failed to generate image");
        }
      } catch (error) {
        console.error("[Generate] Exception:", error);
        // Find and delete by ID
        const currentImages = ctx.getImages();
        const imageIndex = currentImages.findIndex((img) => img.id === imageId);
        if (imageIndex !== -1) {
          ctx.setSelectedIndices([imageIndex]);
          setTimeout(() => ctx.deleteSelectedImages(), 0);
        }
        toast.error("Failed to generate image");
      }
    })();
  };
}

// Helper: Edit images with given prompt and inputs
export async function editImagesWithPrompt(
  enhancedPrompt: string,
  imageInputs: string[],
  ctx: GenerationContext,
) {
  console.log("[Edit] Starting edit with prompt:", enhancedPrompt, "imageInputs:", imageInputs.length);
  const editingModel = ctx.settings.imageEditingModel;

  // Validate flux-kontext with multiple images
  if (editingModel === "flux-kontext" && imageInputs.length > 1) {
    toast.error(
      "flux-kontext only supports 1 reference image. Please select only 1 image or use nano-banana.",
    );
    return;
  }

  const placeholderPath = "/loading/generating_1x1.png";
  const width = 400;
  const height = 400;

  const imageId = crypto.randomUUID();
  console.log("[Edit] Created imageId:", imageId);

  // Calculate position in visible viewport
  const centerX = (ctx.dimensions.width / 2 - ctx.stagePosition.x) / ctx.zoom;
  const centerY = (ctx.dimensions.height / 2 - ctx.stagePosition.y) / ctx.zoom;

  const offsetX = (Math.random() - 0.5) * 200;
  const offsetY = (Math.random() - 0.5) * 200;

  const x = centerX + offsetX - width / 2;
  const y = centerY + offsetY - height / 2;

  const placeholderImage = new window.Image();
  placeholderImage.crossOrigin = "anonymous";
  placeholderImage.src = placeholderPath;

  placeholderImage.onload = () => {
    console.log("[Edit] Placeholder loaded, adding to canvas with id:", imageId);
    ctx.addImage({
      id: imageId,
      image: placeholderImage,
      width,
      height,
      isGenerating: true,
      sourceType: "edited",
      prompt: enhancedPrompt,
      sourceImages: imageInputs,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    console.log("[Edit] Current images array length:", ctx.images.length);

    // Edit image in background
    (async () => {
      try {
        console.log("[Edit] Calling /api/edit");
        const response = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            imageInputs,
            model: editingModel,
          }),
        });

        const data = await response.json();
        console.log("[Edit] API response:", { ok: response.ok, hasImageUrl: !!data.imageUrl });

        if (response.ok) {
          const editedImg = new window.Image();
          editedImg.crossOrigin = "anonymous";
          editedImg.src = data.imageUrl;
          editedImg.onload = () => {
            console.log("[Edit] Edited image loaded, finding placeholder by id:", imageId);
            const MAX_SIZE = 500;
            const scale = Math.min(
              1,
              MAX_SIZE / Math.max(editedImg.width, editedImg.height),
            );
            const scaledWidth = editedImg.width * scale;
            const scaledHeight = editedImg.height * scale;

            // Find image by ID instead of using stale index
            const currentImages = ctx.getImages(); // Get fresh images from store
            const imageIndex = currentImages.findIndex((img) => img.id === imageId);
            console.log("[Edit] Found placeholder at index:", imageIndex, "out of", currentImages.length);
            if (imageIndex !== -1) {
              console.log("[Edit] Updating image at index", imageIndex);
              ctx.updateImage(imageIndex, {
                image: editedImg,
                s3Url: data.imageUrl,
                s3Key: data.key,
                isGenerating: false,
                width: scaledWidth,
                height: scaledHeight,
              });
              toast.success("Image edited successfully!");
            } else {
              console.error("[Edit] ERROR: Could not find image with id:", imageId);
              console.log("[Edit] Available image IDs:", currentImages.map(img => img.id));
            }
          };
        } else {
          console.error("[Edit] API error:", data.error);
          // Find and delete by ID
          const currentImages = ctx.getImages();
          const imageIndex = currentImages.findIndex((img) => img.id === imageId);
          if (imageIndex !== -1) {
            ctx.setSelectedIndices([imageIndex]);
            setTimeout(() => ctx.deleteSelectedImages(), 0);
          }
          toast.error(data.error || "Failed to edit image");
        }
      } catch (error) {
        console.error("[Edit] Exception:", error);
        // Find and delete by ID
        const currentImages = ctx.getImages();
        const imageIndex = currentImages.findIndex((img) => img.id === imageId);
        if (imageIndex !== -1) {
          ctx.setSelectedIndices([imageIndex]);
          setTimeout(() => ctx.deleteSelectedImages(), 0);
        }
        toast.error("Failed to edit image");
      }
    })();
  };
}

export async function handleGenerateImage(
  prompt: string,
  briefName: string,
  briefDescription: string,
  getAllAssets: () => Asset[],
  ctx: GenerationContext,
) {
  if (!prompt.trim()) return;

  const promptText = prompt;

  // Gather selected images and post-its
  const selectedImages = ctx.selectedIndices
    .map((index) => ctx.images[index])
    .filter(
      (img) =>
        img &&
        img.s3Url &&
        img.sourceType !== "postit" &&
        img.sourceType !== "sticker",
    );

  const selectedPostits = ctx.selectedIndices
    .map((index) => ctx.images[index])
    .filter((img) => img?.sourceType === "postit")
    .map((img) => ({
      id: img.id,
      text: img.text || "",
      color: img.color || "",
    }));

  // If Creative Assistant is enabled, route through CAA
  if (ctx.settings.caaEnabled) {
    try {
      // Show loading toast
      toast.loading("✨ Creative Assistant working...", {
        id: "creative-assistant",
      });

      const caaResponse = await fetch("/api/caa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            userPrompt: promptText,
            briefName,
            briefDescription,
            selectedImages: selectedImages.map((img) => ({
              id: img.id,
              s3Url: img.s3Url!,
              prompt: img.prompt,
              sourceType: img.sourceType,
              transformedUrl: transformImageUrl(img.s3Url!, {
                width: 1024,
                height: 1024,
                fit: "scale-down",
              }),
            })),
            selectedPostits,
            availableAssets: getAllAssets(),
            settings: {
              approach: ctx.settings.caaApproach,
              model: ctx.settings.caaModel,
              imageGenerationModel: ctx.settings.imageGenerationModel,
              imageEditingModel: ctx.settings.imageEditingModel,
            },
          },
        }),
      });

      const caaData = await caaResponse.json();

      console.log("[CAA] Response received:", {
        action: caaData.action,
        hasPostit: !!caaData.postit,
        hasEnhancedPrompt: !!caaData.enhancedPrompt,
        hasImageInputs: !!caaData.imageInputs,
      });

      // Dismiss loading toast
      toast.dismiss("creative-assistant");

      if (!caaResponse.ok) {
        toast.error(caaData.error || "Creative Assistant failed");
        return;
      }

      // Handle Creative Assistant response
      if (caaData.action === "answer") {
        console.log("[CAA] Action: answer - creating post-it only");
        // Create AI post-it with answer (position calculated automatically)
        createAIPostIt(
          caaData.postit.text,
          undefined,
          ctx.addImage,
          ctx.selectedIndices,
          ctx.getAllImageRefs,
        );
        return;
      }

      if (caaData.postit) {
        console.log("[CAA] Creating post-it with text:", caaData.postit.text);
        // Create explanatory post-it (position calculated automatically)
        createAIPostIt(
          caaData.postit.text,
          undefined,
          ctx.addImage,
          ctx.selectedIndices,
          ctx.getAllImageRefs,
        );
      }

      // Continue with generation/editing using enhanced prompt
      if (
        caaData.action === "generate" ||
        caaData.action === "generate_and_note"
      ) {
        console.log("[CAA] Calling generateImageWithPrompt");
        // Use enhanced prompt for generation
        await generateImageWithPrompt(caaData.enhancedPrompt, ctx);
      } else if (caaData.action === "edit") {
        console.log("[CAA] Calling editImagesWithPrompt");
        // Use enhanced prompt and imageInputs for editing
        await editImagesWithPrompt(
          caaData.enhancedPrompt,
          caaData.imageInputs || selectedImages.map((img) => img.s3Url!),
          ctx,
        );
      }

      return;
    } catch (error) {
      toast.dismiss("creative-assistant");
      console.error("Creative Assistant error:", error);
      toast.error("Creative Assistant failed");
      return;
    }
  }

  // Original flow (CAA disabled)

  // Check if we're editing (images selected) or generating
  const editableImages = ctx.selectedIndices
    .map((index) => ctx.images[index])
    .filter(
      (img) =>
        img &&
        img.s3Url &&
        img.sourceType !== "postit" &&
        img.sourceType !== "sticker",
    );

  const isEditing = editableImages.length > 0;

  // Validate: check if any selected images are still uploading/generating
  const hasUploadingImages = ctx.selectedIndices.some((index) => {
    const img = ctx.images[index];
    return img && (img.uploading || img.isGenerating);
  });

  if (hasUploadingImages) {
    toast.error("Please wait for images to finish uploading/generating");
    return;
  }

  if (isEditing) {
    // IMAGE EDITING MODE
    // Convert all images to JPEG format (nano-banana doesn't support transparent PNGs)
    const imageInputs = editableImages.map((img) =>
      transformImageUrl(img.s3Url!, { format: "jpeg" }),
    );
    console.log(
      "Editing with images:",
      editableImages.map((img) => ({
        sourceType: img.sourceType,
        url: img.s3Url,
      })),
    );
    await editImagesWithPrompt(promptText, imageInputs, ctx);
  } else {
    // IMAGE GENERATION MODE
    await generateImageWithPrompt(promptText, ctx);
  }
}
