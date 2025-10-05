"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface Brief {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [briefToDelete, setBriefToDelete] = useState<Brief | null>(null);

  useEffect(() => {
    fetchBriefs();
  }, []);

  const fetchBriefs = async () => {
    const res = await fetch("/api/briefs");
    const data = await res.json();
    setBriefs(data);
  };

  const createBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const res = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.id) {
      router.push(`/briefs/${data.id}`);
    }
  };

  const handleDeleteClick = (brief: Brief, e: React.MouseEvent) => {
    e.stopPropagation();
    setBriefToDelete(brief);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!briefToDelete) return;

    try {
      const res = await fetch(`/api/briefs/${briefToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBriefs(briefs.filter((b) => b.id !== briefToDelete.id));
        setDeleteDialogOpen(false);
        setBriefToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete brief:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">Mood Briefs</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBrief} className="space-y-4">
              <div>
                <Input
                  placeholder="Brief name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Brief"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <h2 className="mb-4 text-2xl font-semibold">Your Briefs</h2>
        <div className="grid gap-4">
          {briefs.map((brief) => (
            <Card
              key={brief.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => router.push(`/briefs/${brief.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <CardTitle>{brief.name}</CardTitle>
                  {brief.description && (
                    <CardDescription className="mt-1.5">
                      {brief.description}
                    </CardDescription>
                  )}
                  <CardDescription className="mt-1.5 text-xs">
                    Created {new Date(brief.createdAt).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteClick(brief, e)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brief</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{briefToDelete?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
