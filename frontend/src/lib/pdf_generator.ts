import type { CharacterData } from "@/types/characterSchema"
import { PDFDocument, PDFTextField, PDFCheckBox } from "pdf-lib"

import base64PdfData from "../resources/brindlewoodbay-charactersheet_fillable.base64?raw"

export const generatePdf = async (character: CharacterData): Promise<Uint8Array> => {
    try {
        const binaryString = atob(base64PdfData)
        const pdfBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i)
        }

        const pdfDoc = await PDFDocument.load(pdfBytes)
        const form = pdfDoc.getForm()

        const nameField = form.getField("Name") as PDFTextField
        nameField.setText(character.name)

        const styleField = form.getField("Style") as PDFTextField
        styleField.setText(character.style)

        const activityField = form.getField("Cozy Activity") as PDFTextField
        activityField.setText(character.activity)

        // Abilities
        character.abilities.forEach((ability, index) => {
            const abilityField = form.getField(`Ability.${index}`) as PDFTextField
            abilityField.setText(`${ability.value}`)
        })

        // XP
        for (let i = 0; i < 5; i++) {
            const xpField = form.getField(`XP.${i}`) as PDFCheckBox
            if (character.xp >= i) {
                xpField.check()
            } else {
                xpField.uncheck()
            }
        }

        // Conditions
        const [firstCondition, secondCondition, ...remainingConditions] = character.conditions.split(/\n+/)
        const firstConditionField = form.getField("Condition.0") as PDFTextField
        firstConditionField.setText(firstCondition)
        const secondConditionField = form.getField("Condition.1") as PDFTextField
        secondConditionField.setText(secondCondition)
        const thirdConditionField = form.getField("Condition.2") as PDFTextField
        thirdConditionField.setText(remainingConditions.join("\n"))

        // Second Column
        character.endOfSessionChecks.forEach((check, index) => {
            // At 0 there is "Did the Murder Mavens solve a mystery?"
            // Which doesn't have a selectable checkbox in the PDF
            if (index !== 0) {
                const checkField = form.getField(`EOS.${index - 1}`) as PDFCheckBox
                if (check) {
                    checkField.check()
                } else {
                    checkField.uncheck()
                }
            }
        })

        character.advancementChecks.forEach((check, index) => {
            const checkField = form.getField(`Advancements.${index}`) as PDFCheckBox
            if (check) {
                checkField.check()
            } else {
                checkField.uncheck()
            }
        })

        character.mavenMoves.split(/\n+/).forEach((move, index) => {
            if (index <= 8) {
                const moveField = form.getField(`Maven Move.${index}`) as PDFTextField
                moveField.setText(move)
            } else {
                console.warn(`Maven Move ${index} is too long: ${move}`)
            }
        })

        // Third Column
        character.crownChecks.forEach((check, index) => {
            const checkField = form.getField(`CrowdQueen.${index}`) as PDFCheckBox
            if (check) {
                checkField.check()
            } else {
                checkField.uncheck()
            }
        })

        character.voidChecks.forEach((check, index) => {
            const checkField = form.getField(`CrowdVoid.${index}`) as PDFCheckBox
            if (check) {
                checkField.check()
            } else {
                checkField.uncheck()
            }
        })

        // Set Cozy_Thing fields in order: 0.0, 0.1, 1.0, 1.1, 2.0, 2.1, etc.
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 2; j++) {
                const fieldIndex = i * 2 + j
                if (fieldIndex < character.cozyItems.length) {
                    const cozyItem = character.cozyItems[fieldIndex]
                    const textField = form.getField(`Cozy_Thing.${i}.${j}`) as PDFTextField
                    textField.setText(cozyItem.text)

                    const checkField = form.getField(`Cozy_Box.${i}.${j}`) as PDFCheckBox
                    if (cozyItem.checked) {
                        checkField.check()
                    } else {
                        checkField.uncheck()
                    }
                }
            }
        }

        const filledPdfBytes = await pdfDoc.save()

        return filledPdfBytes
    } catch (error) {
        console.error("Error generating PDF:", error)
        throw new Error(`Failed to generate PDF: ${error}`)
    }
}

export const downloadPdf = async (character: CharacterData, filename?: string) => {
    try {
        const pdfBytes = await generatePdf(character)

        const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" })

        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename || `CozyCrowns_${character.name || "Character"}.pdf`

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)
    } catch (error) {
        console.error("Error downloading PDF:", error)
        throw error
    }
}
