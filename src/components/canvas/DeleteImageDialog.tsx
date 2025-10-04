"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";

interface DeleteImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  count?: number;
}

export default function DeleteImageDialog({
  open,
  onOpenChange,
  onConfirm,
  count = 1,
}: DeleteImageDialogProps) {
  const isMultiple = count > 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay style={{ zIndex: 9999 }} />
        <AlertDialogContent style={{ zIndex: 10000 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {isMultiple ? `${count} Images` : 'Image'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {isMultiple ? `these ${count} images` : 'this image'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
