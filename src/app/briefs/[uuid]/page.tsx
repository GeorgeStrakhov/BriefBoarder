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
  X,
  Check,
  Home,
  Upload,
  Trash2,
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
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enter Liveblocks room and load brief on mount
  useEffect(() => {
    // Small delay to ensure Liveblocks middleware is ready
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enterRoom = (useCanvasStore as any).getState().liveblocks?.enterRoom;
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
      const leaveRoom = (useCanvasStore as any).getState().liveblocks?.leaveRoom;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allConnectionIds = [myConnectionId, ...others.map((o: any) => o.connectionId)];
      const leaderId = Math.min(...allConnectionIds);
      const isLeader = myConnectionId === leaderId;

      if (isLeader) {
        saveToDatabase();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [saveToDatabase, liveblocks]);

  const handleEditName = () => {
    setEditingName(briefName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    setBriefName(editingName);
    setIsEditingName(false);
  };

  const handleCancelName = () => {
    setEditingName("");
    setIsEditingName(false);
  };

  const handleEditDescription = () => {
    setEditingDescription(briefDescription);
    setIsEditingDescription(true);
  };

  const handleSaveDescription = () => {
    setBriefDescription(editingDescription);
    setIsEditingDescription(false);
  };

  const handleCancelDescription = () => {
    setEditingDescription("");
    setIsEditingDescription(false);
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
            {/* Name field */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Name
              </label>
              {isEditingName ? (
                <div className="space-y-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Brief name"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      className="flex-1"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelName}
                      className="flex-1"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50"
                  onClick={handleEditName}
                >
                  <span className="text-sm">{briefName || "Click to add name"}</span>
                  <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </div>

            {/* Details field */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Details
              </label>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditingDescription(e.target.value)
                    }
                    placeholder="Brief details"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      className="flex-1"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelDescription}
                      className="flex-1"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="group max-h-[200px] cursor-pointer overflow-y-auto rounded-md px-3 py-2 hover:bg-gray-50"
                  onClick={handleEditDescription}
                >
                  <div className="flex items-start justify-between">
                    <p className="flex-1 text-sm whitespace-pre-wrap text-gray-700">
                      {briefDescription || "Click to add details"}
                    </p>
                    <Pencil className="ml-2 h-3 w-3 flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Settings
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
                    <Switch
                      checked={settings.caaEnabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange("caaEnabled", checked)
                      }
                    />
                  </div>

                  {settings.caaEnabled && (
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

            {/* Reactions & Notes */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <details open>
                <summary className="mb-3 cursor-pointer text-sm font-medium text-gray-700">
                  Reactions & Notes
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
                        "⭐",
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
                      className="group relative"
                    >
                      <div
                        draggable="true"
                        onDragStart={(e) => {
                          e.dataTransfer.setData("asset", asset.url);
                        }}
                        className="cursor-move transition-opacity hover:opacity-80"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt={asset.label}
                          className="h-20 w-full rounded border border-gray-200 object-cover"
                        />
                        <p className="mt-1 text-center text-xs text-gray-500">
                          {asset.label}
                        </p>
                      </div>
                      {asset.type === "custom" && (
                        <button
                          onClick={() => handleDeleteAsset(asset.name)}
                          className="absolute top-1 right-1 rounded bg-red-500 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
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
