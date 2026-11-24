"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlaylistFromLibrary } from "./actions";

type Labels = {
  createPlaylist: string;
  playlistName: string;
  description: string;
  public: string;
  create: string;
  close: string;
  failure: string;
  saving: string;
};
export function CreatePlaylistDialog({
  locale,
  labels,
}: {
  locale: string;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const submitting = useRef(false);
  function submit(form: FormData) {
    if (submitting.current) return;
    submitting.current = true;
    setError(false);
    startTransition(async () => {
      try {
        const result = await createPlaylistFromLibrary(form);
        if (result.id) {
          setName("");
          setDescription("");
          setIsPublic(false);
          setOpen(false);
          router.push(`/${locale}/playlists/${result.id}`);
        } else setError(true);
      } catch {
        setError(true);
      } finally {
        submitting.current = false;
      }
    });
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button">
          <Plus size={18} />
          {labels.createPlaylist}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(92vw,480px)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none">
          <div className="mb-5 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-2xl font-semibold">
              {labels.createPlaylist}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={labels.close}
              >
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {labels.createPlaylist}
          </Dialog.Description>
          <form action={submit} className="flex flex-col gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              {labels.playlistName}
              <Input
                name="name"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              {labels.description}
              <Input
                name="description"
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="accent-primary"
                type="checkbox"
                name="is_public"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              {labels.public}
            </label>
            {error && (
              <p role="alert" className="text-sm text-primary">
                {labels.failure}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? labels.saving : labels.create}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
