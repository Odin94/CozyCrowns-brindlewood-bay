import { useCharacterStore } from "@/lib/character_store"
import { useState } from "react"

export const useDeleteConfirmation = () => {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)
    const { removeCharacter } = useCharacterStore()

    const handleDeleteCharacter = (index: number) => {
        setDeleteConfirmIndex(index)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = () => {
        if (deleteConfirmIndex !== null) {
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
