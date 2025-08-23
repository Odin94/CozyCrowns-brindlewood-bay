import { Button } from "@/components/ui/button"
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { advancementOptions, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store"
import { downloadPdf } from "@/lib/pdf_generator"
import { CharacterDataSchema } from "@/types/characterSchema"
import { Trans, useLingui } from "@lingui/react/macro"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { CoffeeIcon, Download, FileDown, Globe, Trash2, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type MenuDialogProps = {
    onOpenChange?: (open: boolean) => void
    open?: boolean
}

// TODOdin: Redesign the whole dialog content
const MenuDialog = ({ onOpenChange, open }: MenuDialogProps) => {
    const characterStore = useCharacterStore()
    const { i18n } = useLingui()
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showCredits, setShowCredits] = useState(false)

    const handleLanguageChange = async (locale: string) => {
        if (locale === "en") {
            const { messages } = await import("@/locales/en/messages.ts")
            i18n.load(locale, messages)
        } else if (locale === "de") {
            const { messages } = await import("@/locales/de/messages.ts")
            i18n.load(locale, messages)
        }
        await i18n.activate(locale)
    }

    // Reset transient views when dialog is re-opened
    useEffect(() => {
        if (open) {
            setShowResetConfirm(false)
            setShowCredits(false)
        }
    }, [open])

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

    const handleLoadFromJSON = () => {
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

                    characterStore.setName(characterData.name)
                    characterStore.setStyle(characterData.style)
                    characterStore.setActivity(characterData.activity)
                    characterStore.setAbilities(characterData.abilities)
                    characterStore.setXp(characterData.xp)
                    characterStore.setConditions(characterData.conditions)
                    characterStore.setEndOfSessionChecks(
                        characterData.endOfSessionChecks.length > 0
                            ? characterData.endOfSessionChecks
                            : endOfSessionQuestions.map(() => false)
                    )
                    characterStore.setAdvancementChecks(
                        characterData.advancementChecks.length > 0 ? characterData.advancementChecks : advancementOptions.map(() => false)
                    )
                    characterStore.setMavenMoves(characterData.mavenMoves)
                    characterStore.setCrownChecks(
                        characterData.crownChecks.length > 0 ? characterData.crownChecks : crownOfTheVoid.map(() => false)
                    )
                    characterStore.setVoidChecks(
                        characterData.voidChecks.length > 0 ? characterData.voidChecks : crownOfTheVoid.map(() => false)
                    )
                    characterStore.setCozyItems(
                        characterData.cozyItems.length > 0
                            ? characterData.cozyItems
                            : Array(12)
                                  .fill(null)
                                  .map(() => ({ checked: false, text: "" }))
                    )

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

    if (showResetConfirm) {
        return (
            <DialogContent className="sm:max-w-[425px] bg-secondary/90  border-0 shadow-none" style={{ boxShadow: "none" }}>
                <VisuallyHidden.Root asChild>
                    <DialogTitle>Menu</DialogTitle>
                </VisuallyHidden.Root>
                <DialogHeader>
                    <DialogTitle className="text-gray-800">
                        <Trans>Confirm Reset</Trans>
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                    <p className="text-sm text-gray-800">
                        <Trans>Are you sure you want to reset your character? This will clear all data and cannot be undone.</Trans>
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={confirmReset} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                            <Trash2 className="w-4 h-4 mr-2" />
                            <Trans>Reset Character</Trans>
                        </Button>
                        <Button
                            onClick={cancelReset}
                            className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                        >
                            <Trans>Cancel</Trans>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        )
    }

    if (showCredits) {
        return (
            <DialogContent className="sm:max-w-[500px] bg-secondary/90 border-0 shadow-none" style={{ boxShadow: "none" }}>
                <VisuallyHidden.Root asChild>
                    <DialogTitle>Menu</DialogTitle>
                </VisuallyHidden.Root>
                <DialogHeader>
                    <DialogTitle className="text-gray-800">
                        <Trans>Credits</Trans>
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2 text-sm text-gray-800">
                    <p>
                        <Trans>
                            Brindlewood Bay is published by{" "}
                            <a
                                href="https://www.gauntlet-rpg.com/brindlewood-bay.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                The Gauntlet
                            </a>
                            .
                        </Trans>
                    </p>
                    <p className="text-xs italic">
                        <Trans>CozyCrowns is an independent production by Odin and is not affiliated with The Gauntlet.</Trans>
                    </p>
                    <div className="pt-1">
                        <p className="font-semibold">
                            <Trans>Assets</Trans>
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
                                <Trans>
                                    Queen SVG by{" "}
                                    <a
                                        href="https://www.svgrepo.com/svg/317455/queen"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        Darius Dan on svgrepo
                                    </a>
                                    .
                                </Trans>
                            </li>
                            <li>
                                <Trans>
                                    Tentacles icon by{" "}
                                    <a
                                        href="https://thenounproject.com/icon/tentacles-4112037/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        Teewara soontorn on Noun Project
                                    </a>
                                    .
                                </Trans>
                            </li>
                        </ul>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={() => setShowCredits(false)}
                            className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                        >
                            <Trans>Back</Trans>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        )
    }

    return (
        <DialogContent className="sm:max-w-[425px] bg-secondary/90 border-0 shadow-none" style={{ boxShadow: "none" }}>
            <VisuallyHidden.Root asChild>
                <DialogTitle>Menu</DialogTitle>
            </VisuallyHidden.Root>
            <div className="flex justify-between items-center mb-4">
                <div></div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Globe className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleLanguageChange("en")}>
                            <Trans>English</Trans>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLanguageChange("de")}>
                            <Trans>Deutsch</Trans>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="grid gap-4">
                <Button onClick={handleDownloadPDF} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <FileDown className="w-4 h-4 mr-2" />
                    <Trans>Download PDF</Trans>
                </Button>
                <Button onClick={handleDownloadJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <Download className="w-4 h-4 mr-2" />
                    <Trans>Download save file</Trans>
                </Button>
                <Button onClick={handleLoadFromJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <Upload className="w-4 h-4 mr-2" />
                    <Trans>Load from save file</Trans>
                </Button>
                <Button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <Trans>Reset Character</Trans>
                </Button>
                <div className="grid grid-cols-3 gap-2">
                    <Button variant="link" asChild>
                        <a href="https://odin-matthias.de" target="_blank" rel="noopener noreferrer">
                            <Trans>Odin's Blog</Trans>
                        </a>
                    </Button>
                    <Button variant="link" asChild>
                        <a href="https://github.com/Odin94/CozyCrowns-brindlewood-bay" target="_blank" rel="noopener noreferrer">
                            <Trans>Source Code</Trans>
                        </a>
                    </Button>
                    <Button variant="link" onClick={() => setShowCredits(true)}>
                        <Trans>Credits</Trans>
                    </Button>
                </div>
                <Button variant="secondary" asChild className="w-full justify-center">
                    <a href="https://ko-fi.com/odin_dev" target="_blank" rel="noopener noreferrer">
                        <Trans>Support Me</Trans> <CoffeeIcon className="ml-2" />
                    </a>
                </Button>
            </div>
        </DialogContent>
    )
}

export default MenuDialog
