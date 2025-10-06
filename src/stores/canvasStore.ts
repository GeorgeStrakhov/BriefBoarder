import { create } from "zustand";
import { liveblocks } from "@liveblocks/zustand";
import { liveblocksClient } from "@/lib/liveblocks";
import Konva from "konva";

export interface CanvasImage {
  id: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  s3Url?: string;
  s3Key?: string;
  uploading?: boolean;
  isGenerating?: boolean;
  isUpscaling?: boolean;
  isRemovingBackground?: boolean;
  isReaction?: boolean;
  reactionType?: "sticker" | "postit";
  assetType?: "brand" | "logo";
  text?: string;
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
  isReaction?: boolean;
  reactionType?: "sticker" | "postit";
  assetType?: "brand" | "logo";
  text?: string;
}

// Store imageRefs outside of Zustand to avoid re-render loops
const imageRefsMap = new Map<number, Konva.Image | null>();

export const getImageRef = (index: number) => imageRefsMap.get(index) || null;
export const setImageRef = (index: number, ref: Konva.Image | null) => {
  imageRefsMap.set(index, ref);
};
export const getAllImageRefs = () => imageRefsMap;

// Store HTMLImageElement objects outside of Zustand (not synced via Liveblocks)
const imageElementsMap = new Map<string, HTMLImageElement>();

const loadImageElement = (id: string, s3Url: string): Promise<HTMLImageElement> => {
  // Return cached if available
  if (imageElementsMap.has(id)) {
    return Promise.resolve(imageElementsMap.get(id)!);
  }

  // Load and cache
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
      isReaction: img.isReaction,
      reactionType: img.reactionType,
      assetType: img.assetType,
      text: img.text,
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
            isReaction: data.isReaction,
            reactionType: data.reactionType,
            assetType: data.assetType,
            text: data.text,
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

export interface BriefSettings {
  imageGenerationModel: string;
  imageEditingModel: string;
  imageUpscalingModel: string;
  defaultAspectRatio: string;
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
  settings: BriefSettings; // Synced

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
  saveToDatabase: () => Promise<void>;
  markUnsaved: () => void;
  reset: () => void;

  // Settings actions
  updateSettings: (settings: Partial<BriefSettings>) => Promise<void>;

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
  settings: {
    imageGenerationModel: "imagen-4-ultra",
    imageEditingModel: "nano-banana",
    imageUpscalingModel: "topaz-image-upscaler",
    defaultAspectRatio: "1:1",
  },
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
                  isReaction: imgData.isReaction,
                  reactionType: imgData.reactionType,
                  assetType: imgData.assetType,
                  text: imgData.text,
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
          settings: brief.settings
            ? {
                imageGenerationModel:
                  brief.settings.imageGenerationModel ?? "imagen-4-ultra",
                imageEditingModel:
                  brief.settings.imageEditingModel ?? "nano-banana",
                imageUpscalingModel:
                  brief.settings.imageUpscalingModel ?? "topaz-image-upscaler",
                defaultAspectRatio: brief.settings.defaultAspectRatio ?? "1:1",
              }
            : {
                imageGenerationModel: "imagen-4-ultra",
                imageEditingModel: "nano-banana",
                imageUpscalingModel: "topaz-image-upscaler",
                defaultAspectRatio: "1:1",
              },
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
        set({ isLoading: false, isInitialLoad: false });
      }
    } catch (error) {
      console.error("Failed to load brief:", error);
      set({ isLoading: false, isInitialLoad: false });
    }
  },

  addImage: (image) => {
    set((state) => {
      // Reactions always go on top with zIndex starting at 10000
      // Regular images use zIndex 0-9999
      const isReaction = image.isReaction || image.reactionType;

      if (isReaction) {
        // Find max zIndex among reactions
        const maxReactionZIndex = state.images
          .filter((img) => img.isReaction || img.reactionType)
          .reduce((max, img) => Math.max(max, img.zIndex), 9999);
        const imageWithZIndex = { ...image, zIndex: maxReactionZIndex + 1 };

        return {
          images: [...state.images, imageWithZIndex],
        };
      } else {
        // Find max zIndex among non-reactions (must stay below 10000)
        const maxRegularZIndex = state.images
          .filter((img) => !img.isReaction && !img.reactionType)
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
    const { images } = get();

    // If selecting new images, bring them to front within their category
    if (indices.length > 0) {
      // Check if selected items are reactions or regular images
      const selectedItems = indices.map((i) => images[i]);
      const areReactions = selectedItems.some(
        (img) => img?.isReaction || img?.reactionType,
      );

      // Find max zIndex within the appropriate category
      let maxZIndex: number;
      if (areReactions) {
        // Find max among reactions (zIndex >= 10000)
        maxZIndex = images
          .filter((img) => img.isReaction || img.reactionType)
          .reduce((max, img) => Math.max(max, img.zIndex), 9999);
      } else {
        // Find max among regular images (zIndex < 10000)
        maxZIndex = images
          .filter((img) => !img.isReaction && !img.reactionType)
          .reduce((max, img) => Math.max(max, img.zIndex), -1);
        // Cap at 9998 so adding indices doesn't cross into reaction territory
        maxZIndex = Math.min(maxZIndex, 9998 - indices.length);
      }

      // Update zIndex for newly selected images
      const updatedImages = images.map((img, i) => {
        if (indices.includes(i)) {
          const newZIndex = maxZIndex + 1 + indices.indexOf(i);
          // Double-check we don't cross into reaction territory
          return { ...img, zIndex: Math.min(newZIndex, 9999) };
        }
        return img;
      });

      set({ selectedIndices: indices, images: updatedImages });
      get().markUnsaved();

      // Push history when z-order changes
      pushHistory(updatedImages);
    } else {
      set({ selectedIndices: indices });
    }
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

  saveToDatabase: async () => {
    const {
      briefId,
      images,
      zoom,
      stagePosition,
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
            isReaction: imgData.isReaction,
            reactionType: imgData.reactionType,
            assetType: imgData.assetType,
            text: imgData.text,
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
        body: JSON.stringify({ canvasState }),
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
      settings: {
        imageGenerationModel: "imagen-4-ultra",
        imageEditingModel: "nano-banana",
        imageUpscalingModel: "topaz-image-upscaler",
        defaultAspectRatio: "1:1",
      },
      lastSavedState: "",
    });
  },

  // Settings actions
  updateSettings: async (newSettings) => {
    const { briefId, settings } = get();
    if (!briefId) return;

    const updatedSettings = { ...settings, ...newSettings };
    set({ settings: updatedSettings });

    try {
      await fetch(`/api/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updatedSettings }),
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
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
        settings: true,
        // NOTE: zoom and stagePosition are NOT synced - each user controls their own viewport
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
