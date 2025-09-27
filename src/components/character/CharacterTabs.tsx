import { useCharacterStore } from "@/lib/character_store"
import { Plus, X } from "lucide-react"

const CharacterTabs = () => {
    const { characters, currentCharacterIndex, setCurrentCharacter, addCharacter, removeCharacter } = useCharacterStore()

    const handleRemoveCharacter = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        if (characters.length > 1) {
            removeCharacter(index)
        }
    }

    return (
        <div className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-1 transition-all duration-500">
            {characters.map((character, index) => (
                <div
                    key={index}
                    className={`relative group flex items-center gap-2 pl-6 py-3 w-40 ml-[-10px] hover:ml-0 rounded-r-lg cursor-pointer transition-all duration-500 hover:duration-200 animate-in slide-in-from-left-4 fade-in ${
                        // TODOdin: Add theme-appropriate colors
                        // TODOdin: Hide these tabs and put them above or below on small screens
                        currentCharacterIndex === index
                            ? "bg-blue-600 text-white shadow-lg"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:shadow-md"
                    }`}
                    onClick={() => setCurrentCharacter(index)}
                    style={{
                        clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)",
                        transition: "all 0.5s ease-in-out",
                    }}
                >
                    <span className="text-sm font-medium whitespace-nowrap">{character.name || `Character ${index + 1}`}</span>
                    {characters.length > 1 && (
                        <button
                            onClick={(e) => handleRemoveCharacter(index, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500 hover:text-white rounded p-1 ml-2"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            ))}

            <div className="flex justify-center mt-3 transition-all duration-500 w-40">
                <div
                    className="relative group flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all duration-500 bg-gray-700/20 text-gray-300 hover:bg-gray-600/50 hover:scale-110"
                    onClick={addCharacter}
                >
                    <Plus size={16} />
                </div>
            </div>
        </div>
    )
}

export default CharacterTabs
