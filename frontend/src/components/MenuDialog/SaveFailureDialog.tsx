import { Button } from "@/components/ui/button"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trans } from "@lingui/react/macro"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { AlertTriangle } from "lucide-react"

type SaveFailureDialogProps = {
    onContinue: () => void
    onCancel: () => void
}

export const SaveFailureDialog = ({ onContinue, onCancel }: SaveFailureDialogProps) => {
    return (
        <DialogContent className="sm:max-w-[425px] bg-secondary/90 border-0 shadow-none" style={{ boxShadow: "none" }}>
            <VisuallyHidden.Root asChild>
                <DialogTitle>
                    <Trans>Saving Failed</Trans>
                </DialogTitle>
            </VisuallyHidden.Root>
            <DialogHeader>
                <DialogTitle className="text-gray-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <Trans>Saving Failed</Trans>
                </DialogTitle>
                <DialogDescription></DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                <p className="text-sm text-gray-800">
                    <Trans>
                        Saving current character failed. If you continue loading/switching, you will lose changes to your current character.
                    </Trans>
                </p>
                <div className="flex gap-2">
                    <Button onClick={onContinue} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                        <Trans>Continue</Trans>
                    </Button>
                    <Button
                        onClick={onCancel}
                        className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                        autoFocus
                    >
                        <Trans>Cancel</Trans>
                    </Button>
                </div>
            </div>
        </DialogContent>
    )
}
