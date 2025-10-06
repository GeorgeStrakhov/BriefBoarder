"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from "lucide-react";

const AVAILABLE_FONTS = [
  { name: "Geist", value: "var(--font-geist-sans)" },
  { name: "Inter", value: "var(--font-inter)" },
  { name: "Playfair Display", value: "var(--font-playfair)" },
  { name: "Bebas Neue", value: "var(--font-bebas)" },
  { name: "Caveat", value: "var(--font-caveat)" },
  { name: "Roboto Mono", value: "var(--font-roboto-mono)" },
  { name: "Orbitron", value: "var(--font-orbitron)" },
];

interface TextEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string;
  initialFontFamily?: string;
  initialLineHeight?: number;
  initialBold?: boolean;
  initialItalic?: boolean;
  initialColor?: string;
  initialAlign?: "left" | "center" | "right";
  initialShadow?: boolean;
  onSave: (config: {
    text: string;
    fontFamily: string;
    lineHeight: number;
    bold: boolean;
    italic: boolean;
    color: string;
    align: "left" | "center" | "right";
    shadow: boolean;
  }) => void;
}

export default function TextEditDialog({
  open,
  onOpenChange,
  initialText = "",
  initialFontFamily = "var(--font-geist-sans)",
  initialLineHeight = 1.2,
  initialBold = false,
  initialItalic = false,
  initialColor = "#000000",
  initialAlign = "left",
  initialShadow = false,
  onSave,
}: TextEditDialogProps) {
  const [text, setText] = useState(initialText);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [lineHeight, setLineHeight] = useState(initialLineHeight);
  const [bold, setBold] = useState(initialBold);
  const [italic, setItalic] = useState(initialItalic);
  const [color, setColor] = useState(initialColor);
  const [align, setAlign] = useState<"left" | "center" | "right">(initialAlign);
  const [shadow, setShadow] = useState(initialShadow);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setFontFamily(initialFontFamily);
      setLineHeight(initialLineHeight);
      setBold(initialBold);
      setItalic(initialItalic);
      setColor(initialColor);
      setAlign(initialAlign);
      setShadow(initialShadow);
    }
  }, [open, initialText, initialFontFamily, initialLineHeight, initialBold, initialItalic, initialColor, initialAlign, initialShadow]);

  const handleSave = () => {
    if (!text.trim()) return; // Prevent empty text
    onSave({
      text,
      fontFamily,
      lineHeight,
      bold,
      italic,
      color,
      align,
      shadow,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay style={{ zIndex: 9999 }} />
        <div
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200"
          style={{ zIndex: 10000 }}
        >
          <DialogClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>Add Text</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Text content */}
            <div>
              <Label htmlFor="text-content">Text</Label>
              <Textarea
                id="text-content"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text..."
                rows={3}
                className="resize-none overflow-y-scroll"
                autoFocus
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              />
            </div>

            {/* Font family */}
            <div>
              <Label htmlFor="font-family">Font</Label>
              <select
                id="font-family"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {AVAILABLE_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Line height */}
            <div>
              <Label htmlFor="line-height">Line Height ({lineHeight.toFixed(1)})</Label>
              <input
                id="line-height"
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Bold and Italic */}
            <div>
              <Label>Style</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={bold ? "default" : "outline"}
                  size="icon"
                  onClick={() => setBold(!bold)}
                  tabIndex={-1}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={italic ? "default" : "outline"}
                  size="icon"
                  onClick={() => setItalic(!italic)}
                  tabIndex={-1}
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Text color */}
            <div>
              <Label htmlFor="text-color">Color</Label>
              <div className="flex gap-2">
                <input
                  id="text-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer rounded border"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 flex-1 rounded-md border px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Text align */}
            <div>
              <Label>Alignment</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={align === "left" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setAlign("left")}
                  tabIndex={-1}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={align === "center" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setAlign("center")}
                  tabIndex={-1}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={align === "right" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setAlign("right")}
                  tabIndex={-1}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Shadow toggle */}
            <div className="flex items-center gap-2">
              <input
                id="text-shadow"
                type="checkbox"
                checked={shadow}
                onChange={(e) => setShadow(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="text-shadow" className="cursor-pointer">
                Add shadow
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={!text.trim()}>
              Save
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
