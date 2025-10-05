"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Pencil, X, Check, Home } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import Canvas from '@/components/canvas/Canvas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BriefCanvas({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const router = useRouter();

  const { loadBrief, isLoading, saveToDatabase, settings, updateSettings } = useCanvasStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [briefNotFound, setBriefNotFound] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load brief on mount
  useEffect(() => {
    loadBrief(uuid);
    fetchBrief();
  }, [uuid, loadBrief]);

  // Autosave canvas every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveToDatabase();
    }, 5000);

    return () => clearInterval(interval);
  }, [saveToDatabase]);

  const fetchBrief = async () => {
    try {
      const response = await fetch(`/api/briefs/${uuid}`);
      if (response.ok) {
        const data = await response.json();
        setName(data.name);
        setDescription(data.description || '');
      } else if (response.status === 404) {
        setBriefNotFound(true);
      }
    } catch (error) {
      console.error('Failed to fetch brief:', error);
    }
  };

  if (briefNotFound) {
    notFound();
  }

  const handleEditName = () => {
    setEditingName(name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    try {
      const response = await fetch(`/api/briefs/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      if (response.ok) {
        setName(editingName);
        setIsEditingName(false);
      }
    } catch (error) {
      console.error('Failed to save name:', error);
    }
  };

  const handleCancelName = () => {
    setEditingName('');
    setIsEditingName(false);
  };

  const handleEditDescription = () => {
    setEditingDescription(description);
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    try {
      const response = await fetch(`/api/briefs/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editingDescription }),
      });

      if (response.ok) {
        setDescription(editingDescription);
        setIsEditingDescription(false);
      }
    } catch (error) {
      console.error('Failed to save description:', error);
    }
  };

  const handleCancelDescription = () => {
    setEditingDescription('');
    setIsEditingDescription(false);
  };

  const handleSettingChange = async (key: string, value: string) => {
    await updateSettings({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-gray-50 flex items-center justify-center text-lg text-gray-600">
        Loading your board...
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
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

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Name field */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Name</label>
              {isEditingName ? (
                <div className="space-y-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Brief name"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveName} className="flex-1">
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelName} className="flex-1">
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                  onClick={handleEditName}
                >
                  <span className="text-sm">{name || 'Click to add name'}</span>
                  <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </div>

            {/* Details field */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Details</label>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingDescription(e.target.value)}
                    placeholder="Brief details"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveDescription} className="flex-1">
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelDescription} className="flex-1">
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer max-h-[200px] overflow-y-auto group"
                  onClick={handleEditDescription}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1">
                      {description || 'Click to add details'}
                    </p>
                    <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0" />
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Image Generation Model
                </label>
                <Select
                  value={settings.imageGenerationModel}
                  onValueChange={(value) => handleSettingChange('imageGenerationModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imagen-4-ultra">imagen-4-ultra</SelectItem>
                    <SelectItem value="flux-pro-1-1">flux-pro-1-1</SelectItem>
                    <SelectItem value="flux-schnell">flux-schnell (fast)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Image Editing Model
                </label>
                <Select
                  value={settings.imageEditingModel}
                  onValueChange={(value) => handleSettingChange('imageEditingModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nano-banana">nano-banana</SelectItem>
                    <SelectItem value="flux-kontext">flux-kontext-pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Image Upscaling Model
                </label>
                <Select
                  value={settings.imageUpscalingModel}
                  onValueChange={(value) => handleSettingChange('imageUpscalingModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topaz-image-upscaler">topaz-image-upscaler</SelectItem>
                    <SelectItem value="clarity-upscaler">clarity-upscaler</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Default Aspect Ratio
                </label>
                <Select
                  value={settings.defaultAspectRatio}
                  onValueChange={(value) => handleSettingChange('defaultAspectRatio', value)}
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

            {/* Reactions & Notes */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <details open>
                <summary className="text-sm font-medium text-gray-700 mb-3 cursor-pointer">
                  Reactions & Notes
                </summary>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Stickers</label>
                    <div className="grid grid-cols-5 gap-2">
                      {['❤️', '👍', '👎', '🔥', '✨', '❓', '❌', '🤔', '⭐', '📝'].map((emoji) => (
                        <div
                          key={emoji}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('sticker', emoji);
                          }}
                          className="text-2xl cursor-move hover:scale-110 transition-transform flex items-center justify-center p-2 rounded hover:bg-gray-100"
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
            <div className="border-t border-gray-200 pt-4 mt-4">
              <details open>
                <summary className="text-sm font-medium text-gray-700 mb-3 cursor-pointer">
                  Assets
                </summary>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { url: 'https://placehold.co/150x150/FF6B6B/FFFFFF?text=Logo', label: 'Logo' },
                    { url: 'https://placehold.co/150x150/4ECDC4/FFFFFF?text=Brand', label: 'Brand' },
                    { url: 'https://placehold.co/150x150/45B7D1/FFFFFF?text=Icon', label: 'Icon' },
                    { url: 'https://placehold.co/150x150/96CEB4/FFFFFF?text=Badge', label: 'Badge' },
                  ].map((asset) => (
                    <div
                      key={asset.url}
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData('asset', asset.url);
                      }}
                      className="cursor-move hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={asset.url}
                        alt={asset.label}
                        className="w-full h-20 object-cover rounded border border-gray-200"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">{asset.label}</p>
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
        <div className="bg-white border-r border-gray-200">
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
      <div className="flex-1 min-w-[600px]">
        <Canvas />
      </div>
    </div>
  );
}
