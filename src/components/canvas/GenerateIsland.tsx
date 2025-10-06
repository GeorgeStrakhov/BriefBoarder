import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";

interface GenerateIslandProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isMounted: boolean;
  caaEnabled: boolean;
  caaApproach: string;
  imageEditingModel: string;
  readySelectedCount: number;
}

export default function GenerateIsland({
  prompt,
  onPromptChange,
  onGenerate,
  isMounted,
  caaEnabled,
  caaApproach,
  imageEditingModel,
  readySelectedCount,
}: GenerateIslandProps) {
  return (
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
      {isMounted && (caaEnabled || readySelectedCount > 0) && (
        <div className="mb-2 text-xs text-gray-500">
          {caaEnabled && `Assistant active (${caaApproach})`}
          {caaEnabled && readySelectedCount > 0 && " • "}
          {readySelectedCount > 0 && (
            <>
              {readySelectedCount} image{readySelectedCount !== 1 ? "s" : ""}{" "}
              selected • Using {imageEditingModel}
            </>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="h-[68px] resize-none"
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onGenerate();
            }
          }}
        />
        <Button
          onClick={onGenerate}
          disabled={!prompt.trim()}
          size="icon"
          className="h-[80px] w-[80px] flex-shrink-0"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
