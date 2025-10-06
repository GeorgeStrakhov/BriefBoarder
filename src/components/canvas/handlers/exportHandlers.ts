import { toast } from "sonner";
import Konva from "konva";
import { CanvasImage, useCanvasStore } from "@/stores/canvasStore";

interface ExportContext {
  stageRef: React.RefObject<Konva.Stage | null>;
  transformerRef: React.RefObject<Konva.Transformer | null>;
  images: CanvasImage[];
  selectedIndices: number[];
  getAllImageRefs: () => Map<
    number,
    Konva.Image | Konva.Group | Konva.Text | null
  >;
  addImage: (image: Omit<CanvasImage, "zIndex">) => void;
  setSelectedIndices: (indices: number[]) => void;
}

// Helper: Calculate bounding box with rotation support
function calculateBoundingBox(
  imagesToProcess: { img: CanvasImage; index?: number }[],
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  imagesToProcess.forEach(({ img }) => {
    const imgX = img.x || 0;
    const imgY = img.y || 0;
    const imgWidth = img.width * (img.scaleX || 1);
    const imgHeight = img.height * (img.scaleY || 1);
    const rotation = img.rotation || 0;

    // For rotated images, calculate the bounding box
    if (rotation !== 0) {
      const centerX = imgX + imgWidth / 2;
      const centerY = imgY + imgHeight / 2;
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const corners = [
        { x: imgX, y: imgY },
        { x: imgX + imgWidth, y: imgY },
        { x: imgX + imgWidth, y: imgY + imgHeight },
        { x: imgX, y: imgY + imgHeight },
      ];

      corners.forEach((corner) => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        const rotatedX = centerX + (dx * cos - dy * sin);
        const rotatedY = centerY + (dx * sin + dy * cos);

        minX = Math.min(minX, rotatedX);
        minY = Math.min(minY, rotatedY);
        maxX = Math.max(maxX, rotatedX);
        maxY = Math.max(maxY, rotatedY);
      });
    } else {
      // No rotation, simple bounding box
      minX = Math.min(minX, imgX);
      minY = Math.min(minY, imgY);
      maxX = Math.max(maxX, imgX + imgWidth);
      maxY = Math.max(maxY, imgY + imgHeight);
    }
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export async function handleDownloadBoard(
  includeReactions: boolean,
  ctx: ExportContext,
) {
  if (!ctx.stageRef.current || ctx.images.length === 0) {
    toast.error("No images to download");
    return;
  }

  try {
    const stage = ctx.stageRef.current;
    const layer = stage.getLayers()[0]; // Get the first (and only) layer
    const imageRefsMap = ctx.getAllImageRefs();
    const { briefId } = useCanvasStore.getState();

    // Filter images based on includeReactions parameter
    // Always include assets, only exclude reactions if includeReactions is false
    const exportableImages = ctx.images
      .map((img, index) => ({ img, index }))
      .filter(
        ({ img }) =>
          includeReactions ||
          (img.sourceType !== "sticker" && img.sourceType !== "postit"),
      );

    if (exportableImages.length === 0) {
      toast.error("No images to download");
      return;
    }

    // Calculate bounding box of all exportable images (accounting for rotation)
    const bbox = calculateBoundingBox(exportableImages);

    // Add some padding
    const padding = 50;
    const minX = bbox.minX - padding;
    const minY = bbox.minY - padding;
    const exportWidth = bbox.width + padding * 2;
    const exportHeight = bbox.height + padding * 2;

    // Save current stage transforms
    const originalScale = stage.scaleX();
    const originalPosition = { x: stage.x(), y: stage.y() };

    // Temporarily hide reactions if not including them
    const hiddenIndices: number[] = [];
    if (!includeReactions) {
      ctx.images.forEach((img, index) => {
        if (img.sourceType === "sticker" || img.sourceType === "postit") {
          hiddenIndices.push(index);
          const node = imageRefsMap.get(index);
          if (node) node.visible(false);
        }
      });
    }

    // Reset stage transforms for export
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    layer.batchDraw(); // Force redraw with new transforms

    // Wait a frame to ensure layer has fully redrawn
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Export from the LAYER with transforms reset (always use 2x quality)
    const dataURL = layer.toDataURL({
      x: minX,
      y: minY,
      width: exportWidth,
      height: exportHeight,
      pixelRatio: 2,
    });

    // Restore stage transforms
    stage.scale({ x: originalScale, y: originalScale });
    stage.position(originalPosition);

    // Restore visibility of hidden items
    hiddenIndices.forEach((index) => {
      const node = imageRefsMap.get(index);
      if (node) node.visible(true);
    });

    layer.batchDraw(); // Redraw with restored transforms

    // Trigger download
    const link = document.createElement("a");
    const filename = briefId
      ? `board-${includeReactions ? "and-notes-" : ""}${briefId}.png`
      : `board${includeReactions ? "-with-notes" : ""}.png`;
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(
      includeReactions ? "Board downloaded with notes!" : "Board downloaded!",
    );
  } catch (error) {
    console.error("Download board error:", error);
    toast.error("Failed to download board");
  }
}

export async function handleMergeSelection(ctx: ExportContext) {
  if (!ctx.stageRef.current || ctx.selectedIndices.length < 2) {
    toast.error("Please select at least 2 items to merge");
    return;
  }

  try {
    const stage = ctx.stageRef.current;
    const layer = stage.getLayers()[0];
    const imageRefsMap = ctx.getAllImageRefs();

    // Get selected images
    const selectedImages = ctx.selectedIndices
      .map((index) => ({ img: ctx.images[index], index }))
      .filter(({ img }) => img !== undefined);

    if (selectedImages.length === 0) {
      toast.error("No valid items selected");
      return;
    }

    // Calculate bounding box of selected items (accounting for rotation)
    const bbox = calculateBoundingBox(selectedImages);

    // No padding for merge (tight crop)
    const exportWidth = bbox.width;
    const exportHeight = bbox.height;

    // Save current stage transforms
    const originalScale = stage.scaleX();
    const originalPosition = { x: stage.x(), y: stage.y() };

    // Temporarily hide non-selected items
    const hiddenIndices: number[] = [];
    ctx.images.forEach((_, index) => {
      if (!ctx.selectedIndices.includes(index)) {
        hiddenIndices.push(index);
        const node = imageRefsMap.get(index);
        if (node) node.visible(false);
      }
    });

    // Hide transformer
    if (ctx.transformerRef.current) {
      ctx.transformerRef.current.visible(false);
    }

    // Temporarily clear selection to remove blue outlines
    const savedSelection = [...ctx.selectedIndices];
    ctx.setSelectedIndices([]);

    // Reset stage transforms for export
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    layer.batchDraw();

    // Wait a frame for redraw
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Export from the layer with high quality (3x for crisp results)
    const dataURL = layer.toDataURL({
      x: bbox.minX,
      y: bbox.minY,
      width: exportWidth,
      height: exportHeight,
      pixelRatio: 3,
    });

    // Restore stage transforms
    stage.scale({ x: originalScale, y: originalScale });
    stage.position(originalPosition);

    // Restore visibility
    hiddenIndices.forEach((index) => {
      const node = imageRefsMap.get(index);
      if (node) node.visible(true);
    });

    // Restore transformer
    if (ctx.transformerRef.current) {
      ctx.transformerRef.current.visible(true);
    }

    // Restore selection
    ctx.setSelectedIndices(savedSelection);

    layer.batchDraw();

    // Convert dataURL to blob
    const response = await fetch(dataURL);
    const blob = await response.blob();

    // Upload to S3
    const formData = new FormData();
    formData.append("file", blob, "merged.png");

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const uploadData = await uploadResponse.json();

    if (uploadResponse.ok) {
      // Load the merged image
      const mergedImg = new window.Image();
      mergedImg.crossOrigin = "anonymous";
      mergedImg.src = uploadData.s3Url;
      mergedImg.onload = () => {
        // Place new image near the selection (offset by 50px)
        ctx.addImage({
          id: crypto.randomUUID(),
          image: mergedImg,
          width: exportWidth,
          height: exportHeight,
          x: bbox.minX + 50,
          y: bbox.minY + 50,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          sourceType: "uploaded",
          s3Url: uploadData.s3Url,
          s3Key: uploadData.s3Key,
        });
        toast.success("Selection merged successfully!");
      };
    } else {
      toast.error(uploadData.error || "Failed to upload merged image");
    }
  } catch (error) {
    console.error("Merge selection error:", error);
    toast.error("Failed to merge selection");
  }
}
