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
import { X } from "lucide-react";

const POSTIT_COLORS = [
  { name: "Yellow", value: "#FEFF9C" },
  { name: "Pink", value: "#FFB3D9" },
  { name: "Blue", value: "#A7D8FF" },
  { name: "Green", value: "#BFFFB3" },
  { name: "Orange", value: "#FFD699" },
  { name: "Purple", value: "#E0BBE4" },
  { name: "Mint", value: "#B0F2B4" },
  { name: "Peach", value: "#FFCCB3" },
  { name: "Lavender", value: "#D4C5F9" },
  { name: "Coral", value: "#FFB3B3" },
];

interface PostItEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string;
  initialColor?: string;
  onSave: (text: string, color: string) => void;
}

export default function PostItEditDialog({
  open,
  onOpenChange,
  initialText = "",
  initialColor = "#FEFF9C",
  onSave,
}: PostItEditDialogProps) {
  const [text, setText] = useState(initialText);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setSelectedColor(initialColor);
    }
  }, [open, initialText, initialColor]);

  const handleSave = () => {
    onSave(text, selectedColor);
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
            <DialogTitle>Edit Post-it Note</DialogTitle>
          </DialogHeader>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your note..."
            rows={6}
            className="resize-none"
            autoFocus
          />

          {/* Color picker */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {POSTIT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  tabIndex={-1}
                  className="group relative h-8 w-8 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {selectedColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-black opacity-50" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave}>Save</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
