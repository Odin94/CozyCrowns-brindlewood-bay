import { ConfirmationDialogPanel } from "@/components/ui/confirmation-dialog";
import { DialogContent } from "@/components/ui/dialog";
import { Trans } from "@lingui/react/macro";

type DeleteConfirmDialogProps = {
  characterName: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isAuthenticated?: boolean;
};

const DeleteConfirmDialog = ({
  characterName,
  isDeleting,
  onConfirm,
  onCancel,
  isAuthenticated,
}: DeleteConfirmDialogProps) => {
  return (
    <DialogContent className="confirmation-dialog sm:max-w-md">
      <ConfirmationDialogPanel
        title={<Trans>Delete "{characterName}"</Trans>}
        description={
          <Trans>
            Delete "{characterName}"? A local recovery copy will remain available in the menu for 30
            days.
          </Trans>
        }
        notice={
          isAuthenticated ? (
            <Trans>This will also delete the character from the backend.</Trans>
          ) : undefined
        }
        confirmLabel={<Trans>Delete Character</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        disabled={isDeleting}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </DialogContent>
  );
};

export default DeleteConfirmDialog;
