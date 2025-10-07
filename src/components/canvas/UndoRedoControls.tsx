import { Button } from "@/components/ui/button";
import { Undo2, Redo2 } from "lucide-react";

interface UndoRedoControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function UndoRedoControls({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: UndoRedoControlsProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        display: "flex",
        flexDirection: "row",
        gap: "8px",
        zIndex: 40,
      }}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        className="bg-white"
        title="Undo (Cmd+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        className="bg-white"
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
