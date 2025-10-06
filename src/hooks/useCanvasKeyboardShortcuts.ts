import { useEffect } from "react";

interface UseCanvasKeyboardShortcutsProps {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  deleteSelectedImages: () => void;
  selectedIndices: number[];
}

export function useCanvasKeyboardShortcuts({
  undo,
  redo,
  canUndo,
  canRedo,
  deleteSelectedImages,
  selectedIndices,
}: UseCanvasKeyboardShortcutsProps) {
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
}
