import { create } from 'zustand';
import Konva from 'konva';

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
  reactionType?: 'sticker' | 'postit';
  assetType?: 'brand' | 'logo';
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
  reactionType?: 'sticker' | 'postit';
  assetType?: 'brand' | 'logo';
  text?: string;
}

// Store imageRefs outside of Zustand to avoid re-render loops
const imageRefsMap = new Map<number, Konva.Image | null>();

export const getImageRef = (index: number) => imageRefsMap.get(index) || null;
export const setImageRef = (index: number, ref: Konva.Image | null) => {
  imageRefsMap.set(index, ref);
};
export const getAllImageRefs = () => imageRefsMap;

// History management outside of Zustand to avoid re-renders
const MAX_HISTORY = 50;
let history: SerializableImageState[][] = [];
let historyStep = -1;

// Serialize images array for history
const serializeImages = (images: CanvasImage[]): SerializableImageState[] => {
  return images
    .filter(img => img.s3Url) // Only save uploaded images
    .map(img => ({
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
const deserializeImages = async (serialized: SerializableImageState[]): Promise<CanvasImage[]> => {
  return Promise.all(
    serialized.map(async (data) => {
      return new Promise<CanvasImage>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = data.s3Url || '';
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
    })
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
  // State
  briefId: string | null;
  images: CanvasImage[];
  selectedIndices: number[];
  saveStatus: 'saved' | 'saving' | 'unsaved';
  isLoading: boolean;
  isInitialLoad: boolean;
  zoom: number;
  stagePosition: { x: number; y: number };
  settings: BriefSettings;

  // Non-reactive metadata
  lastSavedState: string;

  // Actions
  setBriefId: (id: string) => void;
  loadBrief: (briefId: string) => Promise<void>;
  addImage: (image: Omit<CanvasImage, 'zIndex'>) => void;
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

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  briefId: null,
  images: [],
  selectedIndices: [],
  saveStatus: 'saved',
  isLoading: false,
  isInitialLoad: false,
  zoom: 1,
  stagePosition: { x: 0, y: 0 },
  settings: {
    imageGenerationModel: 'imagen-4-ultra',
    imageEditingModel: 'nano-banana',
    imageUpscalingModel: 'topaz-image-upscaler',
    defaultAspectRatio: '1:1',
  },
  lastSavedState: '',

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
          brief.canvasState.images.map(async (imgData: any, index: number) => {
            return new Promise<CanvasImage>((resolve) => {
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
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
                console.error('Failed to load image:', imgData.s3Url);
              };
            });
          })
        );

        const stateString = JSON.stringify(brief.canvasState);
        set({
          images: loadedImages,
          zoom: brief.canvasState.zoom ?? 1,
          stagePosition: brief.canvasState.stagePosition ?? { x: 0, y: 0 },
          settings: brief.settings ? {
            imageGenerationModel: brief.settings.imageGenerationModel ?? 'imagen-4-ultra',
            imageEditingModel: brief.settings.imageEditingModel ?? 'nano-banana',
            imageUpscalingModel: brief.settings.imageUpscalingModel ?? 'topaz-image-upscaler',
            defaultAspectRatio: brief.settings.defaultAspectRatio ?? '1:1',
          } : {
            imageGenerationModel: 'imagen-4-ultra',
            imageEditingModel: 'nano-banana',
            imageUpscalingModel: 'topaz-image-upscaler',
            defaultAspectRatio: '1:1',
          },
          lastSavedState: stateString,
          saveStatus: 'saved',
          isLoading: false,
          isInitialLoad: false,
        });

        // Push initial state to history
        pushHistory(loadedImages);
      } else {
        set({ isLoading: false, isInitialLoad: false });
      }
    } catch (error) {
      console.error('Failed to load brief:', error);
      set({ isLoading: false, isInitialLoad: false });
    }
  },

  addImage: (image) => {
    set((state) => {
      // Find max zIndex and assign next available
      const maxZIndex = state.images.reduce((max, img) => Math.max(max, img.zIndex), -1);
      const imageWithZIndex = { ...image, zIndex: maxZIndex + 1 };

      return {
        images: [...state.images, imageWithZIndex],
        // Don't auto-select newly added images
      };
    });
    get().markUnsaved();
    // Don't push history yet - wait until upload completes
  },

  updateImage: (index, updates) => {
    set((state) => ({
      images: state.images.map((img, i) => (i === index ? { ...img, ...updates } : img)),
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
      images: state.images.filter((_, index) => !selectedIndices.includes(index)),
      selectedIndices: [],
    }));
    get().markUnsaved();

    // Push history after deletion
    const { images } = get();
    pushHistory(images);
  },

  setSelectedIndices: (indices) => {
    const { images } = get();

    // If selecting new images, bring them to front
    if (indices.length > 0) {
      // Find max zIndex
      const maxZIndex = images.reduce((max, img) => Math.max(max, img.zIndex), -1);

      // Update zIndex for newly selected images
      const updatedImages = images.map((img, i) => {
        if (indices.includes(i)) {
          return { ...img, zIndex: maxZIndex + 1 + indices.indexOf(i) };
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
          : img
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
    const { briefId, images, zoom, stagePosition, lastSavedState, isInitialLoad } = get();

    if (!briefId || isInitialLoad) return;

    // Build canvas state from current images and their refs
    const canvasState = {
      images: images
        .map((imgData, index) => {
          const node = getImageRef(index);
          return {
            id: imgData.id,
            s3Url: imgData.s3Url || '',
            s3Key: imgData.s3Key || '',
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

    set({ saveStatus: 'saving' });

    try {
      const response = await fetch(`/api/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasState }),
      });

      if (response.ok) {
        set({ lastSavedState: stateString, saveStatus: 'saved' });
      } else {
        set({ saveStatus: 'unsaved' });
      }
    } catch (error) {
      console.error('Save error:', error);
      set({ saveStatus: 'unsaved' });
    }
  },

  markUnsaved: () => {
    const { isInitialLoad, saveStatus } = get();
    // Don't mark unsaved during initial load
    if (!isInitialLoad && saveStatus !== 'unsaved') {
      set({ saveStatus: 'unsaved' });
    }
  },

  reset: () => {
    imageRefsMap.clear();
    clearHistory();
    set({
      briefId: null,
      images: [],
      selectedIndices: [],
      saveStatus: 'saved',
      isLoading: false,
      isInitialLoad: false,
      zoom: 1,
      stagePosition: { x: 0, y: 0 },
      settings: {
        imageGenerationModel: 'imagen-4-ultra',
        imageEditingModel: 'nano-banana',
        imageUpscalingModel: 'topaz-image-upscaler',
        defaultAspectRatio: '1:1',
      },
      lastSavedState: '',
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
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
      console.error('Failed to undo:', error);
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
      console.error('Failed to redo:', error);
      historyStep--; // Revert step if failed
    }
  },

  canUndo: () => historyStep > 0,

  canRedo: () => historyStep < history.length - 1,
}));
