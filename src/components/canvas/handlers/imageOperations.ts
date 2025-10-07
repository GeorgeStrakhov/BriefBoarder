import { toast } from "sonner";
import { CanvasImage } from "@/stores/canvasStore";

export async function handleUpscale(
  selectedIndices: number[],
  images: CanvasImage[],
  getImages: () => CanvasImage[], // Get fresh images from store
  updateImage: (index: number, updates: Partial<CanvasImage>) => void,
  upscalingModel: string,
) {
  if (selectedIndices.length !== 1) return;

  const imageIndex = selectedIndices[0];
  const imageData = images[imageIndex];
  if (!imageData?.s3Url) return;

  const imageId = imageData.id; // Store ID for later lookup

  // Check if already upscaling
  if (imageData.isUpscaling) {
    toast.error("Image is already being upscaled");
    return;
  }

  // Set upscaling state
  updateImage(imageIndex, { isUpscaling: true });

  try {
    const response = await fetch("/api/upscale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: imageData.s3Url,
        model: upscalingModel,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Load the upscaled image
      const upscaledImg = new window.Image();
      upscaledImg.crossOrigin = "anonymous";
      upscaledImg.src = data.imageUrl;
      upscaledImg.onload = () => {
        // Find image by ID in case array changed
        const currentImages = getImages();
        const currentIndex = currentImages.findIndex(
          (img) => img.id === imageId,
        );
        if (currentIndex === -1) return; // Image was deleted

        // Update image with upscaled version, keeping transforms
        updateImage(currentIndex, {
          image: upscaledImg,
          s3Url: data.imageUrl,
          s3Key: data.key,
          isUpscaling: false,
          // Keep existing transform properties
        });
        toast.success("Image upscaled successfully!");
      };
    } else {
      // Find image by ID for error case too
      const currentImages = getImages();
      const currentIndex = currentImages.findIndex((img) => img.id === imageId);
      if (currentIndex !== -1) {
        updateImage(currentIndex, { isUpscaling: false });
      }
      toast.error(data.error || "Failed to upscale image");
    }
  } catch (error) {
    console.error("Upscale error:", error);
    // Find image by ID for error case
    const currentImages = getImages();
    const currentIndex = currentImages.findIndex((img) => img.id === imageId);
    if (currentIndex !== -1) {
      updateImage(currentIndex, { isUpscaling: false });
    }
    toast.error("Failed to upscale image");
  }
}

export async function handleRemoveBackground(
  selectedIndices: number[],
  images: CanvasImage[],
  getImages: () => CanvasImage[], // Get fresh images from store
  updateImage: (index: number, updates: Partial<CanvasImage>) => void,
) {
  if (selectedIndices.length !== 1) return;

  const imageIndex = selectedIndices[0];
  const imageData = images[imageIndex];
  if (!imageData?.s3Url) return;

  const imageId = imageData.id; // Store ID for later lookup

  // Check if already removing background
  if (imageData.isRemovingBackground) {
    toast.error("Background removal already in progress");
    return;
  }

  // Set removing background state
  updateImage(imageIndex, { isRemovingBackground: true });

  try {
    const response = await fetch("/api/remove-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: imageData.s3Url,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Load the image with removed background
      const processedImg = new window.Image();
      processedImg.crossOrigin = "anonymous";
      processedImg.src = data.imageUrl;
      processedImg.onload = () => {
        // Find image by ID in case array changed
        const currentImages = getImages();
        const currentIndex = currentImages.findIndex(
          (img) => img.id === imageId,
        );
        if (currentIndex === -1) return; // Image was deleted

        // Update image with processed version, keeping transforms
        updateImage(currentIndex, {
          image: processedImg,
          s3Url: data.imageUrl,
          s3Key: data.key,
          isRemovingBackground: false,
          // Keep existing transform properties
        });
        toast.success("Background removed successfully!");
      };
    } else {
      // Find image by ID for error case too
      const currentImages = getImages();
      const currentIndex = currentImages.findIndex((img) => img.id === imageId);
      if (currentIndex !== -1) {
        updateImage(currentIndex, { isRemovingBackground: false });
      }
      toast.error(data.error || "Failed to remove background");
    }
  } catch (error) {
    console.error("Remove background error:", error);
    // Find image by ID for error case
    const currentImages = getImages();
    const currentIndex = currentImages.findIndex((img) => img.id === imageId);
    if (currentIndex !== -1) {
      updateImage(currentIndex, { isRemovingBackground: false });
    }
    toast.error("Failed to remove background");
  }
}

export async function handleDownload(
  selectedIndices: number[],
  images: CanvasImage[],
) {
  if (selectedIndices.length !== 1) return;

  const imageData = images[selectedIndices[0]];
  if (!imageData?.s3Url) return;

  try {
    const response = await fetch(imageData.s3Url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `image-${imageData.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download failed:", error);
    toast.error("Failed to download image");
  }
}

export async function handleCopyUrl(
  selectedIndices: number[],
  images: CanvasImage[],
) {
  if (selectedIndices.length !== 1) return;

  const imageData = images[selectedIndices[0]];
  if (!imageData?.s3Url) return;

  try {
    await navigator.clipboard.writeText(imageData.s3Url);
    toast.success("URL copied to clipboard");
  } catch (error) {
    console.error("Copy failed:", error);
    toast.error("Failed to copy URL");
  }
}

export async function handleCopyPrompt(
  selectedIndices: number[],
  images: CanvasImage[],
) {
  if (selectedIndices.length !== 1) return;

  const imageData = images[selectedIndices[0]];
  if (!imageData?.prompt) return;

  try {
    await navigator.clipboard.writeText(imageData.prompt);
    toast.success("Prompt copied to clipboard");
  } catch (error) {
    console.error("Copy failed:", error);
    toast.error("Failed to copy prompt");
  }
}
