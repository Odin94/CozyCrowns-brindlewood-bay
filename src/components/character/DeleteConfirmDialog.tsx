import { Button } from "@/components/ui/button"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCharacterStore } from "@/lib/character_store"
import { Trans } from "@lingui/react/macro"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { Trash2 } from "lucide-react"

type DeleteConfirmDialogProps = {
    characterIndex: number | null
    onConfirm: () => void
    onCancel: () => void
}

const DeleteConfirmDialog = ({ characterIndex, onConfirm, onCancel }: DeleteConfirmDialogProps) => {
    const { characters } = useCharacterStore()

    if (characterIndex === null) return null

    const characterName = characters[characterIndex]?.name || `Character ${characterIndex + 1}`

    return (
        <DialogContent className="sm:max-w-[425px] bg-secondary/90 border-0 shadow-none" style={{ boxShadow: "none" }}>
            <VisuallyHidden.Root asChild>
                <DialogTitle>Delete "{characterName}"</DialogTitle>
            </VisuallyHidden.Root>
            <DialogHeader>
                <DialogTitle className="text-gray-800">
                    <Trans>Delete "{characterName}"</Trans>
                </DialogTitle>
                <DialogDescription className="text-gray-800">
                    <Trans>This action will permanently delete the character.</Trans>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                <p className="text-sm text-gray-800">
                    <Trans>Are you sure you want to delete "{characterName}"? This will clear all data and cannot be undone.</Trans>
                </p>
                <div className="flex gap-2">
                    <Button onClick={onConfirm} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                        <Trash2 className="w-4 h-4 mr-2" />
                        <Trans>Delete Character</Trans>
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

export default DeleteConfirmDialog
