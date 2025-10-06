import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: ZoomControlsProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
        zIndex: 1000,
      }}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        className="bg-white"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        className="bg-white"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onResetZoom}
        className="bg-white text-xs"
        title="Reset Zoom"
      >
        {Math.round(zoom * 100)}%
      </Button>
    </div>
  );
}
