import { create } from "zustand";
import { liveblocks } from "@liveblocks/zustand";
import { liveblocksClient } from "@/lib/liveblocks";
import Konva from "konva";
import { Asset, getPresetAssets } from "@/config/assets";

export type ImageSourceType =
  | "generated" // AI generated from scratch
  | "edited" // AI edited from reference images
  | "uploaded" // User uploaded file
  | "sticker" // Emoji sticker
  | "postit" // Post-it note
  | "text" // Text element
  | "asset"; // Preset asset (logo, brand, etc)

export interface CanvasImage {
  id: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  s3Url?: string;
  s3Key?: string;

  // Source tracking
  sourceType: ImageSourceType;
  prompt?: string; // For generated/edited types
  sourceImages?: string[]; // For edited type - S3 URLs of reference images

  // Temporary state flags
  uploading?: boolean;
  isGenerating?: boolean;
  isUpscaling?: boolean;
  isRemovingBackground?: boolean;

  // Type-specific metadata
  text?: string; // For post-it notes and text elements
  color?: string; // For post-it notes and text elements
  isAIGenerated?: boolean; // For AI-generated post-it notes

  // Text-specific properties
  fontFamily?: string; // For text elements
  lineHeight?: number; // For text elements
  bold?: boolean; // For text elements
  italic?: boolean; // For text elements
  textAlign?: "left" | "center" | "right"; // For text elements
  shadow?: boolean; // For text elements

  // Transform properties
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
}

// Serializable version for history (excludes HTMLImageElement)
export interface SerializableImageState {
  id: string;
  s3Url?: string;
  s3Key?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;

  // Source tracking
  sourceType: ImageSourceType;
  prompt?: string;
  sourceImages?: string[];

  // Type-specific metadata
  text?: string;
  color?: string;
  isAIGenerated?: boolean;

  // Text-specific properties
  fontFamily?: string;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  textAlign?: "left" | "center" | "right";
  shadow?: boolean;
}

// Store imageRefs outside of Zustand to avoid re-render loops
// Can store Konva.Image, Konva.Text, or Konva.Group (for post-its)
const imageRefsMap = new Map<number, Konva.Image | Konva.Text | Konva.Group | null>();

export const getImageRef = (index: number) => imageRefsMap.get(index) || null;
export const setImageRef = (index: number, ref: Konva.Image | Konva.Text | Konva.Group | null) => {
  imageRefsMap.set(index, ref);
};
export const getAllImageRefs = () => imageRefsMap;

// Store HTMLImageElement objects outside of Zustand (not synced via Liveblocks)
const imageElementsMap = new Map<string, HTMLImageElement>();

const loadImageElement = (id: string, s3Url: string): Promise<HTMLImageElement> => {
  // Check if cached and URL matches (important for crops/edits that change the URL)
  const cached = imageElementsMap.get(id);
  if (cached && cached.src === s3Url) {
    return Promise.resolve(cached);
  }

  // Load and cache (or reload if URL changed)
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = s3Url;
    img.onload = () => {
      imageElementsMap.set(id, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${s3Url}`));
  });
};

// History management outside of Zustand to avoid re-renders
const MAX_HISTORY = 50;
let history: SerializableImageState[][] = [];
let historyStep = -1;

// Serialize images array for history
const serializeImages = (images: CanvasImage[]): SerializableImageState[] => {
  return images
    .filter((img) => img.s3Url) // Only save uploaded images
    .map((img) => ({
      id: img.id,
      s3Url: img.s3Url,
      s3Key: img.s3Key,
      width: img.width,
      height: img.height,
      x: img.x,
      y: img.y,
      rotation: img.rotation,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      zIndex: img.zIndex,
      sourceType: img.sourceType,
      prompt: img.prompt,
      sourceImages: img.sourceImages,
      text: img.text,
      color: img.color,
      isAIGenerated: img.isAIGenerated,
      fontFamily: img.fontFamily,
      lineHeight: img.lineHeight,
      bold: img.bold,
      italic: img.italic,
      textAlign: img.textAlign,
      shadow: img.shadow,
    }));
};

// Deserialize images from history
const deserializeImages = async (
  serialized: SerializableImageState[],
): Promise<CanvasImage[]> => {
  return Promise.all(
    serialized.map(async (data) => {
      return new Promise<CanvasImage>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = data.s3Url || "";
        img.onload = () => {
          resolve({
            id: data.id,
            image: img,
            width: data.width,
            height: data.height,
            s3Url: data.s3Url,
            s3Key: data.s3Key,
            x: data.x,
            y: data.y,
            rotation: data.rotation,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            zIndex: data.zIndex,
            sourceType: data.sourceType,
            prompt: data.prompt,
            sourceImages: data.sourceImages,
            text: data.text,
            color: data.color,
            isAIGenerated: data.isAIGenerated,
            fontFamily: data.fontFamily,
            lineHeight: data.lineHeight,
            bold: data.bold,
            italic: data.italic,
            textAlign: data.textAlign,
            shadow: data.shadow,
            uploading: false,
          });
        };
        img.onerror = () => {
          reject(new Error(`Failed to load image: ${data.s3Url}`));
        };
      });
    }),
  );
};

// Push current state to history
const pushHistory = (images: CanvasImage[]) => {
  const serialized = serializeImages(images);

  // Don't push if identical to current state
  if (historyStep >= 0 && historyStep < history.length) {
    const current = history[historyStep];
    if (JSON.stringify(current) === JSON.stringify(serialized)) {
      return;
    }
  }

  // Trim future if we're in the middle of history
  history = history.slice(0, historyStep + 1);

  // Add snapshot
  history.push(serialized);

  // Trim old history if needed
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyStep++;
  }
};

const clearHistory = () => {
  history = [];
  historyStep = -1;
};

export type CAAApproachId = "simple" | "dramatic";

export interface BriefSettings {
  imageGenerationModel: string;
  imageEditingModel: string;
  imageUpscalingModel: string;
  defaultAspectRatio: string;
  // Creative Approach Agent settings
  caaEnabled: boolean;
  caaApproach: CAAApproachId;
  caaModel: "anthropic/claude-sonnet-4" | "openai/gpt-4.1-mini";
}

interface CanvasState {
  // State (some fields synced via Liveblocks)
  briefId: string | null;
  images: CanvasImage[]; // Local only (contains HTMLImageElement)
  syncedImages: SerializableImageState[]; // Synced via Liveblocks
  selectedIndices: number[]; // Synced via Presence
  saveStatus: "saved" | "saving" | "unsaved";
  isLoading: boolean;
  isInitialLoad: boolean;
  zoom: number; // Synced
  stagePosition: { x: number; y: number }; // Synced
  briefName: string; // Synced - collaborative brief name
  briefDescription: string; // Synced - collaborative brief description
  settings: BriefSettings; // Local only - user preferences
  customAssets: Asset[]; // Synced - user-uploaded assets

  // Non-reactive metadata
  lastSavedState: string;


  // Actions
  setBriefId: (id: string) => void;
  loadBrief: (briefId: string) => Promise<void>;
  addImage: (image: Omit<CanvasImage, "zIndex">) => void;
  updateImage: (index: number, updates: Partial<CanvasImage>) => void;
  deleteSelectedImages: () => void;
  setSelectedIndices: (indices: number[]) => void;
  updateImageTransform: (index: number, node: Konva.Image) => void;
  setZoom: (zoom: number) => void;
  setStagePosition: (position: { x: number; y: number }) => void;
  setBriefName: (name: string) => void;
  setBriefDescription: (description: string) => void;
  saveToDatabase: () => Promise<void>;
  markUnsaved: () => void;
  reset: () => void;

  // Settings actions
  updateSettings: (settings: Partial<BriefSettings>) => Promise<void>;

  // Asset actions
  addCustomAsset: (asset: Asset) => void;
  removeCustomAsset: (name: string) => void;
  getAllAssets: () => Asset[];

  // History actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useCanvasStore = create<CanvasState>()(
  liveblocks(
    (set, get) => ({
  // Initial state
  briefId: null,
  images: [],
  syncedImages: [],
  selectedIndices: [],
  saveStatus: "saved",
  isLoading: false,
  isInitialLoad: false,
  zoom: 1,
  stagePosition: { x: 0, y: 0 },
  briefName: "",
  briefDescription: "",
  settings: (() => {
    // Load settings from localStorage, fallback to defaults
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("briefSettings");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // Ignore parse errors
        }
      }
    }
    return {
      imageGenerationModel: "imagen-4-ultra",
      imageEditingModel: "nano-banana",
      imageUpscalingModel: "topaz-image-upscaler",
      defaultAspectRatio: "1:1",
      caaEnabled: true,
      caaApproach: "simple",
      caaModel: "openai/gpt-4.1-mini",
    };
  })(),
  customAssets: [],
  lastSavedState: "",

  setBriefId: (id) => set({ briefId: id }),

  loadBrief: async (briefId) => {
    // Reset state before loading new brief
    get().reset();

    set({ isLoading: true, isInitialLoad: true, briefId });

    try {
      const response = await fetch(`/api/briefs/${briefId}`);
      if (!response.ok) {
        set({ isLoading: false, isInitialLoad: false, briefId: null });
        return;
      }

      const brief = await response.json();

      if (brief.canvasState?.images && brief.canvasState.images.length > 0) {
        // Load images from S3 URLs
        const loadedImages = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          brief.canvasState.images.map(async (imgData: any, index: number) => {
            return new Promise<CanvasImage>((resolve) => {
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.src = imgData.s3Url;
              img.onload = () => {
                resolve({
                  id: imgData.id,
                  image: img,
                  width: imgData.width,
                  height: imgData.height,
                  s3Url: imgData.s3Url,
                  s3Key: imgData.s3Key,
                  x: imgData.x,
                  y: imgData.y,
                  rotation: imgData.rotation,
                  scaleX: imgData.scaleX,
                  scaleY: imgData.scaleY,
                  zIndex: imgData.zIndex ?? index, // Use saved zIndex or fallback to array index
                  sourceType: imgData.sourceType,
                  prompt: imgData.prompt,
                  sourceImages: imgData.sourceImages,
                  text: imgData.text,
                  color: imgData.color,
                  isAIGenerated: imgData.isAIGenerated,
                  uploading: false,
                });
              };
              img.onerror = () => {
                console.error("Failed to load image:", imgData.s3Url);
              };
            });
          }),
        );

        const stateString = JSON.stringify(brief.canvasState);
        const serializedImages = serializeImages(loadedImages);

        set({
          images: loadedImages,
          syncedImages: serializedImages, // IMPORTANT: Set both together to prevent sync loop
          zoom: brief.canvasState.zoom ?? 1,
          stagePosition: brief.canvasState.stagePosition ?? { x: 0, y: 0 },
          briefName: brief.name ?? "",
          briefDescription: brief.description ?? "",
          lastSavedState: stateString,
          saveStatus: "saved",
          isLoading: false,
          isInitialLoad: false,
        });

        // Push initial state to history
        pushHistory(loadedImages);

        // Update tracking refs to prevent initial sync loop
        previousImages = loadedImages;
        previousSyncedImages = serializedImages;
      } else {
        // No images but still set brief name/description
        set({
          briefName: brief.name ?? "",
          briefDescription: brief.description ?? "",
          isLoading: false,
          isInitialLoad: false,
        });
      }
    } catch (error) {
      console.error("Failed to load brief:", error);
      set({ isLoading: false, isInitialLoad: false });
    }
  },

  addImage: (image) => {
    set((state) => {
      // Reactions and text always go on top with zIndex starting at 10000
      // Regular images use zIndex 0-9999
      const isReaction = image.sourceType === "sticker" || image.sourceType === "postit" || image.sourceType === "text";

      if (isReaction) {
        // Find max zIndex among reactions and text
        const maxReactionZIndex = state.images
          .filter((img) => img.sourceType === "sticker" || img.sourceType === "postit" || img.sourceType === "text")
          .reduce((max, img) => Math.max(max, img.zIndex), 9999);
        const imageWithZIndex = { ...image, zIndex: maxReactionZIndex + 1 };

        return {
          images: [...state.images, imageWithZIndex],
        };
      } else {
        // Find max zIndex among non-reactions/non-text (must stay below 10000)
        const maxRegularZIndex = state.images
          .filter((img) => img.sourceType !== "sticker" && img.sourceType !== "postit" && img.sourceType !== "text")
          .reduce((max, img) => Math.max(max, img.zIndex), -1);
        // Ensure we never assign zIndex >= 10000 to regular images
        const nextZIndex = Math.min(maxRegularZIndex + 1, 9999);
        const imageWithZIndex = { ...image, zIndex: nextZIndex };

        return {
          images: [...state.images, imageWithZIndex],
        };
      }
    });
    get().markUnsaved();
    // Don't push history yet - wait until upload completes
  },

  updateImage: (index, updates) => {
    set((state) => ({
      images: state.images.map((img, i) =>
        i === index ? { ...img, ...updates } : img,
      ),
    }));
    get().markUnsaved();

    // Push history when upload completes or crop completes
    if (updates.uploading === false && updates.s3Url) {
      const { images } = get();
      pushHistory(images);
    }
  },

  deleteSelectedImages: () => {
    const { selectedIndices } = get();
    set((state) => ({
      images: state.images.filter(
        (_, index) => !selectedIndices.includes(index),
      ),
      selectedIndices: [],
    }));
    get().markUnsaved();

    // Push history after deletion
    const { images } = get();
    pushHistory(images);
  },

  setSelectedIndices: (indices) => {
    set({ selectedIndices: indices });
  },

  updateImageTransform: (index, node) => {
    set((state) => ({
      images: state.images.map((img, i) =>
        i === index
          ? {
              ...img,
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              scaleX: node.scaleX(),
              scaleY: node.scaleY(),
            }
          : img,
      ),
    }));
    get().markUnsaved();

    // Push history after transform
    const { images } = get();
    pushHistory(images);
  },

  setZoom: (zoom) => {
    set({ zoom });
    get().markUnsaved();
  },

  setStagePosition: (position) => {
    set({ stagePosition: position });
    get().markUnsaved();
  },

  setBriefName: (name) => {
    set({ briefName: name });
    get().markUnsaved();
  },

  setBriefDescription: (description) => {
    set({ briefDescription: description });
    get().markUnsaved();
  },

  saveToDatabase: async () => {
    const {
      briefId,
      images,
      zoom,
      stagePosition,
      briefName,
      briefDescription,
      lastSavedState,
      isInitialLoad,
    } = get();

    if (!briefId || isInitialLoad) return;

    // Build canvas state from current images and their refs
    const canvasState = {
      images: images
        .map((imgData, index) => {
          const node = getImageRef(index);
          return {
            id: imgData.id,
            s3Url: imgData.s3Url || "",
            s3Key: imgData.s3Key || "",
            x: node?.x() ?? imgData.x,
            y: node?.y() ?? imgData.y,
            width: imgData.width,
            height: imgData.height,
            rotation: node?.rotation() ?? imgData.rotation,
            scaleX: node?.scaleX() ?? imgData.scaleX,
            scaleY: node?.scaleY() ?? imgData.scaleY,
            zIndex: imgData.zIndex,
            sourceType: imgData.sourceType,
            prompt: imgData.prompt,
            sourceImages: imgData.sourceImages,
            text: imgData.text,
            color: imgData.color,
            isAIGenerated: imgData.isAIGenerated,
          };
        })
        .filter((img) => img.s3Url), // Only save uploaded images
      zoom,
      stagePosition,
    };

    const stateString = JSON.stringify(canvasState);

    // Don't save if nothing changed
    if (stateString === lastSavedState) {
      return;
    }

    set({ saveStatus: "saving" });

    try {
      const response = await fetch(`/api/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: briefName,
          description: briefDescription,
          canvasState,
        }),
      });

      if (response.ok) {
        set({ lastSavedState: stateString, saveStatus: "saved" });
      } else {
        set({ saveStatus: "unsaved" });
      }
    } catch (error) {
      console.error("Save error:", error);
      set({ saveStatus: "unsaved" });
    }
  },

  markUnsaved: () => {
    const { isInitialLoad, saveStatus } = get();
    // Don't mark unsaved during initial load
    if (!isInitialLoad && saveStatus !== "unsaved") {
      set({ saveStatus: "unsaved" });
    }
  },

  reset: () => {
    imageRefsMap.clear();
    clearHistory();
    set({
      briefId: null,
      images: [],
      selectedIndices: [],
      saveStatus: "saved",
      isLoading: false,
      isInitialLoad: false,
      zoom: 1,
      stagePosition: { x: 0, y: 0 },
      briefName: "",
      briefDescription: "",
      customAssets: [],
      lastSavedState: "",
      // NOTE: settings are NOT reset - they persist from localStorage
    });
  },

  // Settings actions
  updateSettings: async (newSettings) => {
    const { settings } = get();

    const updatedSettings = { ...settings, ...newSettings };
    set({ settings: updatedSettings });

    // Save settings to localStorage (user preferences)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("briefSettings", JSON.stringify(updatedSettings));
      } catch (error) {
        console.error("Failed to save settings to localStorage:", error);
      }
    }
  },

  // Asset actions
  addCustomAsset: (asset) => {
    set((state) => ({
      customAssets: [...state.customAssets, asset],
    }));
    get().markUnsaved();
  },

  removeCustomAsset: (name) => {
    set((state) => ({
      customAssets: state.customAssets.filter((a) => a.name !== name),
    }));
    get().markUnsaved();
  },

  getAllAssets: () => {
    const { customAssets } = get();
    return [...getPresetAssets(), ...customAssets];
  },

  // History actions
  undo: async () => {
    if (historyStep <= 0) return;

    historyStep--;
    const previousState = history[historyStep];

    try {
      const images = await deserializeImages(previousState);
      set({ images, selectedIndices: [] });
      get().markUnsaved();
    } catch (error) {
      console.error("Failed to undo:", error);
      historyStep++; // Revert step if failed
    }
  },

  redo: async () => {
    if (historyStep >= history.length - 1) return;

    historyStep++;
    const nextState = history[historyStep];

    try {
      const images = await deserializeImages(nextState);
      set({ images, selectedIndices: [] });
      get().markUnsaved();
    } catch (error) {
      console.error("Failed to redo:", error);
      historyStep--; // Revert step if failed
    }
  },

  canUndo: () => historyStep > 0,

  canRedo: () => historyStep < history.length - 1,
    }),
    {
      client: liveblocksClient,
      storageMapping: {
        // Sync these fields across all users
        syncedImages: true, // Serializable version (no HTMLImageElement)
        briefName: true, // Collaborative brief name
        briefDescription: true, // Collaborative brief description
        customAssets: true, // Custom user-uploaded assets
        // NOTE: zoom, stagePosition, settings are local - each user has their own viewport and preferences
      },
      presenceMapping: {
        // Per-user ephemeral state
        selectedIndices: true,
      },
    }
  )
);

// Track previous state to detect changes
let previousImages: CanvasImage[] = [];
let previousSyncedImages: SerializableImageState[] = [];

// Sync: When local images change, update syncedImages (serialize)
useCanvasStore.subscribe((state) => {
  const images = state.images;

  // Check if images array reference changed
  if (images === previousImages) return;
  previousImages = images;

  const synced = serializeImages(images);
  const currentSynced = state.syncedImages;

  // Only update if changed (prevent infinite loops)
  if (JSON.stringify(synced) !== JSON.stringify(currentSynced)) {
    useCanvasStore.setState({ syncedImages: synced });
  }
});

// Sync: When remote syncedImages change, update local images (deserialize)
useCanvasStore.subscribe((state) => {
  const syncedImages = state.syncedImages;

  // Check if syncedImages array reference changed
  if (syncedImages === previousSyncedImages) return;
  previousSyncedImages = syncedImages;

  const currentImages = state.images;

  // Check if we need to update (prevent infinite loops)
  const currentSynced = serializeImages(currentImages);
  if (JSON.stringify(currentSynced) === JSON.stringify(syncedImages)) {
    return;
  }

  // Load HTMLImageElements for each synced image
  Promise.all(
    syncedImages.map(async (data) => {
      const img = data.s3Url
        ? await loadImageElement(data.id, data.s3Url)
        : new window.Image();

      return {
        ...data,
        image: img,
      } as CanvasImage;
    })
  ).then((loadedImages) => {
    useCanvasStore.setState({ images: loadedImages });
  });
});
