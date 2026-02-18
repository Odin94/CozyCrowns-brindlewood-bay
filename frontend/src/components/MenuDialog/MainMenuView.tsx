import { Button } from "@/components/ui/button"
import { DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AuthButton } from "@/components/AuthButton"
import { Trans } from "@lingui/react/macro"
import { CoffeeIcon, Download, FileDown, Globe, Trash2, Upload } from "lucide-react"

type MainMenuViewProps = {
    onDownloadPDF: () => void
    onDownloadJSON: () => void
    onLoadFromJSON: () => void
    onResetClick: () => void
    onCreditsClick: () => void
    onMeClick: () => void
    onLanguageChange: (locale: string) => void
}

export const MainMenuView = ({
    onDownloadPDF,
    onDownloadJSON,
    onLoadFromJSON,
    onResetClick,
    onCreditsClick,
    onMeClick,
    onLanguageChange,
}: MainMenuViewProps) => {
    return (
        <>
            <DialogDescription className="sr-only">
                <Trans>Manage your character and settings.</Trans>
            </DialogDescription>
            <div className="flex justify-between items-center mb-4">
                <AuthButton onMeClick={onMeClick} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Globe className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLanguageChange("en")}>
                            <Trans>English</Trans>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onLanguageChange("de")}>
                            <Trans>Deutsch</Trans>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="grid gap-4">
                <Button onClick={onDownloadPDF} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <FileDown className="w-4 h-4 mr-2" />
                    <Trans>Download PDF</Trans>
                </Button>
                <Button onClick={onDownloadJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <Download className="w-4 h-4 mr-2" />
                    <Trans>Download save file</Trans>
                </Button>
                <Button onClick={onLoadFromJSON} className="w-full text-primary bg-dark-secondary hover:bg-dark-secondary/90 dark-ring">
                    <Upload className="w-4 h-4 mr-2" />
                    <Trans>Load from save file</Trans>
                </Button>
                <Button onClick={onResetClick} className="w-full text-primary bg-red-600/50 hover:bg-red-700/80 dark-ring">
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
                    <Button variant="link" onClick={onCreditsClick}>
                        <Trans>Credits</Trans>
                    </Button>
                </div>
                <Button variant="secondary" asChild className="w-full justify-center">
                    <a href="https://ko-fi.com/odin_dev" target="_blank" rel="noopener noreferrer">
                        <Trans>Support Me</Trans> <CoffeeIcon className="ml-2" />
                    </a>
                </Button>
            </div>
        </>
    )
}
