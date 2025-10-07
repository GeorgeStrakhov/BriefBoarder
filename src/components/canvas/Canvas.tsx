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
import {
  handleDrop as processDrop,
  handleDragOver as processDragOver,
} from "./handlers/dropHandlers";
import {
  handleDownloadBoard as downloadBoard,
  handleMergeSelection as mergeSelection,
} from "./handlers/exportHandlers";
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
    await processDrop(e, {
      stageRef,
      containerRef,
      zoom,
      images,
      addImage,
      updateImage,
      setTextDropPosition,
      setPostItDropPosition,
      handleCreateText,
      handleCreatePostIt,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    processDragOver(e);
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
    await downloadBoard(includeReactions, {
      stageRef,
      transformerRef,
      images,
      selectedIndices,
      getAllImageRefs,
      addImage,
      setSelectedIndices,
    });
  };

  const handleMergeSelection = async () => {
    await mergeSelection({
      stageRef,
      transformerRef,
      images,
      selectedIndices,
      getAllImageRefs,
      addImage,
      setSelectedIndices,
    });
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

  const handleGenerateImage = async (overridePrompt?: string) => {
    await processImageGeneration(
      overridePrompt ?? prompt,
      briefName,
      briefDescription,
      getAllAssets,
      {
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
      },
    );
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

  // Magic Ad Button Component
  const MagicAdButton = () => {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleGenerateAd = async () => {
      setIsGenerating(true);
      toast.loading("✨ Creating autonomous ad...", { id: "auto-ad" });

      try {
        // Get preferred typeface from user preferences
        const preferredFont = preferences.lastTextFont || "var(--font-geist-sans)";

        // Convert CSS var to actual font name for LLM
        const getFontName = (fontVar: string): string => {
          if (fontVar.includes("geist-sans")) return "Geist Sans";
          if (fontVar.includes("inter")) return "Inter";
          if (fontVar.includes("playfair")) return "Playfair Display";
          if (fontVar.includes("bebas")) return "Bebas Neue";
          if (fontVar.includes("caveat")) return "Caveat";
          if (fontVar.includes("roboto-mono")) return "Roboto Mono";
          if (fontVar.includes("orbitron")) return "Orbitron";
          return "Geist Sans";
        };

        const response = await fetch("/api/generate-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            briefName,
            briefDescription,
            approach: settings.caaApproach,
            availableAssets: getAllAssets(),
            preferredTypeface: getFontName(preferredFont),
            aspectRatio: settings.defaultAspectRatio || "9:16", // Use user's selected aspect ratio
            settings: {
              imageGenerationModel: settings.imageGenerationModel,
              imageEditingModel: settings.imageEditingModel,
              caaModel: settings.caaModel,
            },
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Load generated ad image
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.src = data.imageUrl;
          img.onload = () => {
            // Add to canvas at center
            const centerX = dimensions.width / 2 / zoom - stagePosition.x / zoom;
            const centerY = dimensions.height / 2 / zoom - stagePosition.y / zoom;

            // FIXED: Use actual image dimensions, scale proportionally
            // Don't assume aspect ratio - respect what the image generator created
            const maxWidth = 400; // Max width on canvas
            const aspectRatio = img.naturalWidth / img.naturalHeight;

            let adWidth, adHeight;
            if (aspectRatio > 1) {
              // Landscape: constrain by width
              adWidth = maxWidth;
              adHeight = maxWidth / aspectRatio;
            } else {
              // Portrait or square: constrain by height to prevent super tall images
              const maxHeight = 700;
              adHeight = Math.min(maxWidth / aspectRatio, maxHeight);
              adWidth = adHeight * aspectRatio;
            }

            console.log("Image natural dimensions:", img.naturalWidth, "x", img.naturalHeight);
            console.log("Canvas dimensions:", adWidth, "x", adHeight);

            addImage({
              id: crypto.randomUUID(),
              image: img,
              width: adWidth,
              height: adHeight,
              x: centerX - adWidth / 2,
              y: centerY - adHeight / 2,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              sourceType: "generated",
              s3Url: data.imageUrl,
              s3Key: data.s3Key,
              prompt: `Auto-generated ad using "${data.trick.name}" technique`,
            });

            const textInfo =
              data.textPlacement === "none"
                ? " (image only)"
                : data.textPlacement === "integrated"
                ? " (text integrated)"
                : "";

            toast.success(
              `Ad created using "${data.trick.name}" technique!${textInfo}`
            );
          };
        } else {
          toast.error(data.error || "Failed to generate ad");
        }
      } catch (error) {
        console.error("Auto ad error:", error);
        toast.error("Failed to generate ad");
      } finally {
        setIsGenerating(false);
        toast.dismiss("auto-ad");
      }
    };

    return (
      <button
        onClick={handleGenerateAd}
        disabled={isGenerating}
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          zIndex: 1000,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "12px 20px",
          borderRadius: "12px",
          border: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          cursor: isGenerating ? "not-allowed" : "pointer",
          opacity: isGenerating ? 0.5 : 1,
          fontWeight: 600,
          fontSize: "14px",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!isGenerating) {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        }}
        title="Generate autonomous ad from brief"
      >
        {isGenerating ? "✨ Creating..." : "✨ Magic Ad"}
      </button>
    );
  };

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
      {/* Magic Ad Button */}
      <MagicAdButton />

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
