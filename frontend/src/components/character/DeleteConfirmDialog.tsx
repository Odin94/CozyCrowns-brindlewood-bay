import { ConfirmationDialogPanel } from "@/components/ui/confirmation-dialog";
import { DialogContent } from "@/components/ui/dialog";
import { useCharacterStore } from "@/lib/character_store";
import { Trans } from "@lingui/react/macro";

type DeleteConfirmDialogProps = {
  characterIndex: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  isAuthenticated?: boolean;
};

const DeleteConfirmDialog = ({
  characterIndex,
  onConfirm,
  onCancel,
  isAuthenticated,
}: DeleteConfirmDialogProps) => {
  const { characters } = useCharacterStore();

  if (characterIndex === null) return null;

  const characterName = characters[characterIndex]?.name || `Character ${characterIndex + 1}`;

  return (
    <DialogContent className="confirmation-dialog sm:max-w-md">
      <ConfirmationDialogPanel
        title={<Trans>Delete "{characterName}"</Trans>}
        description={
          <Trans>
            Are you sure you want to delete "{characterName}"? This will clear all data and cannot
            be undone.
          </Trans>
        }
        notice={
          isAuthenticated ? <Trans>This will also delete the character from the backend.</Trans> : undefined
        }
        confirmLabel={<Trans>Delete Character</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </DialogContent>
  );
};

export default DeleteConfirmDialog;
