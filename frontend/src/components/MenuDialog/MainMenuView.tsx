import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthButton } from "@/components/AuthButton";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  CoffeeIcon,
  Download,
  Feather,
  FileDown,
  Globe,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

type MainMenuViewProps = {
  onDownloadPDF: () => void;
  onDownloadJSON: () => void;
  onLoadFromJSON: () => void;
  onResetClick: () => void;
  onCreditsClick: () => void;
  onRecoveryClick: () => void;
  onMeClick: () => void;
  onOpenNavigator: () => void;
  onLanguageChange: (locale: string) => void;
  isAuthenticated?: boolean;
  onBookClubsClick?: () => void;
};

export const MainMenuView = ({
  onDownloadPDF,
  onDownloadJSON,
  onLoadFromJSON,
  onResetClick,
  onCreditsClick,
  onRecoveryClick,
  onMeClick,
  onOpenNavigator,
  onLanguageChange,
  isAuthenticated,
  onBookClubsClick,
}: MainMenuViewProps) => {
  return (
    <>
      <DialogDescription className="sr-only">
        <Trans>Manage your character and settings.</Trans>
      </DialogDescription>
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <AuthButton onMeClick={onMeClick} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              aria-label={t`Language`}
            >
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
      <div className="mb-3 -mt-2 flex justify-end">
        <button
          type="button"
          className="navigation-shortcut-hint"
          aria-label={t`Go to a page`}
          title={t`Go to a page`}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={onOpenNavigator}
        >
          <kbd>⌘ / Ctrl K</kbd>
        </button>
      </div>
      <div className="character-menu-actions grid min-w-0 gap-4">
        <Button onClick={onDownloadPDF} variant="dark" className="w-full dark-ring">
          <FileDown className="w-4 h-4 shrink-0" />
          <Trans>Download PDF</Trans>
        </Button>
        {isAuthenticated && onBookClubsClick ? (
          <Button onClick={onBookClubsClick} variant="dark" className="w-full dark-ring">
            <Users className="w-4 h-4 shrink-0" />
            <Trans>Book Clubs</Trans>
          </Button>
        ) : null}
        {isAuthenticated ? (
          <Button asChild variant="dark" className="w-full dark-ring">
            <a href="/mysteries">
              <Feather className="w-4 h-4 shrink-0" />
              <Trans>Mysteries</Trans>
            </a>
          </Button>
        ) : null}
        <Button onClick={onDownloadJSON} variant="dark" className="w-full dark-ring">
          <Download className="w-4 h-4 shrink-0" />
          <Trans>Download save file</Trans>
        </Button>
        <Button onClick={onLoadFromJSON} variant="dark" className="w-full dark-ring">
          <Upload className="w-4 h-4 shrink-0" />
          <Trans>Load from save file</Trans>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <Trans>Drop a save file here, or paste a JSON file.</Trans>
        </p>
        <Button onClick={onRecoveryClick} variant="dark" className="w-full dark-ring">
          <Trans>Recently deleted Mavens</Trans>
        </Button>
        <Button onClick={onResetClick} variant="destructive" className="w-full dark-ring">
          <Trash2 className="w-4 h-4 shrink-0" />
          <Trans>Reset Character</Trans>
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="link" asChild>
            <a href="https://odin-matthias.de" target="_blank" rel="noopener noreferrer">
              <Trans>Odin's Blog</Trans>
            </a>
          </Button>
          <Button variant="link" asChild>
            <a
              href="https://github.com/Odin94/CozyCrowns-brindlewood-bay"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Trans>Source Code</Trans>
            </a>
          </Button>
          <Button variant="link" onClick={onCreditsClick}>
            <Trans>Credits</Trans>
          </Button>
        </div>
        <Button variant="secondary" asChild className="w-full justify-center">
          <a href="https://ko-fi.com/odin_dev" target="_blank" rel="noopener noreferrer">
            <Trans>Support Me</Trans>{" "}
            <CoffeeIcon className="ml-2 support-coffee-icon" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </>
  );
};
