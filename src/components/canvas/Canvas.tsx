"use client";
import { useState, useRef, useEffect } from "react";
import * as React from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { PixelCrop } from "react-image-crop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreVertical,
  Crop,
  ZoomIn,
  ZoomOut,
  Download,
  Trash2,
  Undo2,
  Redo2,
  Sparkles,
  ArrowUpCircle,
  FileDown,
  Loader2,
  Check,
  Eraser,
  Link,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";
import {
  useCanvasStore,
  setImageRef,
  getAllImageRefs,
} from "@/stores/canvasStore";
import { toast } from "sonner";
import CropDialog from "./CropDialog";
import DeleteImageDialog from "./DeleteImageDialog";
import PostItNote from "./PostItNote";
import PostItEditDialog from "./PostItEditDialog";

function TransformableImage({
  image,
  width,
  height,
  x,
  y,
  rotation,
  scaleX,
  scaleY,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  nodeRef,
  isUpscaling,
  isRemovingBackground,
}: any) {// eslint-disable-line @typescript-eslint/no-explicit-any
  const imageRef = useRef<Konva.Image>(null);

  useEffect(() => {
    if (imageRef.current && nodeRef) {
      nodeRef(imageRef.current);
    }
  }, [nodeRef]);

  return (
    <KonvaImage
      image={image}
      width={width}
      height={height}
      x={x || 100}
      y={y || 100}
      rotation={rotation || 0}
      scaleX={scaleX || 1}
      scaleY={scaleY || 1}
      ref={imageRef}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      stroke={isSelected ? "#0066ff" : undefined}
      strokeWidth={isSelected ? 2 : 0}
      opacity={isUpscaling || isRemovingBackground ? 0.5 : 1}
    />
  );
}

export default function Canvas() {
  // Zustand store
  const {
    images,
    selectedIndices,
    saveStatus,
    zoom,
    stagePosition,
    settings,
    addImage,
    updateImage,
    updateImageTransform,
    deleteSelectedImages,
    setSelectedIndices,
    setZoom,
    setStagePosition,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore();

  // Get Liveblocks state for leader check
  const liveblocks = useCanvasStore((state: any) => state.liveblocks);

  // Get user preferences
  const { preferences, updatePreference } = usePreferences();

  // Check if this user is the leader (responsible for saving)
  const isLeader = React.useMemo(() => {
    const self = liveblocks?.room?.getSelf?.();
    const others = liveblocks?.others || [];

    if (!self) return true; // Default to leader if not connected yet

    const myConnectionId = self.connectionId;
    const allConnectionIds = [myConnectionId, ...others.map((o: any) => o.connectionId)];
    const leaderId = Math.min(...allConnectionIds);
    return myConnectionId === leaderId;
  }, [liveblocks]);

  // Local UI state
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPostItDialog, setShowPostItDialog] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cropImageIndex, setCropImageIndex] = useState<number | null>(null);
  const [postItImageIndex, setPostItImageIndex] = useState<number | null>(null);
  const [postItDropPosition, setPostItDropPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showReactions, setShowReactions] = useState(true);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();

    // Listen to window resize
    window.addEventListener("resize", updateDimensions);

    // Use ResizeObserver to detect container size changes (e.g., sidebar collapse)
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Keyboard shortcuts for undo/redo and delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();

        if (e.shiftKey) {
          // Cmd+Shift+Z or Ctrl+Shift+Z = Redo
          if (canRedo()) {
            redo();
          }
        } else {
          // Cmd+Z or Ctrl+Z = Undo
          if (canUndo()) {
            undo();
          }
        }
      }

      // Also support Cmd+Y / Ctrl+Y for redo (Windows convention)
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }

      // Delete or Backspace to delete selected items
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIndices.length > 0
      ) {
        // Don't trigger if user is typing in an input/textarea
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        e.preventDefault();
        deleteSelectedImages();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo, selectedIndices, deleteSelectedImages]);

  // Update transformer when selection changes
  useEffect(() => {
    if (transformerRef.current) {
      const imageRefsMap = getAllImageRefs();
      const selectedNodes = selectedIndices
        .map((index) => imageRefsMap.get(index))
        .filter(
          (node): node is Konva.Image => node !== null && node !== undefined,
        );

      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIndices]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();

    // Check if it's a sticker or asset drop
    const stickerEmoji = e.dataTransfer.getData("sticker");
    const assetUrl = e.dataTransfer.getData("asset");

    if (stickerEmoji) {
      // Special handling for memo emoji - open post-it dialog
      if (stickerEmoji === "📝") {
        if (!stageRef.current || !containerRef.current) return;

        // Get drop position relative to container
        const containerRect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;

        // Transform to stage coordinates (accounting for zoom and pan)
        const stage = stageRef.current;
        const stageX = (x - stage.x()) / zoom;
        const stageY = (y - stage.y()) / zoom;

        // Store drop position for post-it creation
        setPostItDropPosition({ x: stageX, y: stageY });
        handleCreatePostIt();
        return;
      }

      // Handle sticker drop
      if (!stageRef.current || !containerRef.current) return;

      // Get drop position relative to container
      const containerRect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      // Transform to stage coordinates (accounting for zoom and pan)
      const stage = stageRef.current;
      const stageX = (x - stage.x()) / zoom;
      const stageY = (y - stage.y()) / zoom;

      // Create canvas to render emoji as image
      const canvas = document.createElement("canvas");
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.font = `${size * 0.8}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stickerEmoji, size / 2, size / 2);

      const dataUrl = canvas.toDataURL();
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        addImage({
          id: crypto.randomUUID(),
          image: img,
          width: size,
          height: size,
          x: stageX - size / 2,
          y: stageY - size / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          isReaction: true,
          reactionType: "sticker",
          s3Url: dataUrl, // Use data URL for stickers (no need to upload)
        });
      };
      return;
    }

    if (assetUrl) {
      // Handle asset drop
      if (!stageRef.current || !containerRef.current) return;

      // Get drop position relative to container
      const containerRect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      // Transform to stage coordinates (accounting for zoom and pan)
      const stage = stageRef.current;
      const stageX = (x - stage.x()) / zoom;
      const stageY = (y - stage.y()) / zoom;

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = assetUrl;
      img.onload = () => {
        const MAX_SIZE = 150;
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        addImage({
          id: crypto.randomUUID(),
          image: img,
          width: scaledWidth,
          height: scaledHeight,
          x: stageX - scaledWidth / 2,
          y: stageY - scaledHeight / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          assetType: "brand",
          s3Url: assetUrl, // Use placeholder URL for now
        });
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
          const newImageIndex = images.length;

          // Add image to canvas immediately (optimistic UI)
          addImage({
            id: imageId,
            image: img,
            width: scaledWidth,
            height: scaledHeight,
            uploading: true,
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
              updateImage(newImageIndex, {
                s3Url: data.s3Url,
                s3Key: data.s3Key,
                uploading: false,
              });
            } else {
              console.error("Upload failed:", data.error);
              updateImage(newImageIndex, { uploading: false });
            }
          } catch (error) {
            console.error("Upload error:", error);
            updateImage(newImageIndex, { uploading: false });
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelect = (index: number, e: any) => {
    const isShiftKey = e.evt?.shiftKey;

    if (isShiftKey) {
      if (selectedIndices.includes(index)) {
        setSelectedIndices(selectedIndices.filter((i) => i !== index));
      } else {
        setSelectedIndices([...selectedIndices, index]);
      }
    } else {
      setSelectedIndices([index]);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteSelectedImages();
    setShowDeleteDialog(false);
  };

  const handleCreatePostIt = () => {
    setPostItImageIndex(null); // null means creating new
    setShowPostItDialog(true);
  };

  const handleEditPostIt = (index: number) => {
    setPostItImageIndex(index);
    setShowPostItDialog(true);
  };

  const handleSavePostIt = async (text: string, color: string) => {
    // Save the color preference for next time
    updatePreference("lastPostItColor", color);

    if (postItImageIndex === null) {
      // Create new post-it
      if (!stageRef.current) return;

      // Use drop position if available, otherwise use center
      let posX, posY;
      if (postItDropPosition) {
        posX = postItDropPosition.x;
        posY = postItDropPosition.y;
        setPostItDropPosition(null); // Clear after use
      } else {
        posX = dimensions.width / 2 / zoom - stagePosition.x / zoom;
        posY = dimensions.height / 2 / zoom - stagePosition.y / zoom;
      }

      // Create canvas to render post-it
      const canvas = document.createElement("canvas");
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw background with selected color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);

      const dataUrl = canvas.toDataURL();
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        addImage({
          id: crypto.randomUUID(),
          image: img,
          width: size,
          height: size,
          x: posX - size / 2,
          y: posY - size / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          isReaction: true,
          reactionType: "postit",
          text: text,
          color: color,
          s3Url: dataUrl,
        });
      };
    } else {
      // Update existing post-it
      updateImage(postItImageIndex, { text, color });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImageDragEnd = (index: number, e: any) => {
    updateImageTransform(index, e.target);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImageTransformEnd = (index: number, e: any) => {
    updateImageTransform(index, e.target);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.03;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // Clamp zoom between 0.1 and 5
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setZoom(clampedScale);
    setStagePosition(newPos);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoom * 1.2);

    // Zoom towards center of screen
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const mousePointTo = {
      x: (centerX - stagePosition.x) / zoom,
      y: (centerY - stagePosition.y) / zoom,
    };

    const newPos = {
      x: centerX - mousePointTo.x * newZoom,
      y: centerY - mousePointTo.y * newZoom,
    };

    setZoom(newZoom);
    setStagePosition(newPos);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.2);

    // Zoom towards center of screen
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const mousePointTo = {
      x: (centerX - stagePosition.x) / zoom,
      y: (centerY - stagePosition.y) / zoom,
    };

    const newPos = {
      x: centerX - mousePointTo.x * newZoom,
      y: centerY - mousePointTo.y * newZoom,
    };

    setZoom(newZoom);
    setStagePosition(newPos);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setStagePosition({ x: 0, y: 0 });
  };

  const handleOpenCrop = () => {
    if (selectedIndices.length === 1) {
      setCropImageIndex(selectedIndices[0]);
      setShowCropDialog(true);
    }
  };

  const handleDownload = async () => {
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
  };

  const handleCopyUrl = async () => {
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
  };

  const handleUpscale = async () => {
    if (selectedIndices.length !== 1) return;

    const imageIndex = selectedIndices[0];
    const imageData = images[imageIndex];
    if (!imageData?.s3Url) return;

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
          model: settings.imageUpscalingModel,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Load the upscaled image
        const upscaledImg = new window.Image();
        upscaledImg.crossOrigin = "anonymous";
        upscaledImg.src = data.imageUrl;
        upscaledImg.onload = () => {
          // Update image with upscaled version, keeping transforms
          updateImage(imageIndex, {
            image: upscaledImg,
            s3Url: data.imageUrl,
            s3Key: data.key,
            isUpscaling: false,
            // Keep existing transform properties
          });
          toast.success("Image upscaled successfully!");
        };
      } else {
        updateImage(imageIndex, { isUpscaling: false });
        toast.error(data.error || "Failed to upscale image");
      }
    } catch (error) {
      console.error("Upscale error:", error);
      updateImage(imageIndex, { isUpscaling: false });
      toast.error("Failed to upscale image");
    }
  };

  const handleRemoveBackground = async () => {
    if (selectedIndices.length !== 1) return;

    const imageIndex = selectedIndices[0];
    const imageData = images[imageIndex];
    if (!imageData?.s3Url) return;

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
          // Update image with processed version, keeping transforms
          updateImage(imageIndex, {
            image: processedImg,
            s3Url: data.imageUrl,
            s3Key: data.key,
            isRemovingBackground: false,
            // Keep existing transform properties
          });
          toast.success("Background removed successfully!");
        };
      } else {
        updateImage(imageIndex, { isRemovingBackground: false });
        toast.error(data.error || "Failed to remove background");
      }
    } catch (error) {
      console.error("Remove background error:", error);
      updateImage(imageIndex, { isRemovingBackground: false });
      toast.error("Failed to remove background");
    }
  };

  const handleDownloadBoard = async (includeReactions: boolean) => {
    if (!stageRef.current || images.length === 0) {
      toast.error("No images to download");
      return;
    }

    try {
      const stage = stageRef.current;
      const layer = stage.getLayers()[0]; // Get the first (and only) layer
      const imageRefsMap = getAllImageRefs();
      const { briefId } = useCanvasStore.getState();

      // Filter images based on includeReactions parameter
      // Always include assets, only exclude reactions if includeReactions is false
      const exportableImages = images
        .map((img, index) => ({ img, index }))
        .filter(({ img }) => includeReactions || !img.isReaction);

      if (exportableImages.length === 0) {
        toast.error("No images to download");
        return;
      }

      // Calculate bounding box of all exportable images (accounting for rotation)
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      exportableImages.forEach(({ img }) => {
        // Use the stored image properties directly
        const imgX = img.x || 0;
        const imgY = img.y || 0;
        const imgWidth = img.width * (img.scaleX || 1);
        const imgHeight = img.height * (img.scaleY || 1);
        const rotation = img.rotation || 0;

        // For rotated images, we need to calculate the bounding box
        if (rotation !== 0) {
          const centerX = imgX + imgWidth / 2;
          const centerY = imgY + imgHeight / 2;
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          // Calculate the 4 corners
          const corners = [
            { x: imgX, y: imgY },
            { x: imgX + imgWidth, y: imgY },
            { x: imgX + imgWidth, y: imgY + imgHeight },
            { x: imgX, y: imgY + imgHeight },
          ];

          corners.forEach((corner) => {
            // Rotate around center
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

      const width = maxX - minX;
      const height = maxY - minY;

      // Add some padding
      const padding = 50;
      minX -= padding;
      minY -= padding;
      const exportWidth = width + padding * 2;
      const exportHeight = height + padding * 2;

      // Save current stage transforms
      const originalScale = stage.scaleX();
      const originalPosition = { x: stage.x(), y: stage.y() };

      // Temporarily hide reactions if not including them
      const hiddenIndices: number[] = [];
      if (!includeReactions) {
        images.forEach((img, index) => {
          if (img.isReaction) {
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
  };

  const handleSaveCrop = async (
    croppedBlob: Blob,
    completedCrop: PixelCrop,
  ) => {
    if (cropImageIndex === null) return;

    // Upload to S3
    const formData = new FormData();
    formData.append("file", croppedBlob, "cropped.png");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      // Load the new cropped image
      const newImg = new window.Image();
      newImg.crossOrigin = "anonymous";
      newImg.src = data.s3Url;
      newImg.onload = () => {
        // Update image with new cropped version
        updateImage(cropImageIndex, {
          image: newImg,
          s3Url: data.s3Url,
          s3Key: data.s3Key,
          width: completedCrop.width,
          height: completedCrop.height,
        });

        setCropImageIndex(null);
      };
    } else {
      throw new Error(data.error || "Upload failed");
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;

    const promptText = prompt;

    // Check if we're editing (images selected) or generating
    const selectedImages = selectedIndices
      .map((index) => images[index])
      .filter((img) => img && img.s3Url); // Only images with s3Url (uploaded/generated)

    const isEditing = selectedImages.length > 0;

    // Validate: check if any selected images are still uploading/generating
    const hasUploadingImages = selectedIndices.some((index) => {
      const img = images[index];
      return img && (img.uploading || img.isGenerating);
    });

    if (hasUploadingImages) {
      toast.error("Please wait for images to finish uploading/generating");
      return;
    }

    if (isEditing) {
      // IMAGE EDITING MODE
      const editingModel = settings.imageEditingModel;

      // Validate flux-kontext with multiple images
      if (editingModel === "flux-kontext" && selectedImages.length > 1) {
        toast.error(
          "flux-kontext only supports 1 reference image. Please select only 1 image or use nano-banana.",
        );
        return;
      }

      const imageInputs = selectedImages.map((img) => img.s3Url!);

      // Use a generic placeholder (1:1) for editing
      const placeholderPath = "/loading/generating_1x1.png";
      const width = 400;
      const height = 400;

      const imageId = crypto.randomUUID();
      const newImageIndex = images.length;

      // Calculate position in visible viewport
      const centerX = (dimensions.width / 2 - stagePosition.x) / zoom;
      const centerY = (dimensions.height / 2 - stagePosition.y) / zoom;

      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) * 200;

      const x = centerX + offsetX - width / 2;
      const y = centerY + offsetY - height / 2;

      const placeholderImage = new window.Image();
      placeholderImage.crossOrigin = "anonymous";
      placeholderImage.src = placeholderPath;

      placeholderImage.onload = () => {
        addImage({
          id: imageId,
          image: placeholderImage,
          width,
          height,
          isGenerating: true,
          x,
          y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });

        // Edit image in background
        (async () => {
          try {
            const response = await fetch("/api/edit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: promptText,
                imageInputs,
                model: editingModel,
              }),
            });

            const data = await response.json();

            if (response.ok) {
              const editedImg = new window.Image();
              editedImg.crossOrigin = "anonymous";
              editedImg.src = data.imageUrl;
              editedImg.onload = () => {
                // Use actual image dimensions, scale to max 500px
                const MAX_SIZE = 500;
                const scale = Math.min(
                  1,
                  MAX_SIZE / Math.max(editedImg.width, editedImg.height),
                );
                const scaledWidth = editedImg.width * scale;
                const scaledHeight = editedImg.height * scale;

                updateImage(newImageIndex, {
                  image: editedImg,
                  s3Url: data.imageUrl,
                  s3Key: data.key,
                  isGenerating: false,
                  width: scaledWidth,
                  height: scaledHeight,
                });
                toast.success("Image edited successfully!");
              };
            } else {
              setSelectedIndices([newImageIndex]);
              setTimeout(() => deleteSelectedImages(), 0);
              toast.error(data.error || "Failed to edit image");
            }
          } catch (error) {
            console.error("Edit error:", error);
            setSelectedIndices([newImageIndex]);
            setTimeout(() => deleteSelectedImages(), 0);
            toast.error("Failed to edit image");
          }
        })();
      };
    } else {
      // IMAGE GENERATION MODE
      const model = settings.imageGenerationModel;
      const aspectRatio = settings.defaultAspectRatio;

      // Always use square placeholder
      const placeholderPath = "/loading/generating_1x1.png";
      const width = 400;
      const height = 400;

      const imageId = crypto.randomUUID();
      const newImageIndex = images.length;

      // Calculate position in visible viewport
      // Center of visible area
      const centerX = (dimensions.width / 2 - stagePosition.x) / zoom;
      const centerY = (dimensions.height / 2 - stagePosition.y) / zoom;

      // Add random offset to avoid stacking
      const offsetX = (Math.random() - 0.5) * 200; // Random offset ±100px
      const offsetY = (Math.random() - 0.5) * 200;

      const x = centerX + offsetX - width / 2; // Subtract half width to center the image
      const y = centerY + offsetY - height / 2;

      // Load placeholder PNG
      const placeholderImage = new window.Image();
      placeholderImage.crossOrigin = "anonymous";
      placeholderImage.src = placeholderPath;

      placeholderImage.onload = () => {
        // Add placeholder to canvas (no s3Url so it won't be saved)
        addImage({
          id: imageId,
          image: placeholderImage,
          width,
          height,
          isGenerating: true,
          x,
          y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });

        // Generate image in background
        (async () => {
          try {
            const response = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: promptText, model, aspectRatio }),
            });

            const data = await response.json();

            if (response.ok) {
              // Load the generated image
              const generatedImg = new window.Image();
              generatedImg.crossOrigin = "anonymous";
              generatedImg.src = data.imageUrl;
              generatedImg.onload = () => {
                // Use actual image dimensions, scale to max 500px
                const MAX_SIZE = 500;
                const scale = Math.min(
                  1,
                  MAX_SIZE / Math.max(generatedImg.width, generatedImg.height),
                );
                const scaledWidth = generatedImg.width * scale;
                const scaledHeight = generatedImg.height * scale;

                updateImage(newImageIndex, {
                  image: generatedImg,
                  s3Url: data.imageUrl,
                  s3Key: data.key,
                  isGenerating: false,
                  width: scaledWidth,
                  height: scaledHeight,
                });
                toast.success("Image generated successfully!");
              };
            } else {
              // Remove placeholder on error
              setSelectedIndices([newImageIndex]);
              setTimeout(() => deleteSelectedImages(), 0);
              toast.error(data.error || "Failed to generate image");
            }
          } catch (error) {
            console.error("Generate error:", error);
            setSelectedIndices([newImageIndex]);
            setTimeout(() => deleteSelectedImages(), 0);
            toast.error("Failed to generate image");
          }
        })();
      };
    }
  };

  // Get count of selected images with s3Url (ready for editing)
  const readySelectedCount = selectedIndices.filter((index) => {
    const img = images[index];
    return img && img.s3Url && !img.uploading && !img.isGenerating;
  }).length;

  // Calculate bounding box for selected images (for multi-selection menu positioning)
  const getSelectionBounds = () => {
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
  };

  const selectionBounds =
    selectedIndices.length > 0 ? getSelectionBounds() : null;

  // Determine what's selected to show appropriate menu options
  const getSelectedItemType = () => {
    if (selectedIndices.length !== 1) return "multiple";
    const item = images[selectedIndices[0]];
    if (!item) return "none";
    if (item.reactionType === "postit") return "postit";
    if (item.isReaction) return "emoji";
    return "image";
  };

  const selectedItemType = getSelectedItemType();

  return (
    <div
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        width: "100%",
        height: "100%",
        background: "#f0f0f0",
        position: "relative",
      }}
    >
      {/* Top right controls */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        {/* Save status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
          }}
          title={isLeader ? (saveStatus === "saved" ? "Saved" : "Saving...") : "Synced"}
        >
          {isLeader ? (
            <>
              {(saveStatus === "saving" || saveStatus === "unsaved") && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {saveStatus === "saved" && <Check className="h-4 w-4" />}
            </>
          ) : (
            <Check className="h-4 w-4" />
          )}
        </div>

        {/* Toggle reactions visibility */}
        <button
          onClick={() => setShowReactions(!showReactions)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
          }}
          title={
            showReactions ? "Hide Notes & Reactions" : "Show Notes & Reactions"
          }
        >
          {showReactions ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>

        {/* Download board button */}
        {images.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  opacity: 0.5,
                }}
                title="Download Board"
              >
                <FileDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDownloadBoard(false)}>
                Download Board
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadBoard(true)}>
                Download with Notes & Reactions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Undo/Redo controls */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          display: "flex",
          flexDirection: "row",
          gap: "8px",
          zIndex: 1000,
        }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={undo}
          disabled={!canUndo()}
          className="bg-white"
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={redo}
          disabled={!canRedo()}
          className="bg-white"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom controls */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "8px",
          zIndex: 1000,
        }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="bg-white"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="bg-white"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetZoom}
          className="bg-white text-xs"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </Button>
      </div>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => {
          const stage = e.target.getStage();
          if (stage) {
            setStagePosition({ x: stage.x(), y: stage.y() });
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            setSelectedIndices([]);
          }
        }}
      >
        <Layer>
          {images
            .map((imgData, originalIndex) => ({ imgData, originalIndex }))
            .filter(({ imgData }) => showReactions || !imgData.isReaction)
            .sort((a, b) => a.imgData.zIndex - b.imgData.zIndex)
            .map(({ imgData, originalIndex }) => {
              // Render post-it note
              if (imgData.reactionType === "postit") {
                return (
                  <PostItNote
                    key={originalIndex}
                    x={imgData.x}
                    y={imgData.y}
                    width={imgData.width}
                    height={imgData.height}
                    text={imgData.text || ""}
                    color={imgData.color}
                    rotation={imgData.rotation}
                    scaleX={imgData.scaleX}
                    scaleY={imgData.scaleY}
                    isSelected={selectedIndices.includes(originalIndex)}
                    onSelect={(e: any) => handleSelect(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onDragEnd={(e: any) => handleImageDragEnd(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onTransformEnd={(
                      e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
                    ) => handleImageTransformEnd(originalIndex, e)}
                    onDoubleClick={() => handleEditPostIt(originalIndex)}
                    nodeRef={
                      (node: Konva.Group | null) =>
                        setImageRef(originalIndex, node as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                    }
                  />
                );
              }

              // Render regular image
              return (
                <TransformableImage
                  key={originalIndex}
                  image={imgData.image}
                  width={imgData.width}
                  height={imgData.height}
                  x={imgData.x}
                  y={imgData.y}
                  rotation={imgData.rotation}
                  scaleX={imgData.scaleX}
                  scaleY={imgData.scaleY}
                  isSelected={selectedIndices.includes(originalIndex)}
                  onSelect={(e: any) => handleSelect(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onDragEnd={(e: any) => handleImageDragEnd(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onTransformEnd={(
                    e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
                  ) => handleImageTransformEnd(originalIndex, e)}
                  nodeRef={(node: Konva.Image) =>
                    setImageRef(originalIndex, node)
                  }
                  isUpscaling={imgData.isUpscaling}
                  isRemovingBackground={imgData.isRemovingBackground}
                />
              );
            })}
          <Transformer
            ref={transformerRef}
            keepRatio={true}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {images.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "24px",
            color: "#666",
            pointerEvents: "none",
          }}
        >
          Drag and drop an image here or use AI to generate one
        </div>
      )}
      {selectedIndices.length >= 1 && selectionBounds && (
        <div
          style={{
            position: "absolute",
            left: `${selectionBounds.x * zoom + stagePosition.x + selectionBounds.width * zoom + 10}px`,
            top: `${selectionBounds.y * zoom + stagePosition.y}px`,
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {/* Post-it note: Edit + Delete */}
              {selectedItemType === "postit" && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleEditPostIt(selectedIndices[0])}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {/* Emoji sticker: Delete only */}
              {selectedItemType === "emoji" && (
                <DropdownMenuItem onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}

              {/* Regular image: All options */}
              {selectedItemType === "image" && (
                <>
                  <DropdownMenuItem onClick={handleOpenCrop}>
                    <Crop className="mr-2 h-4 w-4" />
                    Crop
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyUrl}>
                    <Link className="mr-2 h-4 w-4" />
                    Copy URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleUpscale}>
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Upscale
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRemoveBackground}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Remove Background
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {/* Multiple items selected: Delete only */}
              {selectedItemType === "multiple" && (
                <DropdownMenuItem onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedIndices.length})
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteImageDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        count={selectedIndices.length}
      />

      {/* Crop Dialog */}
      <CropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageUrl={
          cropImageIndex !== null ? images[cropImageIndex]?.s3Url : undefined
        }
        onSave={handleSaveCrop}
      />

      {/* Post-it Edit Dialog */}
      <PostItEditDialog
        open={showPostItDialog}
        onOpenChange={setShowPostItDialog}
        initialText={
          postItImageIndex !== null ? images[postItImageIndex]?.text : ""
        }
        initialColor={
          postItImageIndex !== null
            ? images[postItImageIndex]?.color || "#FEFF9C"
            : preferences.lastPostItColor || "#FEFF9C"
        }
        onSave={handleSavePostIt}
      />

      {/* Generate Island */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "white",
          borderRadius: "12px",
          padding: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1000,
          maxWidth: "600px",
          width: "calc(100% - 40px)",
        }}
      >
        {readySelectedCount > 0 && (
          <div className="mb-2 text-xs text-gray-500">
            {readySelectedCount} image{readySelectedCount !== 1 ? "s" : ""}{" "}
            selected • Using {settings.imageEditingModel}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className="h-[68px] resize-none"
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerateImage();
              }
            }}
          />
          <Button
            onClick={handleGenerateImage}
            disabled={!prompt.trim()}
            size="icon"
            className="h-[80px] w-[80px] flex-shrink-0"
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
