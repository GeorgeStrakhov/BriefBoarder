import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Crop,
  Download,
  Trash2,
  Sparkles,
  ArrowUpCircle,
  Eraser,
  Link,
  Pencil,
  Layers,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type SelectionItemType = "postit" | "emoji" | "text" | "image" | "multiple";

interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionContextMenuProps {
  selectionBounds: SelectionBounds | null;
  zoom: number;
  stagePosition: { x: number; y: number };
  selectedItemType: SelectionItemType;
  selectedIndices: number[];
  hasPrompt: boolean;
  onEditPostIt: () => void;
  onEditText: () => void;
  onCopyPrompt: () => void;
  onOpenCrop: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onUpscale: () => void;
  onRemoveBackground: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onMergeSelection: () => void;
  onDelete: () => void;
}

export default function SelectionContextMenu({
  selectionBounds,
  zoom,
  stagePosition,
  selectedItemType,
  selectedIndices,
  hasPrompt,
  onEditPostIt,
  onEditText,
  onCopyPrompt,
  onOpenCrop,
  onDownload,
  onCopyUrl,
  onUpscale,
  onRemoveBackground,
  onBringToFront,
  onSendToBack,
  onMergeSelection,
  onDelete,
}: SelectionContextMenuProps) {
  if (!selectionBounds || selectedIndices.length === 0) return null;

  return (
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
          {/* Post-it note: Edit + Layer + Delete */}
          {selectedItemType === "postit" && (
            <>
              <DropdownMenuItem onClick={onEditPostIt}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBringToFront}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Bring to Front
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendToBack}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Send to Back
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}

          {/* Emoji sticker: Layer + Delete */}
          {selectedItemType === "emoji" && (
            <>
              <DropdownMenuItem onClick={onBringToFront}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Bring to Front
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendToBack}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Send to Back
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}

          {/* Text element: Edit + Layer + Delete */}
          {selectedItemType === "text" && (
            <>
              <DropdownMenuItem onClick={onEditText}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBringToFront}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Bring to Front
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendToBack}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Send to Back
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}

          {/* Regular image: All options */}
          {selectedItemType === "image" && (
            <>
              {hasPrompt && (
                <DropdownMenuItem onClick={onCopyPrompt}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Copy Prompt
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onOpenCrop}>
                <Crop className="mr-2 h-4 w-4" />
                Crop
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyUrl}>
                <Link className="mr-2 h-4 w-4" />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUpscale}>
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Upscale
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemoveBackground}>
                <Eraser className="mr-2 h-4 w-4" />
                Remove Background
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBringToFront}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Bring to Front
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendToBack}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Send to Back
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}

          {/* Multiple items selected: Merge + Layer + Delete */}
          {selectedItemType === "multiple" && (
            <>
              <DropdownMenuItem onClick={onMergeSelection}>
                <Layers className="mr-2 h-4 w-4" />
                Merge Selection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBringToFront}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Bring to Front
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendToBack}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Send to Back
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedIndices.length})
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
