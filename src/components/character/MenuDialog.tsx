import { Button } from "@/components/ui/button"
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store"
import { advancementOptions, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { CoffeeIcon, Trash2, FileDown } from "lucide-react"
import { CharacterDataSchema } from "@/types/characterSchema"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { downloadPdf } from "@/lib/pdf_generator"

type MenuDialogProps = {
    onOpenChange?: (open: boolean) => void
    open?: boolean
}

const MenuDialog = ({ onOpenChange, open }: MenuDialogProps) => {
    const characterStore = useCharacterStore()
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showCredits, setShowCredits] = useState(false)

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
            toast.success("PDF downloaded successfully!")
        } catch (error) {
            console.error("Error downloading PDF:", error)
            toast.error("Failed to download PDF. Please try again.")
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
                        toast.error(`Invalid character data format: ${errorMessages}`)
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
                    toast.success("Character data loaded successfully!")
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        toast.error("Invalid JSON file format.")
                    } else {
                        toast.error("Error loading character data. Please check the file format.")
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
        toast.success("Character reset successfully!")
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
                    <DialogTitle className="text-gray-800">Confirm Reset</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                    <p className="text-sm text-gray-800">
                        Are you sure you want to reset your character? This will clear all data and cannot be undone.
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={confirmReset} className="flex-1 text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Reset Character
                        </Button>
                        <Button
                            onClick={cancelReset}
                            className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                        >
                            Cancel
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
                    <DialogTitle className="text-gray-800">Credits</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2 text-sm text-gray-800">
                    <p>
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
                    </p>
                    <p className="text-xs italic">
                        CozyCrowns is an independent production by Odin and is not affiliated with The Gauntlet.
                    </p>
                    <div className="pt-1">
                        <p className="font-semibold">Assets</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
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
                            </li>
                            <li>
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
                            </li>
                        </ul>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={() => setShowCredits(false)}
                            className="flex-1 text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                        >
                            Back
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
            <div className="grid gap-4">
                <Button onClick={handleDownloadJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    Download save file
                </Button>
                <Button onClick={handleDownloadPDF} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                </Button>
                <Button onClick={handleLoadFromJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    Load from save file
                </Button>
                <Button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring"
                >
                    Reset Character
                </Button>
                <div className="grid grid-cols-3 gap-2">
                    <Button variant="link" asChild>
                        <a href="https://odin-matthias.de" target="_blank" rel="noopener noreferrer">
                            Odin's Blog
                        </a>
                    </Button>
                    <Button variant="link" asChild>
                        <a href="https://github.com/Odin94/CozyCrowns-brindlewood-bay" target="_blank" rel="noopener noreferrer">
                            Source Code
                        </a>
                    </Button>
                    <Button variant="link" onClick={() => setShowCredits(true)}>
                        Credits
                    </Button>
                </div>
                <Button variant="secondary" asChild className="w-full justify-center">
                    <a href="https://ko-fi.com/odin_dev" target="_blank" rel="noopener noreferrer">
                        Support Me <CoffeeIcon className="ml-2" />
                    </a>
                </Button>
            </div>
        </DialogContent>
    )
}

export default MenuDialog
