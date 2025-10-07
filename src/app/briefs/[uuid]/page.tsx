"use client";
import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Home,
  Upload,
  Trash2,
  Sparkles,
  Undo2,
  Loader2,
} from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";
import Canvas from "@/components/canvas/Canvas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function BriefCanvas({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const router = useRouter();

  const {
    loadBrief,
    isLoading,
    saveToDatabase,
    settings,
    updateSettings,
    briefName,
    briefDescription,
    setBriefName,
    setBriefDescription,
    getAllAssets,
    addCustomAsset,
    removeCustomAsset,
  } = useCanvasStore();

  // Get Liveblocks state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveblocks = useCanvasStore((state: any) => state.liveblocks);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [originalName, setOriginalName] = useState(""); // For undo
  const [originalDescription, setOriginalDescription] = useState(""); // For undo
  const [isAIEnhanced, setIsAIEnhanced] = useState(false); // Track if AI was used
  const [isEnhancing, setIsEnhancing] = useState(false); // Loading state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent hydration errors from localStorage-based settings
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Enter Liveblocks room and load brief on mount
  useEffect(() => {
    // Small delay to ensure Liveblocks middleware is ready
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enterRoom = (useCanvasStore as any).getState().liveblocks
        ?.enterRoom;
      if (enterRoom) {
        enterRoom(uuid);
      }
    }, 100);

    // Load brief data
    loadBrief(uuid);

    // Leave room on cleanup
    return () => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leaveRoom = (useCanvasStore as any).getState().liveblocks
        ?.leaveRoom;
      if (leaveRoom) {
        leaveRoom();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  // Autosave canvas every 5 seconds (leader-only to prevent duplicate writes)
  useEffect(() => {
    const interval = setInterval(() => {
      // Leader election: lowest connectionId is the leader
      // This ensures exactly one leader even with multiple users
      const self = liveblocks?.room?.getSelf?.();
      const others = liveblocks?.others || [];

      if (!self) return;

      const myConnectionId = self.connectionId;
      const allConnectionIds = [
        myConnectionId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...others.map((o: any) => o.connectionId),
      ];
      const leaderId = Math.min(...allConnectionIds);
      const isLeader = myConnectionId === leaderId;

      if (isLeader) {
        saveToDatabase();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [saveToDatabase, liveblocks]);

  const handleOpenEditDialog = () => {
    setEditingName(briefName);
    setEditingDescription(briefDescription);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    setBriefName(editingName);
    setBriefDescription(editingDescription);
    setIsEditDialogOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingName("");
    setEditingDescription("");
    setIsAIEnhanced(false);
    setOriginalName("");
    setOriginalDescription("");
    setIsEditDialogOpen(false);
  };

  const handleEnhanceBrief = async () => {
    // Store original values for undo
    setOriginalName(editingName);
    setOriginalDescription(editingDescription);
    setIsEnhancing(true);

    try {
      const response = await fetch("/api/enhance-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefName: editingName,
          briefDescription: editingDescription,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEditingName(data.enhancedName);
        setEditingDescription(data.enhancedDescription);
        setIsAIEnhanced(true);
        toast.success("Brief enhanced by AI");
      } else {
        toast.error(data.error || "Failed to enhance brief");
      }
    } catch (error) {
      console.error("Enhance brief error:", error);
      toast.error("Failed to enhance brief");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndoEnhance = () => {
    setEditingName(originalName);
    setEditingDescription(originalDescription);
    setIsAIEnhanced(false);
    toast.success("Reverted to original");
  };

  const handleSettingChange = async (key: string, value: string | boolean) => {
    await updateSettings({ [key]: value });
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadingAsset(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Generate a unique name from filename
        const name = file.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

        addCustomAsset({
          name,
          label: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          url: data.s3Url,
          type: "custom",
        });

        toast.success("Asset uploaded");

        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Asset upload error:", error);
      toast.error("Failed to upload asset");
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleDeleteAsset = (name: string) => {
    removeCustomAsset(name);
    toast.success("Asset removed");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-lg text-gray-600">
        Loading your board...
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div className="flex w-80 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <div className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(true)}
              className="ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* Brief Info with Edit Dialog */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">
                  Brief
                </label>
                <Dialog
                  open={isEditDialogOpen}
                  onOpenChange={setIsEditDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenEditDialog}
                      className="h-7 px-2"
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                      <DialogTitle>Edit Brief</DialogTitle>
                      <DialogDescription>
                        Update your brief name and details
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Brief name"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Details</label>
                        <Textarea
                          value={editingDescription}
                          onChange={(e) =>
                            setEditingDescription(e.target.value)
                          }
                          placeholder="Brief details"
                          rows={12}
                          className="resize-none"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleEnhanceBrief}
                          disabled={isEnhancing}
                        >
                          {isEnhancing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {isEnhancing ? "Enhancing..." : "AI Enhance"}
                        </Button>
                        {isAIEnhanced && (
                          <Button
                            variant="outline"
                            onClick={handleUndoEnhance}
                            disabled={isEnhancing}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {briefName || "Untitled Brief"}
                  </p>
                </div>
                {briefDescription && (
                  <p className="line-clamp-3 text-xs text-gray-600">
                    {briefDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Creative Assistant */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Creative Assistant
                </summary>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">
                      Enable Creative Assistant
                    </label>
                    {isMounted && (
                      <Switch
                        checked={settings.caaEnabled}
                        onCheckedChange={(checked) =>
                          handleSettingChange("caaEnabled", checked)
                        }
                      />
                    )}
                  </div>

                  {isMounted && settings.caaEnabled && (
                    <>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-500">
                          Style
                        </label>
                        <Select
                          value={settings.caaApproach}
                          onValueChange={(value) =>
                            handleSettingChange("caaApproach", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple</SelectItem>
                            <SelectItem value="dramatic">Dramatic</SelectItem>
                            <SelectItem value="bernbach">Bernbach</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-500">
                          LLM
                        </label>
                        <Select
                          value={settings.caaModel}
                          onValueChange={(value) =>
                            handleSettingChange("caaModel", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="anthropic/claude-sonnet-4">
                              Claude Sonnet 4
                            </SelectItem>
                            <SelectItem value="openai/gpt-4.1-mini">
                              GPT-4.1 Mini
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </details>
            </div>

            {/* Image Generation */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Image Generation
                </summary>
                <div className="space-y-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                      Image Generation Model
                    </label>
                    <Select
                      value={settings.imageGenerationModel}
                      onValueChange={(value) =>
                        handleSettingChange("imageGenerationModel", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imagen-4-ultra">
                          imagen-4-ultra
                        </SelectItem>
                        <SelectItem value="flux-pro-1-1">
                          flux-pro-1-1
                        </SelectItem>
                        <SelectItem value="flux-schnell">
                          flux-schnell (fast)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                      Image Editing Model
                    </label>
                    <Select
                      value={settings.imageEditingModel}
                      onValueChange={(value) =>
                        handleSettingChange("imageEditingModel", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nano-banana">nano-banana</SelectItem>
                        <SelectItem value="flux-kontext">
                          flux-kontext-pro
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                      Image Upscaling Model
                    </label>
                    <Select
                      value={settings.imageUpscalingModel}
                      onValueChange={(value) =>
                        handleSettingChange("imageUpscalingModel", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="topaz-image-upscaler">
                          topaz-image-upscaler
                        </SelectItem>
                        <SelectItem value="clarity-upscaler">
                          clarity-upscaler
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                      Default Aspect Ratio
                    </label>
                    <Select
                      value={settings.defaultAspectRatio}
                      onValueChange={(value) =>
                        handleSettingChange("defaultAspectRatio", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="16:9">16:9</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </details>
            </div>

            {/* Reactions & Notes */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Reactions, Text & Notes
                </summary>
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                      Stickers
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        "❤️",
                        "👍",
                        "👎",
                        "🔥",
                        "🤣",
                        "❓",
                        "❌",
                        "🤔",
                        "✏️",
                        "📝",
                      ].map((emoji) => (
                        <div
                          key={emoji}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("sticker", emoji);
                          }}
                          className="flex cursor-move items-center justify-center rounded p-2 text-2xl transition-transform hover:scale-110 hover:bg-gray-100"
                        >
                          {emoji}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Assets */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Assets
                </summary>
                <div className="mb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAssetUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAsset}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingAsset ? "Uploading..." : "Upload Asset"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {getAllAssets().map((asset) => (
                    <div
                      key={asset.url}
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("asset", asset.url);
                      }}
                      className="group relative cursor-move transition-opacity hover:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.label}
                        className="h-20 w-full rounded border border-gray-200 object-cover"
                        crossOrigin="anonymous"
                      />
                      <p className="mt-1 text-center text-xs text-gray-500">
                        {asset.label}
                      </p>
                      {asset.type === "custom" && (
                        <button
                          onClick={() => handleDeleteAsset(asset.name)}
                          className="absolute top-1 right-1 rounded bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                          title="Delete asset"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar toggle button (when collapsed) */}
      {sidebarCollapsed && (
        <div className="border-r border-gray-200 bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(false)}
            className="m-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div className="min-w-[600px] flex-1">
        <Canvas briefName={briefName} briefDescription={briefDescription} />
      </div>
    </div>
  );
}
