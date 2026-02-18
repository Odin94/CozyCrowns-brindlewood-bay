import { getAdvancementOptions, getCrownOfTheVoid, getEndOfSessionQuestions } from "@/game_data"
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store"
import { useSettingsStore } from "@/lib/settings_store"
import { downloadPdf } from "@/lib/pdf_generator"
import { loadTranslations } from "@/lib/utils"
import { CharacterDataSchema } from "@/types/characterSchema"
import { useLingui } from "@lingui/react/macro"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { useCharacterSave } from "@/hooks/useCharacterSave"
import { ResetConfirmView } from "@/components/MenuDialog/ResetConfirmView"
import { MeView } from "@/components/MenuDialog/MeView"
import { CreditsView } from "@/components/MenuDialog/CreditsView"
import { MainMenuView } from "@/components/MenuDialog/MainMenuView"
import { SaveFailureDialog } from "@/components/MenuDialog/SaveFailureDialog"
import { DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Dialog } from "@/components/ui/dialog"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"

type MenuDialogProps = {
    onOpenChange?: (open: boolean) => void
    open?: boolean
}

// TODOdin: Redesign the whole dialog content
const MenuDialog = ({ onOpenChange, open }: MenuDialogProps) => {
    const characterStore = useCharacterStore()
    const { setLocale } = useSettingsStore()
    const { i18n } = useLingui()
    const { user, updateProfile, isUpdatingProfile, signOut, isAuthenticated } = useAuth()
    const { saveCurrentCharacter } = useCharacterSave()
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showCredits, setShowCredits] = useState(false)
    const [showMe, setShowMe] = useState(false)
    const [saveFailureOpen, setSaveFailureOpen] = useState(false)
    const [pendingLoadAction, setPendingLoadAction] = useState<(() => void) | null>(null)

    // Get the data dynamically so they update when locale changes
    const endOfSessionQuestions = getEndOfSessionQuestions()
    const advancementOptions = getAdvancementOptions()
    const crownOfTheVoid = getCrownOfTheVoid()

    const handleLanguageChange = async (locale: string) => {
        await loadTranslations(locale)
        await i18n.activate(locale)
        setLocale(locale)
    }

    // Reset transient views when dialog is re-opened
    useEffect(() => {
        if (open) {
            setShowResetConfirm(false)
            setShowCredits(false)
            setShowMe(false)
        }
    }, [open])

    const handleUpdateProfile = async (nickname: string | null) => {
        try {
            await updateProfile({ nickname })
            toast.success(i18n._("Profile updated successfully!"))
        } catch (error) {
            console.error("Error updating profile:", error)
            toast.error(i18n._("Failed to update profile. Please try again."))
        }
    }

    const handleLogout = () => {
        signOut()
    }

    const handleDownloadJSON = () => {
        const characterData = characterStore.getCharacterData()

        const jsonString = JSON.stringify(characterData, null, 2)
        const blob = new Blob([jsonString], { type: "application/json" })

        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `CozyCrowns_${characterStore.name || "Character"}.json`

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)
    }

    const handleDownloadPDF = async () => {
        try {
            const characterData = characterStore.getCharacterData()

            await downloadPdf(characterData)
            toast.success(i18n._("PDF downloaded successfully!"))
        } catch (error) {
            console.error("Error downloading PDF:", error)
            toast.error(i18n._("Failed to download PDF. Please try again."))
        }
    }

    const handleLoadFromJSON = async () => {
        const saveSuccess = await saveCurrentCharacter()
        if (!saveSuccess) {
            const loadAction = () => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".json"

                input.onchange = (event) => {
                    const file = (event.target as HTMLInputElement).files?.[0]
                    if (!file) return

                    const reader = new FileReader()
                    reader.onload = (e) => {
                        try {
                            const rawData = JSON.parse(e.target?.result as string)

                            const validationResult = CharacterDataSchema.safeParse(rawData)

                            if (!validationResult.success) {
                                const errorMessages = validationResult.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
                                console.error(errorMessages)
                                toast.error(i18n._(`Invalid character data format: ${errorMessages}`))
                                return
                            }

                            const characterData = validationResult.data

                            characterStore.setName(characterData.name || "")
                            characterStore.setStyle(characterData.style || "")
                            characterStore.setActivity(characterData.activity || "")
                            characterStore.setAbilities(characterData.abilities || getDefaultAbilities())
                            characterStore.setXp(characterData.xp || 0)
                            characterStore.setConditions(characterData.conditions || "")
                            characterStore.setEndOfSessionChecks(
                                characterData.endOfSessionChecks && characterData.endOfSessionChecks.length > 0
                                    ? characterData.endOfSessionChecks
                                    : endOfSessionQuestions.map(() => false)
                            )
                            characterStore.setAdvancementChecks(
                                characterData.advancementChecks && characterData.advancementChecks.length > 0
                                    ? characterData.advancementChecks
                                    : advancementOptions.map(() => false)
                            )
                            characterStore.setMavenMoves(characterData.mavenMoves || "")
                            characterStore.setCrownChecks(
                                characterData.crownChecks && characterData.crownChecks.length > 0
                                    ? characterData.crownChecks
                                    : crownOfTheVoid.map(() => false)
                            )
                            characterStore.setVoidChecks(
                                characterData.voidChecks && characterData.voidChecks.length > 0
                                    ? characterData.voidChecks
                                    : crownOfTheVoid.map(() => false)
                            )
                            characterStore.setCozyItems(
                                characterData.cozyItems && characterData.cozyItems.length > 0
                                    ? characterData.cozyItems
                                    : Array(12)
                                        .fill(null)
                                        .map(() => ({ checked: false, text: "" }))
                            )

                            characterStore.clearCurrentCharacterIdAndVersion()

                            onOpenChange?.(false)
                            toast.success(i18n._("Character data loaded successfully!"))
                        } catch (error) {
                            if (error instanceof SyntaxError) {
                                toast.error(i18n._("Invalid JSON file format."))
                            } else {
                                toast.error(i18n._("Error loading character data. Please check the file format."))
                            }
                        }
                    }
                    reader.readAsText(file)
                }

                input.click()
            }
            setPendingLoadAction(() => loadAction)
            setSaveFailureOpen(true)
            return
        }

        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".json"

        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0]
            if (!file) return

            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const rawData = JSON.parse(e.target?.result as string)

                    const validationResult = CharacterDataSchema.safeParse(rawData)

                    if (!validationResult.success) {
                        const errorMessages = validationResult.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
                        console.error(errorMessages)
                        toast.error(i18n._(`Invalid character data format: ${errorMessages}`))
                        return
                    }

                    const characterData = validationResult.data

                    characterStore.setName(characterData.name || "")
                    characterStore.setStyle(characterData.style || "")
                    characterStore.setActivity(characterData.activity || "")
                    characterStore.setAbilities(characterData.abilities || getDefaultAbilities())
                    characterStore.setXp(characterData.xp || 0)
                    characterStore.setConditions(characterData.conditions || "")
                    characterStore.setEndOfSessionChecks(
                        characterData.endOfSessionChecks && characterData.endOfSessionChecks.length > 0
                            ? characterData.endOfSessionChecks
                            : endOfSessionQuestions.map(() => false)
                    )
                    characterStore.setAdvancementChecks(
                        characterData.advancementChecks && characterData.advancementChecks.length > 0
                            ? characterData.advancementChecks
                            : advancementOptions.map(() => false)
                    )
                    characterStore.setMavenMoves(characterData.mavenMoves || "")
                    characterStore.setCrownChecks(
                        characterData.crownChecks && characterData.crownChecks.length > 0
                            ? characterData.crownChecks
                            : crownOfTheVoid.map(() => false)
                    )
                    characterStore.setVoidChecks(
                        characterData.voidChecks && characterData.voidChecks.length > 0
                            ? characterData.voidChecks
                            : crownOfTheVoid.map(() => false)
                    )
                    characterStore.setCozyItems(
                        characterData.cozyItems && characterData.cozyItems.length > 0
                            ? characterData.cozyItems
                            : Array(12)
                                .fill(null)
                                .map(() => ({ checked: false, text: "" }))
                    )

                    characterStore.clearCurrentCharacterIdAndVersion()

                    onOpenChange?.(false)
                    toast.success(i18n._("Character data loaded successfully!"))
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        toast.error(i18n._("Invalid JSON file format."))
                    } else {
                        toast.error(i18n._("Error loading character data. Please check the file format."))
                    }
                }
            }
            reader.readAsText(file)
        }

        input.click()
    }

    const handleSaveToBackend = async () => {
        const success = await saveCurrentCharacter()
        if (success) {
            toast.success(i18n._("Character saved successfully!"))
        } else {
            toast.error(i18n._("Failed to save character. Please try again."))
        }
    }

    const handleSaveFailureContinue = () => {
        if (pendingLoadAction) {
            pendingLoadAction()
            setPendingLoadAction(null)
        }
        setSaveFailureOpen(false)
    }

    const handleSaveFailureCancel = () => {
        setPendingLoadAction(null)
        setSaveFailureOpen(false)
    }

    const confirmReset = () => {
        characterStore.setName("")
        characterStore.setStyle("")
        characterStore.setActivity("")
        characterStore.setAbilities(getDefaultAbilities())
        characterStore.setXp(0)
        characterStore.setConditions("")
        characterStore.setEndOfSessionChecks(endOfSessionQuestions.map(() => false))
        characterStore.setAdvancementChecks(advancementOptions.map(() => false))
        characterStore.setMavenMoves("")
        characterStore.setCrownChecks(crownOfTheVoid.map(() => false))
        characterStore.setVoidChecks(crownOfTheVoid.map(() => false))
        characterStore.setCozyItems(
            Array(12)
                .fill(null)
                .map(() => ({ checked: false, text: "" }))
        )

        setShowResetConfirm(false)
        onOpenChange?.(false)
        toast.success(i18n._("Character reset successfully!"))
    }

    const cancelReset = () => {
        setShowResetConfirm(false)
    }

    const getMaxWidth = () => {
        if (showResetConfirm) return "sm:max-w-[525px]"
        if (showMe || showCredits) return "sm:max-w-[500px]"
        return "sm:max-w-[425px]"
    }

    return (
        <DialogContent className={`${getMaxWidth()} bg-secondary/90 border-0 shadow-none`} style={{ boxShadow: "none" }}>
            <VisuallyHidden.Root asChild>
                <DialogTitle>Menu</DialogTitle>
            </VisuallyHidden.Root>
            {showResetConfirm ? (
                <ResetConfirmView onConfirm={confirmReset} onCancel={cancelReset} />
            ) : showMe ? (
                <MeView
                    user={user}
                    onUpdateProfile={handleUpdateProfile}
                    onLogout={handleLogout}
                    onBack={() => setShowMe(false)}
                    isUpdatingProfile={isUpdatingProfile}
                />
            ) : showCredits ? (
                <CreditsView onBack={() => setShowCredits(false)} />
            ) : (
                <MainMenuView
                    onDownloadPDF={handleDownloadPDF}
                    onDownloadJSON={handleDownloadJSON}
                    onLoadFromJSON={handleLoadFromJSON}
                    onResetClick={() => setShowResetConfirm(true)}
                    onCreditsClick={() => setShowCredits(true)}
                    onMeClick={() => setShowMe(true)}
                    onLanguageChange={handleLanguageChange}
                    onSaveToBackend={handleSaveToBackend}
                    isAuthenticated={isAuthenticated}
                />
            )}
            <Dialog open={saveFailureOpen} onOpenChange={setSaveFailureOpen}>
                <SaveFailureDialog onContinue={handleSaveFailureContinue} onCancel={handleSaveFailureCancel} />
            </Dialog>
        </DialogContent>
    )
}

export default MenuDialog
