import { Button } from "@/components/ui/button"
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCharacterStore } from "@/store/characterStore"
import { advancementOptions, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"

interface MenuDialogProps {
    onOpenChange?: (open: boolean) => void
}

const MenuDialog = ({ onOpenChange }: MenuDialogProps) => {
    const characterStore = useCharacterStore()

    const handleDownloadJSON = () => {
        const characterData = {
            name: characterStore.name,
            style: characterStore.style,
            activity: characterStore.activity,
            abilities: characterStore.abilities,
            xp: characterStore.xp,
            conditions: characterStore.conditions,
            endOfSessionChecks: characterStore.endOfSessionChecks,
            advancementChecks: characterStore.advancementChecks,
            mavenMoves: characterStore.mavenMoves,
            crownChecks: characterStore.crownChecks,
            voidChecks: characterStore.voidChecks,
            cozyItems: characterStore.cozyItems,
        }

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
                    const characterData = JSON.parse(e.target?.result as string)

                    characterStore.setName(characterData.name || "")
                    characterStore.setStyle(characterData.style || "")
                    characterStore.setActivity(characterData.activity || "")
                    characterStore.setAbilities(characterData.abilities || [])
                    characterStore.setXp(characterData.xp || 0)
                    characterStore.setConditions(characterData.conditions || "")
                    characterStore.setEndOfSessionChecks(characterData.endOfSessionChecks || [])
                    characterStore.setAdvancementChecks(characterData.advancementChecks || [])
                    characterStore.setMavenMoves(characterData.mavenMoves || "")
                    characterStore.setCrownChecks(characterData.crownChecks || [])
                    characterStore.setVoidChecks(characterData.voidChecks || [])
                    characterStore.setCozyItems(characterData.cozyItems || [])

                    onOpenChange?.(false)
                } catch {
                    // TODOdin: Replace with toast and toast on successes as well
                    alert("Error loading character data. Please check the file format.")
                }
            }
            reader.readAsText(file)
        }

        input.click()
    }

    const handleResetCharacter = () => {
        // TODOdin: Replace this confirm with a popover or something
        const confirmed = confirm("Are you sure you want to reset your character? This will clear all data and cannot be undone.")

        if (confirmed) {
            // TODOdin: Extract this to a function
            characterStore.setName("")
            characterStore.setStyle("")
            characterStore.setActivity("")
            characterStore.setAbilities([
                { name: "Vitality", value: 0 },
                { name: "Composure", value: 0 },
                { name: "Reason", value: 0 },
                { name: "Presence", value: 0 },
                { name: "Sensitivity", value: 0 },
            ])
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

            onOpenChange?.(false)
        }
    }

    return (
        <DialogContent className="sm:max-w-[425px] bg-secondary/80 border-0 shadow-none" style={{ boxShadow: "none" }}>
            <DialogHeader>
                <DialogTitle className="text-gray-800">Character Menu</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Button onClick={handleDownloadJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90">
                    Download JSON
                </Button>
                <Button onClick={handleLoadFromJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90">
                    Load from JSON
                </Button>
                <Button onClick={handleResetCharacter} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90">
                    Reset Character
                </Button>
                <a
                    href="https://odin-matthias.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2"
                >
                    Odin's Blog
                </a>
            </div>
        </DialogContent>
    )
}

export default MenuDialog
