import { toast } from "sonner";
import Konva from "konva";
import { CanvasImage } from "@/stores/canvasStore";

interface DropContext {
  stageRef: React.RefObject<Konva.Stage | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  images: CanvasImage[];
  addImage: (image: Omit<CanvasImage, "zIndex">) => void;
  updateImage: (index: number, updates: Partial<CanvasImage>) => void;
  setTextDropPosition: (pos: { x: number; y: number } | null) => void;
  setPostItDropPosition: (pos: { x: number; y: number } | null) => void;
  handleCreateText: () => void;
  handleCreatePostIt: () => void;
}

// Helper to get stage coordinates from drag event
function getStageCoordinates(
  e: React.DragEvent,
  containerRef: React.RefObject<HTMLDivElement | null>,
  stageRef: React.RefObject<Konva.Stage | null>,
  zoom: number,
): { x: number; y: number } | null {
  if (!stageRef.current || !containerRef.current) return null;

  const containerRect = containerRef.current.getBoundingClientRect();
  const x = e.clientX - containerRect.left;
  const y = e.clientY - containerRect.top;

  const stage = stageRef.current;
  const stageX = (x - stage.x()) / zoom;
  const stageY = (y - stage.y()) / zoom;

  return { x: stageX, y: stageY };
}

export async function handleDrop(e: React.DragEvent, ctx: DropContext) {
  e.preventDefault();

  // Check if it's a sticker or asset drop
  const stickerEmoji = e.dataTransfer.getData("sticker");
  const assetUrl = e.dataTransfer.getData("asset");

  if (stickerEmoji) {
    // Special handling for pencil emoji - open text dialog
    if (stickerEmoji === "✏️") {
      const coords = getStageCoordinates(
        e,
        ctx.containerRef,
        ctx.stageRef,
        ctx.zoom,
      );
      if (!coords) return;

      ctx.setTextDropPosition(coords);
      ctx.handleCreateText();
      return;
    }

    // Special handling for memo emoji - open post-it dialog
    if (stickerEmoji === "📝") {
      const coords = getStageCoordinates(
        e,
        ctx.containerRef,
        ctx.stageRef,
        ctx.zoom,
      );
      if (!coords) return;

      ctx.setPostItDropPosition(coords);
      ctx.handleCreatePostIt();
      return;
    }

    // Handle sticker drop
    const coords = getStageCoordinates(
      e,
      ctx.containerRef,
      ctx.stageRef,
      ctx.zoom,
    );
    if (!coords) return;

    // Create canvas to render emoji as image
    const canvas = document.createElement("canvas");
    const size = 100;
    canvas.width = size;
    canvas.height = size;
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    canvasCtx.font = `${size * 0.8}px serif`;
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(stickerEmoji, size / 2, size / 2);

    const dataUrl = canvas.toDataURL();
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
    img.onload = () => {
      ctx.addImage({
        id: crypto.randomUUID(),
        image: img,
        width: size,
        height: size,
        x: coords.x - size / 2,
        y: coords.y - size / 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        sourceType: "sticker",
        s3Url: dataUrl, // Use data URL for stickers (no need to upload)
      });
    };
    return;
  }

  if (assetUrl) {
    // Handle asset drop
    const coords = getStageCoordinates(
      e,
      ctx.containerRef,
      ctx.stageRef,
      ctx.zoom,
    );
    if (!coords) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = assetUrl;
    img.onload = () => {
      const MAX_SIZE = 150;
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      ctx.addImage({
        id: crypto.randomUUID(),
        image: img,
        width: scaledWidth,
        height: scaledHeight,
        x: coords.x - scaledWidth / 2,
        y: coords.y - scaledHeight / 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        sourceType: "asset",
        s3Url: assetUrl,
      });
    };
    img.onerror = (err) => {
      console.error("Failed to load asset:", assetUrl, err);
      toast.error("Failed to load asset - check CORS configuration");
    };
    return;
  }

  // Handle file drop (existing logic)
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = event.target?.result as string;
      img.onload = async () => {
        const MAX_SIZE = 500;
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        const imageId = crypto.randomUUID();
        const newImageIndex = ctx.images.length;

        // Add image to canvas immediately (optimistic UI)
        ctx.addImage({
          id: imageId,
          image: img,
          width: scaledWidth,
          height: scaledHeight,
          uploading: true,
          sourceType: "uploaded",
          x: 100,
          y: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });

        // Upload to S3 in background
        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (response.ok) {
            // Update image with S3 info
            ctx.updateImage(newImageIndex, {
              s3Url: data.s3Url,
              s3Key: data.s3Key,
              uploading: false,
            });

            // Generate description in background
            (async () => {
              try {
                const describeResponse = await fetch("/api/describe-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ imageUrl: data.s3Url }),
                });

                if (describeResponse.ok) {
                  const describeData = await describeResponse.json();
                  // Update image with generated prompt
                  ctx.updateImage(newImageIndex, {
                    prompt: describeData.description,
                  });
                }
              } catch (error) {
                console.error("Failed to generate description:", error);
                // Don't show error to user, just log it
              }
            })();
          } else {
            console.error("Upload failed:", data.error);
            ctx.updateImage(newImageIndex, { uploading: false });
          }
        } catch (error) {
          console.error("Upload error:", error);
          ctx.updateImage(newImageIndex, { uploading: false });
        }
      };
    };
    reader.readAsDataURL(file);
  }
}

export function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
}
