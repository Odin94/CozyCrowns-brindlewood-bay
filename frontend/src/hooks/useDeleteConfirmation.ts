import { useCharacterStore } from "@/lib/character_store";
import { useRef, useState } from "react";
import { api } from "@/utils/api";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";

export const useDeleteConfirmation = () => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [target, setTarget] = useState<{ localId: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pending = useRef(false);
  const handleDeleteCharacter = (index: number) => {
    if (pending.current) return;
    const character = useCharacterStore.getState().characters[index];
    if (!character) return;
    setTarget({ localId: character.localId, name: character.name });
    setDeleteConfirmOpen(true);
  };
  const cancelDelete = () => {
    if (pending.current) return;
    setTarget(null);
    setDeleteConfirmOpen(false);
  };
  const confirmDelete = async () => {
    if (!target || pending.current) return;
    const character = useCharacterStore.getState().record(target.localId);
    if (!character) {
      cancelDelete();
      return;
    }
    pending.current = true;
    setIsDeleting(true);
    try {
      if (character.id) await api.deleteCharacter(character.id);
      useCharacterStore.getState().remove(target.localId);
      setTarget(null);
      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Failed to delete character:", error);
      toast.error(t`Could not delete this Maven. It is still here. Please retry.`);
    } finally {
      pending.current = false;
      setIsDeleting(false);
    }
  };
  return {
    deleteConfirmOpen,
    deleteConfirmName: target?.name ?? "",
    isDeleting,
    handleDeleteCharacter,
    confirmDelete,
    cancelDelete,
    setDeleteConfirmOpen: (open: boolean) => {
      if (!pending.current) {
        setDeleteConfirmOpen(open);
        if (!open) setTarget(null);
      }
    },
  };
};
