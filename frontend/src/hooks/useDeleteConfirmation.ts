import { useCharacterStore } from "@/lib/character_store"
import { useState } from "react"
import { api } from "@/utils/api"

export const useDeleteConfirmation = () => {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)
    const { removeCharacter, characters } = useCharacterStore()

    const handleDeleteCharacter = (index: number) => {
        setDeleteConfirmIndex(index)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (deleteConfirmIndex !== null) {
            const character = characters[deleteConfirmIndex]
            if (character?.id) {
                try {
                    await api.deleteCharacter(character.id)
                } catch (error) {
                    console.error("Failed to delete character from backend:", error)
                }
            }
            removeCharacter(deleteConfirmIndex)
            setDeleteConfirmIndex(null)
            setDeleteConfirmOpen(false)
        }
    }

    const cancelDelete = () => {
        setDeleteConfirmIndex(null)
        setDeleteConfirmOpen(false)
    }

    return {
        deleteConfirmOpen,
        deleteConfirmIndex,
        handleDeleteCharacter,
        confirmDelete,
        cancelDelete,
        setDeleteConfirmOpen,
    }
}
