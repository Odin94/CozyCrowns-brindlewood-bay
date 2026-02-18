import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trans, useLingui } from "@lingui/react/macro"
import { LogOut } from "lucide-react"

type User = {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    nickname: string | null
}

type MeViewProps = {
    user: User | null
    nickname: string
    onNicknameChange: (nickname: string) => void
    onUpdateProfile: () => void
    onLogout: () => void
    onBack: () => void
    isUpdatingProfile: boolean
}

export const MeView = ({
    user,
    nickname,
    onNicknameChange,
    onUpdateProfile,
    onLogout,
    onBack,
    isUpdatingProfile,
}: MeViewProps) => {
    const { i18n } = useLingui()

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-gray-800">
                    <Trans>Profile</Trans>
                </DialogTitle>
                <DialogDescription className="sr-only">
                    <Trans>Manage your profile settings.</Trans>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 text-sm text-gray-800">
                {user ? (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-gray-800">
                                <Trans>Email</Trans>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={user.email}
                                disabled
                                className="bg-background/50 text-gray-800"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="nickname" className="text-gray-800">
                                <Trans>Nickname</Trans>
                            </Label>
                            <Input
                                id="nickname"
                                type="text"
                                value={nickname}
                                onChange={(e) => onNicknameChange(e.target.value)}
                                placeholder={i18n._("Enter your nickname")}
                                className="bg-background text-gray-800"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={onUpdateProfile}
                                disabled={isUpdatingProfile}
                                className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                            >
                                {isUpdatingProfile ? <Trans>Updating...</Trans> : <Trans>Update Profile</Trans>}
                            </Button>
                            <Button onClick={onLogout} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                                <LogOut className="w-4 h-4 mr-2" />
                                <Trans>Logout</Trans>
                            </Button>
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
