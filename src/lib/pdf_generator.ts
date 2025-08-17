import type { CharacterData } from "@/types/characterSchema"
import { PDFDocument, PDFTextField, PDFCheckBox } from "pdf-lib"

import base64PdfData from "../resources/brindlewoodbay-charactersheet_fillable.base64?raw"

export const generatePdf = async (character: CharacterData): Promise<Uint8Array> => {
    try {
        // Decode the base64 PDF data
        const binaryString = atob(base64PdfData)
        const pdfBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i)
        }

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(pdfBytes)
        const form = pdfDoc.getForm()

        // Fill in character name fields
        const nameFields = form.getFields().filter((field) => field.getName() === "NameButton")
        nameFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.name || "")
            }
        })

        // Fill in style fields
        const styleFields = form.getFields().filter((field) => field.getName() === "StyleButton")
        styleFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.style || "")
            }
        })

        // Fill in activity field
        const activityFields = form.getFields().filter((field) => field.getName() === "Activity")
        activityFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.activity || "")
            }
        })

        // Fill in cozy items
        const cozyBoxFields = form.getFields().filter((field) => field.getName() === "Cozy_Box")
        const cozyThingFields = form.getFields().filter((field) => field.getName() === "Cozy_Thing")
        const cozyButtonFields = form.getFields().filter((field) => field.getName() === "CozyButton")

        // Fill first cozy item if available
        if (character.cozyItems.length > 0 && character.cozyItems[0].text) {
            cozyBoxFields.forEach((field) => {
                if (field instanceof PDFTextField) {
                    field.setText(character.cozyItems[0].text)
                }
            })
            cozyThingFields.forEach((field) => {
                if (field instanceof PDFTextField) {
                    field.setText(character.cozyItems[0].text)
                }
            })
        }

        // Fill maven moves
        const mavenMoveFields = form.getFields().filter((field) => field.getName() === "Maven Move")
        mavenMoveFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.mavenMoves || "")
            }
        })

        // Fill XP
        const xpFields = form.getFields().filter((field) => field.getName() === "XP")
        xpFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.xp.toString())
            }
        })

        // Fill conditions
        const conditionFields = form.getFields().filter((field) => field.getName() === "Condition")
        conditionFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(character.conditions || "")
            }
        })

        // Fill abilities (as a single field)
        const abilityFields = form.getFields().filter((field) => field.getName() === "Ability")
        const abilitiesText = character.abilities
            .map((ability) => `${ability.name}: ${ability.value > 0 ? "+" : ""}${ability.value}`)
            .join(", ")
        abilityFields.forEach((field) => {
            if (field instanceof PDFTextField) {
                field.setText(abilitiesText)
            }
        })

        // Handle checkboxes for end of session, advancements, crown checks, etc.
        // These are more complex as they involve checking/unchecking boxes based on boolean arrays

        // End of Session checks
        const eosFields = form.getFields().filter((field) => field.getName() === "EOS")
        character.endOfSessionChecks.forEach((checked, index) => {
            if (eosFields[index] && eosFields[index] instanceof PDFCheckBox) {
                if (checked) {
                    ;(eosFields[index] as PDFCheckBox).check()
                } else {
                    ;(eosFields[index] as PDFCheckBox).uncheck()
                }
            }
        })

        // Crown checks
        const crownQueenFields = form.getFields().filter((field) => field.getName() === "CrowdQueen")
        const crownVoidFields = form.getFields().filter((field) => field.getName() === "CrowdVoid")

        character.crownChecks.forEach((checked, index) => {
            if (crownQueenFields[index] && crownQueenFields[index] instanceof PDFCheckBox) {
                if (checked) {
                    ;(crownQueenFields[index] as PDFCheckBox).check()
                } else {
                    ;(crownQueenFields[index] as PDFCheckBox).uncheck()
                }
            }
        })

        character.voidChecks.forEach((checked, index) => {
            if (crownVoidFields[index] && crownVoidFields[index] instanceof PDFCheckBox) {
                if (checked) {
                    ;(crownVoidFields[index] as PDFCheckBox).check()
                } else {
                    ;(crownVoidFields[index] as PDFCheckBox).uncheck()
                }
            }
        })

        // Cozy items checkboxes
        character.cozyItems.forEach((item, index) => {
            if (cozyButtonFields[index] && cozyButtonFields[index] instanceof PDFCheckBox) {
                if (item.checked) {
                    ;(cozyButtonFields[index] as PDFCheckBox).check()
                } else {
                    ;(cozyButtonFields[index] as PDFCheckBox).uncheck()
                }
            }
        })

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

        const blob = new Blob([pdfBytes], { type: "application/pdf" })

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

// [
//     "Name",
//     "Cozy_Box.0.1",
//     "Cozy_Box.0.0",
//     "Cozy_Box.1.0",
//     "Cozy_Box.1.1",
//     "Cozy_Box.2.0",
//     "Cozy_Box.2.1",
//     "Cozy_Box.3.0",
//     "Cozy_Box.3.1",
//     "Cozy_Box.4.0",
//     "Cozy_Box.4.1",
//     "Cozy_Box.5.0",
//     "Cozy_Box.5.1",
//     "Cozy_Box.6.0",
//     "Cozy_Box.6.1",
//     "Cozy_Box.7.0",
//     "Cozy_Box.7.1",
//     "Cozy_Box.8.0",
//     "Cozy_Box.8.1",
//     "Cozy_Thing.0.0",
//     "Cozy_Thing.0.1",
//     "Cozy_Thing.1.0",
//     "Cozy_Thing.1.1",
//     "Cozy_Thing.2.0",
//     "Cozy_Thing.2.1",
//     "Cozy_Thing.3.0",
//     "Cozy_Thing.3.1",
//     "Cozy_Thing.4.0",
//     "Cozy_Thing.4.1",
//     "Cozy_Thing.5.0",
//     "Cozy_Thing.5.1",
//     "Cozy_Thing.6.0",
//     "Cozy_Thing.6.1",
//     "Cozy_Thing.7.0",
//     "Cozy_Thing.7.1",
//     "Cozy_Thing.8.0",
//     "Cozy_Thing.8.1",
//     "Maven Move.0",
//     "Maven Move.1",
//     "Maven Move.2",
//     "Maven Move.3",
//     "Maven Move.4",
//     "Maven Move.5",
//     "Maven Move.6",
//     "Maven Move.7",
//     "Maven Move.8",
//     "NameButton",
//     "StyleButton",
//     "Style",
//     "Cozy Activity",
//     "EOS.0",
//     "EOS.1",
//     "EOS.2",
//     "EOS.3",
//     "EOS.4",
//     "EOS.5",
//     "Advancements.0",
//     "Advancements.1",
//     "Advancements.2",
//     "Advancements.3",
//     "Advancements.4",
//     "CrowdQueen.0",
//     "CrowdQueen.1",
//     "CrowdQueen.2",
//     "CrowdQueen.3",
//     "CrowdQueen.4",
//     "CrowdQueen.5",
//     "CrowdQueen.6",
//     "CrowdVoid.0",
//     "CrowdVoid.1",
//     "CrowdVoid.2",
//     "CrowdVoid.3",
//     "CrowdVoid.4",
//     "CozyButton",
//     "Ability.0",
//     "Ability.1",
//     "Ability.2",
//     "Ability.3",
//     "Ability.4",
//     "XP.0",
//     "XP.1",
//     "XP.2",
//     "XP.3",
//     "XP.4",
//     "Collecting",
//     "Condition.0",
//     "Condition.1",
//     "Condition.2"
// ]
