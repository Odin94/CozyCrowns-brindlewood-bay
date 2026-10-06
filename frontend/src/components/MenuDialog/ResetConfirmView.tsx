import { ConfirmationDialogPanel } from "@/components/ui/confirmation-dialog";
import { Trans } from "@lingui/react/macro";

type ResetConfirmViewProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export const ResetConfirmView = ({ onConfirm, onCancel }: ResetConfirmViewProps) => {
  return (
    <ConfirmationDialogPanel
      title={<Trans>Confirm Reset</Trans>}
      description={
        <Trans>
          Are you sure you want to reset your character? This will clear all data and cannot be
          undone.
        </Trans>
      }
      notice={<Trans>This action will permanently delete all your character data.</Trans>}
      confirmLabel={<Trans>Reset Character</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
