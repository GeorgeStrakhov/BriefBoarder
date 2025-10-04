"use client";
import { useState, useRef } from 'react';
import ReactCrop, { Crop as CropType, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
  onSave: (blob: Blob, crop: PixelCrop) => Promise<void>;
}

export default function CropDialog({
  open,
  onOpenChange,
  imageUrl,
  onSave,
}: CropDialogProps) {
  const [crop, setCrop] = useState<CropType>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<'free' | 'square' | 'portrait' | 'landscape'>('free');
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  const getCropAspect = () => {
    switch (cropAspectRatio) {
      case 'square':
        return 1;
      case 'portrait':
        return 9 / 16;
      case 'landscape':
        return 16 / 9;
      case 'free':
      default:
        return undefined;
    }
  };

  const getCroppedImage = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas to full resolution
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, 'image/png');
    });
  };

  const handleSaveCrop = async () => {
    if (!completedCrop || !cropImageRef.current) return;

    setIsCropping(true);

    try {
      const croppedBlob = await getCroppedImage(cropImageRef.current, completedCrop);
      await onSave(croppedBlob, completedCrop);

      // Reset state after successful save
      setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
      setCompletedCrop(null);
      setCropAspectRatio('free');
      setIsCropping(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Crop error:', error);
      setIsCropping(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset when opening
      setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
      setCompletedCrop(null);
      setCropAspectRatio('free');
    }
    onOpenChange(newOpen);
  };

  const handleAspectRatioChange = (newAspectRatio: 'free' | 'square' | 'portrait' | 'landscape') => {
    setCropAspectRatio(newAspectRatio);

    // Update crop to match new aspect ratio while maintaining position
    if (newAspectRatio !== 'free' && cropImageRef.current) {
      const aspect = newAspectRatio === 'square' ? 1 : newAspectRatio === 'portrait' ? 9 / 16 : 16 / 9;

      const { width, height } = cropImageRef.current;

      // Use current crop dimensions and position, just adjust aspect
      const newCrop = makeAspectCrop(
        {
          unit: crop.unit,
          width: crop.width,
          x: crop.x,
          y: crop.y,
        },
        aspect,
        width,
        height
      );

      setCrop(newCrop);
    }
    // For free mode, keep the current crop as-is (no reset needed)
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay style={{ zIndex: 9999 }} />
        <div
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200"
          style={{ zIndex: 10000 }}
        >
          <DialogClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
            <DialogDescription>
              Drag the corners to resize, drag the crop area to reposition
            </DialogDescription>
          </DialogHeader>

        {/* Aspect Ratio Selection */}
        <div className="flex gap-2">
          <Button
            variant={cropAspectRatio === 'free' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAspectRatioChange('free')}
          >
            Free
          </Button>
          <Button
            variant={cropAspectRatio === 'square' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAspectRatioChange('square')}
          >
            Square
          </Button>
          <Button
            variant={cropAspectRatio === 'portrait' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAspectRatioChange('portrait')}
          >
            Portrait (9:16)
          </Button>
          <Button
            variant={cropAspectRatio === 'landscape' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAspectRatioChange('landscape')}
          >
            Landscape (16:9)
          </Button>
        </div>

        <div className="flex items-center justify-center w-full bg-gray-100 p-4">
          {imageUrl && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={getCropAspect()}
            >
              <img
                ref={cropImageRef}
                src={imageUrl}
                alt="Crop preview"
                style={{ maxHeight: '500px', maxWidth: '100%' }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCropping}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveCrop} disabled={isCropping || !completedCrop}>
            {isCropping ? 'Saving...' : 'Save Crop'}
          </Button>
        </DialogFooter>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
