import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trans, useLingui } from "@lingui/react/macro"
import { LogOut, Edit, Check, X } from "lucide-react"
import { useState, useEffect } from "react"

type User = {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    nickname: string | null
}

type MeViewProps = {
    user: User | null
    onUpdateProfile: (nickname: string | null) => void
    onLogout: () => void
    onBack: () => void
    isUpdatingProfile: boolean
}

export const MeView = ({
    user,
    onUpdateProfile,
    onLogout,
    onBack,
    isUpdatingProfile,
}: MeViewProps) => {
    const { i18n } = useLingui()
    const [isEditingNickname, setIsEditingNickname] = useState(false)
    const nickname = user?.nickname || ""
    const [editedNickname, setEditedNickname] = useState(nickname)

    useEffect(() => {
        if (!isEditingNickname) {
            setEditedNickname(nickname)
        }
    }, [nickname, isEditingNickname])

    const handleStartEdit = () => {
        setIsEditingNickname(true)
        setEditedNickname(nickname)
    }

    const handleCancelEdit = () => {
        setIsEditingNickname(false)
        setEditedNickname(nickname)
    }

    const handleConfirmEdit = async () => {
        const newNickname = editedNickname.trim() || null
        if (newNickname !== nickname) {
            await onUpdateProfile(newNickname)
        }
        setIsEditingNickname(false)
    }

    return (
        <>
            <DialogHeader>
                <div className="flex items-center justify-between">
                    <DialogTitle className="text-gray-800">
                        <Trans>Profile</Trans>
                    </DialogTitle>
                    {user ? (
                        <Button onClick={onLogout} variant={"secondary"} size="sm" className="text-foreground dark-ring">
                            <LogOut className="w-4 h-4 mr-1.5" />
                            <Trans>Logout</Trans>
                        </Button>
                    ) : null}
                </div>
                <DialogDescription className="sr-only">
                    <Trans>Manage your profile settings.</Trans>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 text-sm text-gray-800">
                {user ? (
                    <>
                        <div className="grid gap-2">
                            <Label className="text-gray-800">
                                <Trans>Email</Trans>: <span>{user.email}</span>
                            </Label>

                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="nickname" className="text-gray-800">
                                <Trans>Nickname</Trans>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="nickname"
                                    type="text"
                                    value={editedNickname}
                                    onChange={(e) => setEditedNickname(e.target.value)}
                                    placeholder={i18n._("Enter your nickname")}
                                    disabled={!isEditingNickname}
                                    readOnly={!isEditingNickname}
                                    className={`bg-background/50 text-gray-800 pr-20 ${isEditingNickname ? "" : "cursor-default"}`}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                    {isEditingNickname ? (
                                        <>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleConfirmEdit}
                                                disabled={isUpdatingProfile}
                                                className="h-7 w-7 p-0 hover:bg-dark-secondary/20"
                                            >
                                                <Check className="h-4 w-4 text-dark-secondary" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelEdit}
                                                disabled={isUpdatingProfile}
                                                className="h-7 w-7 p-0 hover:bg-red-600/20"
                                            >
                                                <X className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleStartEdit}
                                            className="h-7 w-7 p-0 hover:bg-dark-secondary/50"
                                        >
                                            <Edit className="h-4 w-4 text-dark-secondary" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={onBack} className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                                <Trans>Back</Trans>
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-gray-800">
                            <Trans>Please sign in to view your profile.</Trans>
                        </p>
                        <Button onClick={onBack} className="mt-4 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                            <Trans>Back</Trans>
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}
