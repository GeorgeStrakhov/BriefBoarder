"use client";
import { useState, useRef, useEffect } from "react";
import * as React from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { useCanvasKeyboardShortcuts } from "@/hooks/useCanvasKeyboardShortcuts";
import {
  handleUpscale as upscaleImage,
  handleRemoveBackground as removeImageBackground,
  handleDownload as downloadImage,
  handleCopyUrl as copyImageUrl,
  handleCopyPrompt as copyImagePrompt,
} from "./handlers/imageOperations";
import {
  getSelectionBounds as getImageSelectionBounds,
  createAIPostIt as createAIGeneratedPostIt,
  generateImageWithPrompt as generateImage,
  editImagesWithPrompt as editImages,
  handleGenerateImage as processImageGeneration,
} from "./handlers/generationHandlers";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { PixelCrop } from "react-image-crop";
import { transformImageUrl } from "@/lib/utils/image-transform";
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
import TextElement from "./TextElement";
import TextEditDialog from "./TextEditDialog";
import GenerateIsland from "./GenerateIsland";
import SelectionContextMenu from "./SelectionContextMenu";
import CanvasControls from "./CanvasControls";
import UndoRedoControls from "./UndoRedoControls";
import ZoomControls from "./ZoomControls";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {
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

interface CanvasProps {
  briefName?: string;
  briefDescription?: string;
}

export default function Canvas({
  briefName = "",
  briefDescription = "",
}: CanvasProps) {
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
    getAllAssets,
  } = useCanvasStore();

  // Get Liveblocks state for leader check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveblocks = useCanvasStore((state: any) => state.liveblocks);

  // Get user preferences
  const { preferences, updatePreference } = usePreferences();

  // Check if this user is the leader (responsible for saving)
  const isLeader = React.useMemo(() => {
    const self = liveblocks?.room?.getSelf?.();
    const others = liveblocks?.others || [];

    if (!self) return true; // Default to leader if not connected yet

    const myConnectionId = self.connectionId;
    const allConnectionIds = [
      myConnectionId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...others.map((o: any) => o.connectionId),
    ];
    const leaderId = Math.min(...allConnectionIds);
    return myConnectionId === leaderId;
  }, [liveblocks]);

  // Local UI state
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPostItDialog, setShowPostItDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [cropImageIndex, setCropImageIndex] = useState<number | null>(null);
  const [postItImageIndex, setPostItImageIndex] = useState<number | null>(null);
  const [postItDropPosition, setPostItDropPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [textImageIndex, setTextImageIndex] = useState<number | null>(null);
  const [textDropPosition, setTextDropPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showReactions, setShowReactions] = useState(true);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration errors from localStorage-based settings
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts({
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelectedImages,
    selectedIndices,
  });

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
      // Special handling for pencil emoji - open text dialog
      if (stickerEmoji === "✏️") {
        if (!stageRef.current || !containerRef.current) return;

        // Get drop position relative to container
        const containerRect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;

        // Transform to stage coordinates (accounting for zoom and pan)
        const stage = stageRef.current;
        const stageX = (x - stage.x()) / zoom;
        const stageY = (y - stage.y()) / zoom;

        // Store drop position for text creation
        setTextDropPosition({ x: stageX, y: stageY });
        handleCreateText();
        return;
      }

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
          sourceType: "sticker",
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
          sourceType: "asset",
          s3Url: assetUrl,
        });
      };
      img.onerror = (e) => {
        console.error("Failed to load asset:", assetUrl, e);
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
          const newImageIndex = images.length;

          // Add image to canvas immediately (optimistic UI)
          addImage({
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
              updateImage(newImageIndex, {
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
                    updateImage(newImageIndex, {
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

  const handleBringToFront = () => {
    if (selectedIndices.length === 0) return;

    // Check if selected items are reactions/text or regular images
    const selectedItems = selectedIndices.map((i) => images[i]);
    const areReactions = selectedItems.some(
      (img) =>
        img?.sourceType === "sticker" ||
        img?.sourceType === "postit" ||
        img?.sourceType === "text",
    );

    // Find max zIndex within the appropriate category
    let maxZIndex: number;
    if (areReactions) {
      // Find max among reactions/text (zIndex >= 10000)
      maxZIndex = images
        .filter(
          (img) =>
            img.sourceType === "sticker" ||
            img.sourceType === "postit" ||
            img.sourceType === "text",
        )
        .reduce((max, img) => Math.max(max, img.zIndex), 9999);
    } else {
      // Find max among regular images (zIndex < 10000)
      maxZIndex = images
        .filter(
          (img) =>
            img.sourceType !== "sticker" &&
            img.sourceType !== "postit" &&
            img.sourceType !== "text",
        )
        .reduce((max, img) => Math.max(max, img.zIndex), -1);
      // Cap at 9998 to leave room
      maxZIndex = Math.min(maxZIndex, 9998 - selectedIndices.length);
    }

    // Update zIndex for each selected item
    selectedIndices.forEach((index, i) => {
      updateImage(index, { zIndex: maxZIndex + i + 1 });
    });
  };

  const handleSendToBack = () => {
    if (selectedIndices.length === 0) return;

    // Check if selected items are reactions/text or regular images
    const selectedItems = selectedIndices.map((i) => images[i]);
    const areReactions = selectedItems.some(
      (img) =>
        img?.sourceType === "sticker" ||
        img?.sourceType === "postit" ||
        img?.sourceType === "text",
    );

    // Find min zIndex within the appropriate category
    let minZIndex: number;
    if (areReactions) {
      // Find min among reactions/text (zIndex >= 10000)
      minZIndex = images
        .filter(
          (img) =>
            img.sourceType === "sticker" ||
            img.sourceType === "postit" ||
            img.sourceType === "text",
        )
        .reduce((min, img) => Math.min(min, img.zIndex), 20000);
    } else {
      // Find min among regular images (zIndex < 10000)
      minZIndex = images
        .filter(
          (img) =>
            img.sourceType !== "sticker" &&
            img.sourceType !== "postit" &&
            img.sourceType !== "text",
        )
        .reduce((min, img) => Math.min(min, img.zIndex), 10000);
    }

    // Calculate starting zIndex (min - number of items)
    const startZIndex = Math.max(
      areReactions ? 10000 : 0,
      minZIndex - selectedIndices.length,
    );

    // Update zIndex for each selected item
    selectedIndices.forEach((index, i) => {
      updateImage(index, { zIndex: startZIndex + i });
    });
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
          sourceType: "postit",
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

  const handleCreateText = () => {
    setTextImageIndex(null); // null means creating new
    setShowTextDialog(true);
  };

  const handleEditText = (index: number) => {
    setTextImageIndex(index);
    setShowTextDialog(true);
  };

  // Calculate text width based on content
  const calculateTextWidth = (
    text: string,
    fontFamily: string,
    bold: boolean,
    italic: boolean,
  ): number => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 300; // Fallback

    // Convert CSS var() to actual font family (same as TextElement)
    const getActualFontFamily = (fontVar: string): string => {
      if (fontVar.includes("geist-sans")) return "Geist";
      if (fontVar.includes("inter")) return "Inter";
      if (fontVar.includes("playfair")) return "Playfair Display";
      if (fontVar.includes("bebas")) return "Bebas Neue";
      if (fontVar.includes("caveat")) return "Caveat";
      if (fontVar.includes("roboto-mono")) return "Roboto Mono";
      if (fontVar.includes("orbitron")) return "Orbitron";
      return "Geist"; // fallback
    };

    // Match the font used in TextElement (32px base size)
    const actualFontFamily = getActualFontFamily(fontFamily);
    const fontStyle = `${italic ? "italic " : ""}${bold ? "bold " : ""}32px ${actualFontFamily}`;
    ctx.font = fontStyle;

    // Measure each line and find the longest
    const lines = text.split("\n");
    let maxWidth = 0;
    lines.forEach((line) => {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    // Add padding (matching TextElement padding of 10px on each side)
    return Math.max(maxWidth + 20, 100); // Minimum 100px
  };

  const handleSaveText = async (config: {
    text: string;
    fontFamily: string;
    lineHeight: number;
    bold: boolean;
    italic: boolean;
    color: string;
    align: "left" | "center" | "right";
    shadow: boolean;
  }) => {
    // Save preferences for next time
    updatePreference("lastTextFont", config.fontFamily);
    updatePreference("lastTextLineHeight", config.lineHeight);
    updatePreference("lastTextBold", config.bold);
    updatePreference("lastTextItalic", config.italic);
    updatePreference("lastTextColor", config.color);
    updatePreference("lastTextAlign", config.align);
    updatePreference("lastTextShadow", config.shadow);

    if (textImageIndex === null) {
      // Create new text element
      if (!stageRef.current) return;

      // Use drop position if available, otherwise use center
      let posX, posY;
      if (textDropPosition) {
        posX = textDropPosition.x;
        posY = textDropPosition.y;
        setTextDropPosition(null); // Clear after use
      } else {
        posX = dimensions.width / 2 / zoom - stagePosition.x / zoom;
        posY = dimensions.height / 2 / zoom - stagePosition.y / zoom;
      }

      // Create a placeholder image (1x1 transparent pixel)
      // Text elements don't need an actual image, but the store requires it
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 1, 1);

      const dataUrl = canvas.toDataURL();
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        // Calculate width based on text content
        const textWidth = calculateTextWidth(
          config.text,
          config.fontFamily,
          config.bold,
          config.italic,
        );

        addImage({
          id: crypto.randomUUID(),
          image: img,
          width: textWidth,
          height: 100, // Placeholder height (text will auto-size)
          x: posX,
          y: posY,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          sourceType: "text",
          text: config.text,
          fontFamily: config.fontFamily,
          lineHeight: config.lineHeight,
          bold: config.bold,
          italic: config.italic,
          color: config.color,
          textAlign: config.align,
          shadow: config.shadow,
          s3Url: dataUrl, // Use data URL (no need to upload)
        });
      };
    } else {
      // Update existing text element
      const textWidth = calculateTextWidth(
        config.text,
        config.fontFamily,
        config.bold,
        config.italic,
      );

      updateImage(textImageIndex, {
        text: config.text,
        fontFamily: config.fontFamily,
        lineHeight: config.lineHeight,
        bold: config.bold,
        italic: config.italic,
        color: config.color,
        textAlign: config.align,
        shadow: config.shadow,
        width: textWidth,
      });
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
    await downloadImage(selectedIndices, images);
  };

  const handleCopyUrl = async () => {
    await copyImageUrl(selectedIndices, images);
  };

  const handleCopyPrompt = async () => {
    await copyImagePrompt(selectedIndices, images);
  };

  const handleUpscale = async () => {
    await upscaleImage(
      selectedIndices,
      images,
      updateImage,
      settings.imageUpscalingModel,
    );
  };

  const handleRemoveBackground = async () => {
    await removeImageBackground(selectedIndices, images, updateImage);
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
  };

  const handleMergeSelection = async () => {
    if (!stageRef.current || selectedIndices.length < 2) {
      toast.error("Please select at least 2 items to merge");
      return;
    }

    try {
      const stage = stageRef.current;
      const layer = stage.getLayers()[0];
      const imageRefsMap = getAllImageRefs();

      // Get selected images
      const selectedImages = selectedIndices
        .map((index) => ({ img: images[index], index }))
        .filter(({ img }) => img !== undefined);

      if (selectedImages.length === 0) {
        toast.error("No valid items selected");
        return;
      }

      // Calculate bounding box of selected items (accounting for rotation)
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      selectedImages.forEach(({ img }) => {
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
          minX = Math.min(minX, imgX);
          minY = Math.min(minY, imgY);
          maxX = Math.max(maxX, imgX + imgWidth);
          maxY = Math.max(maxY, imgY + imgHeight);
        }
      });

      const width = maxX - minX;
      const height = maxY - minY;

      // No padding for merge (tight crop)
      const exportWidth = width;
      const exportHeight = height;

      // Save current stage transforms
      const originalScale = stage.scaleX();
      const originalPosition = { x: stage.x(), y: stage.y() };

      // Temporarily hide non-selected items
      const hiddenIndices: number[] = [];
      images.forEach((_, index) => {
        if (!selectedIndices.includes(index)) {
          hiddenIndices.push(index);
          const node = imageRefsMap.get(index);
          if (node) node.visible(false);
        }
      });

      // Hide transformer
      if (transformerRef.current) {
        transformerRef.current.visible(false);
      }

      // Temporarily clear selection to remove blue outlines
      const savedSelection = [...selectedIndices];
      setSelectedIndices([]);

      // Reset stage transforms for export
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      layer.batchDraw();

      // Wait a frame for redraw
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Export from the layer with high quality (3x for crisp results)
      const dataURL = layer.toDataURL({
        x: minX,
        y: minY,
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
      if (transformerRef.current) {
        transformerRef.current.visible(true);
      }

      // Restore selection
      setSelectedIndices(savedSelection);

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
          addImage({
            id: crypto.randomUUID(),
            image: mergedImg,
            width: exportWidth,
            height: exportHeight,
            x: minX + 50,
            y: minY + 50,
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

  // Helper: Create AI-generated post-it
  const createAIPostIt = (
    text: string,
    position?: { x: number; y: number },
  ) => {
    createAIGeneratedPostIt(
      text,
      position,
      addImage,
      selectedIndices,
      getAllImageRefs,
    );
  };

  // Helper: Generate image with given prompt
  const generateImageWithPrompt = async (enhancedPrompt: string) => {
    await generateImage(enhancedPrompt, {
      images,
      settings,
      dimensions,
      stagePosition,
      zoom,
      selectedIndices,
      addImage,
      updateImage,
      setSelectedIndices,
      deleteSelectedImages,
      getAllImageRefs,
    });
  };

  // Helper: Edit images with given prompt and inputs
  const editImagesWithPrompt = async (
    enhancedPrompt: string,
    imageInputs: string[],
  ) => {
    await editImages(enhancedPrompt, imageInputs, {
      images,
      settings,
      dimensions,
      stagePosition,
      zoom,
      selectedIndices,
      addImage,
      updateImage,
      setSelectedIndices,
      deleteSelectedImages,
      getAllImageRefs,
    });
  };

  const handleGenerateImage = async () => {
    await processImageGeneration(prompt, briefName, briefDescription, getAllAssets, {
      images,
      settings,
      dimensions,
      stagePosition,
      zoom,
      selectedIndices,
      addImage,
      updateImage,
      setSelectedIndices,
      deleteSelectedImages,
      getAllImageRefs,
    });
  };

  // Get count of selected images with s3Url (ready for editing)
  const readySelectedCount = selectedIndices.filter((index) => {
    const img = images[index];
    return img && img.s3Url && !img.uploading && !img.isGenerating;
  }).length;

  // Calculate bounding box for selected images (for multi-selection menu positioning)
  const getSelectionBounds = () => {
    return getImageSelectionBounds(selectedIndices, getAllImageRefs);
  };

  const selectionBounds =
    selectedIndices.length > 0 ? getSelectionBounds() : null;

  // Determine what's selected to show appropriate menu options
  const getSelectedItemType = () => {
    if (selectedIndices.length !== 1) return "multiple";
    const item = images[selectedIndices[0]];
    if (!item) return "none";
    if (item.sourceType === "postit") return "postit";
    if (item.sourceType === "sticker") return "emoji";
    if (item.sourceType === "text") return "text";
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
      <CanvasControls
        isLeader={isLeader}
        saveStatus={saveStatus}
        showReactions={showReactions}
        onToggleReactions={() => setShowReactions(!showReactions)}
        hasImages={images.length > 0}
        onDownloadBoard={handleDownloadBoard}
      />

      {/* Undo/Redo controls */}
      <UndoRedoControls
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
      />

      {/* Zoom controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />
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
            .filter(
              ({ imgData }) =>
                showReactions ||
                (imgData.sourceType !== "sticker" &&
                  imgData.sourceType !== "postit"),
            )
            .sort((a, b) => a.imgData.zIndex - b.imgData.zIndex)
            .map(({ imgData, originalIndex }) => {
              // Render post-it note
              if (imgData.sourceType === "postit") {
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

              // Render text element
              if (imgData.sourceType === "text") {
                return (
                  <TextElement
                    key={originalIndex}
                    x={imgData.x}
                    y={imgData.y}
                    width={imgData.width}
                    text={imgData.text || ""}
                    fontFamily={imgData.fontFamily || "var(--font-geist-sans)"}
                    lineHeight={imgData.lineHeight || 1.2}
                    bold={imgData.bold || false}
                    italic={imgData.italic || false}
                    color={imgData.color || "#000000"}
                    align={imgData.textAlign || "left"}
                    shadow={imgData.shadow || false}
                    rotation={imgData.rotation}
                    scaleX={imgData.scaleX}
                    scaleY={imgData.scaleY}
                    isSelected={selectedIndices.includes(originalIndex)}
                    onSelect={(e: any) => handleSelect(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onDragEnd={(e: any) => handleImageDragEnd(originalIndex, e)} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onTransformEnd={(
                      e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
                    ) => handleImageTransformEnd(originalIndex, e)}
                    onDoubleClick={() => handleEditText(originalIndex)}
                    nodeRef={(node: Konva.Text | null) =>
                      setImageRef(originalIndex, node)
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
      <SelectionContextMenu
        selectionBounds={selectionBounds}
        zoom={zoom}
        stagePosition={stagePosition}
        selectedItemType={selectedItemType}
        selectedIndices={selectedIndices}
        hasPrompt={!!images[selectedIndices[0]]?.prompt}
        onEditPostIt={() => handleEditPostIt(selectedIndices[0])}
        onEditText={() => handleEditText(selectedIndices[0])}
        onCopyPrompt={handleCopyPrompt}
        onOpenCrop={handleOpenCrop}
        onDownload={handleDownload}
        onCopyUrl={handleCopyUrl}
        onUpscale={handleUpscale}
        onRemoveBackground={handleRemoveBackground}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onMergeSelection={handleMergeSelection}
        onDelete={handleDelete}
      />

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

      {/* Text Edit Dialog */}
      <TextEditDialog
        open={showTextDialog}
        onOpenChange={setShowTextDialog}
        initialText={
          textImageIndex !== null ? images[textImageIndex]?.text : ""
        }
        initialFontFamily={
          textImageIndex !== null
            ? images[textImageIndex]?.fontFamily || "var(--font-geist-sans)"
            : preferences.lastTextFont || "var(--font-geist-sans)"
        }
        initialLineHeight={
          textImageIndex !== null
            ? images[textImageIndex]?.lineHeight || 1.2
            : preferences.lastTextLineHeight || 1.2
        }
        initialBold={
          textImageIndex !== null
            ? images[textImageIndex]?.bold || false
            : preferences.lastTextBold || false
        }
        initialItalic={
          textImageIndex !== null
            ? images[textImageIndex]?.italic || false
            : preferences.lastTextItalic || false
        }
        initialColor={
          textImageIndex !== null
            ? images[textImageIndex]?.color || "#000000"
            : preferences.lastTextColor || "#000000"
        }
        initialAlign={
          textImageIndex !== null
            ? images[textImageIndex]?.textAlign || "left"
            : preferences.lastTextAlign || "left"
        }
        initialShadow={
          textImageIndex !== null
            ? images[textImageIndex]?.shadow || false
            : preferences.lastTextShadow || false
        }
        onSave={handleSaveText}
      />

      {/* Generate Island */}
      <GenerateIsland
        prompt={prompt}
        onPromptChange={setPrompt}
        onGenerate={handleGenerateImage}
        isMounted={isMounted}
        caaEnabled={settings.caaEnabled}
        caaApproach={settings.caaApproach}
        imageEditingModel={settings.imageEditingModel}
        readySelectedCount={readySelectedCount}
      />
    </div>
  );
}
