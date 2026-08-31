import { ConfirmationDialogPanel } from "@/components/ui/confirmation-dialog";
import { DialogContent } from "@/components/ui/dialog";
import { Trans } from "@lingui/react/macro";

type SaveFailureDialogProps = {
  onContinue: () => void;
  onCancel: () => void;
};

export const SaveFailureDialog = ({ onContinue, onCancel }: SaveFailureDialogProps) => {
  return (
    <DialogContent className="confirmation-dialog sm:max-w-md">
      <ConfirmationDialogPanel
        title={<Trans>Saving Failed</Trans>}
        description={
          <Trans>
            Saving current character failed. If you continue loading/switching, you will lose
            changes to your current character.
          </Trans>
        }
        confirmLabel={<Trans>Continue</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        onConfirm={onContinue}
        onCancel={onCancel}
        tone="warning"
      />
    </DialogContent>
  );
};
