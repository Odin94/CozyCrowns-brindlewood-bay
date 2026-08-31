import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmationTone = "danger" | "warning";

type ConfirmationDialogPanelProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: ConfirmationTone;
  notice?: React.ReactNode;
};

export const ConfirmationDialogPanel = ({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
  notice,
}: ConfirmationDialogPanelProps) => {
  const Icon = tone === "danger" ? Trash2 : AlertTriangle;

  return (
    <div className="confirmation-dialog__body">
      <DialogHeader className="confirmation-dialog__header">
        <span className={`confirmation-dialog__icon confirmation-dialog__icon--${tone}`}>
          <Icon aria-hidden="true" />
        </span>
        <div>
          <DialogTitle className="confirmation-dialog__title">{title}</DialogTitle>
          <DialogDescription className="confirmation-dialog__description">
            {description}
          </DialogDescription>
          {notice ? <p className="confirmation-dialog__notice">{notice}</p> : null}
        </div>
      </DialogHeader>
      <DialogFooter className="confirmation-dialog__actions">
        <Button onClick={onCancel} variant="outline" autoFocus>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant={tone === "danger" ? "destructive" : "dark"}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  );
};

type ConfirmationDialogProps = ConfirmationDialogPanelProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ConfirmationDialog = ({ open, onOpenChange, ...props }: ConfirmationDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="confirmation-dialog sm:max-w-md">
      <ConfirmationDialogPanel {...props} />
    </DialogContent>
  </Dialog>
);
