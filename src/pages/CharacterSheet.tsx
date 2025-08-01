import Abilities from "@/components/character/Abilities"
import Advancements from "@/components/character/Advancements"
import Conditions from "@/components/character/Conditions"
import CozyActivity from "@/components/character/CozyActivity"
import CrownOfTheQueen from "@/components/character/CrownOfTheQueen"
import CrownOfTheVoid from "@/components/character/CrownOfTheVoid"
import EndOfSession from "@/components/character/EndOfSession"
import MavenMoves from "@/components/character/MavenMoves"
import Name from "@/components/character/Name"
import Style from "@/components/character/Style"
import XpTrack from "@/components/character/XpTrack"
import { advancementOptions, crownsOfTheQueen, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"
import type { Ability } from "@/types/character"
import { useState } from "react"

const CharacterSheet = () => {
    const [name, setName] = useState("")
    const [style, setStyle] = useState("")
    const [activity, setActivity] = useState("")
    const [abilities, setAbilities] = useState<Ability[]>([
        { name: "Vitality", value: 0 },
        { name: "Composure", value: 0 },
        { name: "Reason", value: 0 },
        { name: "Presence", value: 0 },
        { name: "Sensitivity", value: 0 },
    ])
    const [xp, setXp] = useState(0)
    const [conditions, setConditions] = useState("")
    const [endOfSessionChecks, setEndOfSessionChecks] = useState(endOfSessionQuestions.map(() => false))
    const [advancementChecks, setAdvancementChecks] = useState(advancementOptions.map(() => false))
    const [mavenMoves, setMavenMoves] = useState("")
    const [crownChecks, setCrownChecks] = useState(crownsOfTheQueen.map(() => false))
    const [voidChecks, setVoidChecks] = useState(crownOfTheVoid.map(() => false))
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
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col">
                        <Name name={name} setName={setName} />
                        <Style style={style} setStyle={setStyle} />
                        <CozyActivity activity={activity} setActivity={setActivity} />
                        <Abilities abilities={abilities} setAbilities={setAbilities} />
                        <XpTrack xp={xp} setXp={setXp} />
                        <Conditions conditions={conditions} setConditions={setConditions} />
                    </div>

                    {/* Column 2 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0 flex flex-col">
                        <EndOfSession endOfSessionChecks={endOfSessionChecks} setEndOfSessionChecks={setEndOfSessionChecks} />
                        <Advancements advancementChecks={advancementChecks} setAdvancementChecks={setAdvancementChecks} />
                        <MavenMoves mavenMoves={mavenMoves} setMavenMoves={setMavenMoves} />
                    </div>

                    {/* Column 3 */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-5 min-h-0">
                        <CrownOfTheQueen crownChecks={crownChecks} setCrownChecks={setCrownChecks} />
                        <CrownOfTheVoid voidChecks={voidChecks} setVoidChecks={setVoidChecks} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterSheet
