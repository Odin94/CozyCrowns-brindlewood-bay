import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trans } from "@lingui/react/macro"
import { Trash2 } from "lucide-react"

type ResetConfirmViewProps = {
    onConfirm: () => void
    onCancel: () => void
}

export const ResetConfirmView = ({ onConfirm, onCancel }: ResetConfirmViewProps) => {
    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-gray-800">
                    <Trans>Confirm Reset</Trans>
                </DialogTitle>
                <DialogDescription className="text-gray-800">
                    <Trans>This action will permanently delete all your character data.</Trans>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                <p className="text-sm text-gray-800">
                    <Trans>Are you sure you want to reset your character? This will clear all data and cannot be undone.</Trans>
                </p>
                <div className="flex gap-2">
                    <Button onClick={onConfirm} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                        <Trash2 className="w-4 h-4 mr-2" />
                        <Trans>Reset Character</Trans>
                    </Button>
                    <Button onClick={onCancel} className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                        <Trans>Cancel</Trans>
                    </Button>
                </div>
            </div>
        </>
    )
}
