import Abilities from "@/components/character/Abilities"
import Advancements from "@/components/character/Advancements"
import Conditions from "@/components/character/Conditions"
import CozyActivity from "@/components/character/CozyActivity"
import CozyLittlePlace from "@/components/character/CozyLittlePlace"
import CrownOfTheQueen from "@/components/character/CrownOfTheQueen"
import CrownOfTheVoid from "@/components/character/CrownOfTheVoid"
import EndOfSession from "@/components/character/EndOfSession"
import MavenMoves from "@/components/character/MavenMoves"
import Name from "@/components/character/Name"
import Style from "@/components/character/Style"
import Tentacles from "@/components/character/Tentacles"
import XpTrack from "@/components/character/XpTrack"
import { useState } from "react"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import MenuDialog from "@/components/character/MenuDialog"

const CharacterSheet = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // TODOdin: Make the button-menu-thingy a cthulhu tentacle that rises when you hover over it
    return (
        <div className="min-h-screen w-full from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 lg:p-6">
            <div className="w-full max-w-none">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-0">CozyCrowns 👑</h1>
                    <div className="text-xs font-normal text-gray-400 dark:text-gray-300 font-sans -mt-4" style={{ marginLeft: "4.5rem" }}>
                        by Odin
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
                    {/* Column 1 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col relative">
                        <div className="absolute top-0 left-0 w-full -mt-8">
                            <Tentacles />
                        </div>
                        <Name />
                        <Style />
                        <CozyActivity />
                        <Abilities />
                        <XpTrack />
                        <Conditions />
                    </div>

                    {/* Column 2 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col">
                        <EndOfSession />
                        <Advancements />
                        <MavenMoves />
                    </div>

                    {/* Column 3 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0">
                        <CrownOfTheQueen />
                        <CrownOfTheVoid />
                        <CozyLittlePlace />
                    </div>
                </div>
            </div>

            {/* Mobile Menu Button - Only visible on mobile */}
            <div className="md:hidden flex justify-center mt-8">
                <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-dark-secondary hover:bg-dark-foreground/90">Menu</Button>
                    </DialogTrigger>
                    <MenuDialog onOpenChange={setMobileMenuOpen} />
                </Dialog>
            </div>
        </div>
    )
}

export default CharacterSheet
