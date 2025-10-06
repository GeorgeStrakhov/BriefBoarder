import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Loader2, Check, Eye, EyeOff } from "lucide-react";

interface CanvasControlsProps {
  isLeader: boolean;
  saveStatus: "saved" | "saving" | "unsaved";
  showReactions: boolean;
  onToggleReactions: () => void;
  hasImages: boolean;
  onDownloadBoard: (includeReactions: boolean) => void;
}

export default function CanvasControls({
  isLeader,
  saveStatus,
  showReactions,
  onToggleReactions,
  hasImages,
  onDownloadBoard,
}: CanvasControlsProps) {
  return (
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
        title={
          isLeader ? (saveStatus === "saved" ? "Saved" : "Saving...") : "Synced"
        }
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
        onClick={onToggleReactions}
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
      {hasImages && (
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
            <DropdownMenuItem onClick={() => onDownloadBoard(false)}>
              Download Board
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownloadBoard(true)}>
              Download with Notes & Reactions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
