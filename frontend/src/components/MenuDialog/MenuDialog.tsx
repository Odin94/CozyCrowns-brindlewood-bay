import { characterCoordinator } from "@/lib/character_sync_runtime";
import { Button } from "@/components/ui/button";
import { Trans } from "@lingui/react/macro";
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store";
import { createDefaultCharacter, normalizeCharacter } from "@/lib/character_document";
import { useSettingsStore } from "@/lib/settings_store";
import { accountScope } from "@/lib/account_scope";
import { loadTranslations } from "@/lib/utils";
import { CharacterDataSchema } from "@/types/characterSchema";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCharacterSave } from "@/hooks/useCharacterSave";
import { ResetConfirmView } from "@/components/MenuDialog/ResetConfirmView";
import { MeView } from "@/components/MenuDialog/MeView";
import { CreditsView } from "@/components/MenuDialog/CreditsView";
import { MainMenuView } from "@/components/MenuDialog/MainMenuView";
import { SaveFailureDialog } from "@/components/MenuDialog/SaveFailureDialog";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

type MenuDialogProps = {
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  onBookClubsClick?: () => void;
};

const MenuDialog = ({ onOpenChange, open, onBookClubsClick }: MenuDialogProps) => {
  const characterStore = useCharacterStore.getState();
  const setLocale = useSettingsStore((state) => state.setLocale);
  const { i18n } = useLingui();
  const { user, updateProfile, isUpdatingProfile, signOut, isAuthenticated } = useAuth();
  const { saveCurrentCharacter } = useCharacterSave();
  const importing = useRef(false);
  const mounted = useRef(true);
  const [isImporting, setIsImporting] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const archivedCharacters = useCharacterStore((state) => state.archivedCharacters);
  const [showRecovery, setShowRecovery] = useState(false);
  const [, setRecoveryTick] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showMe, setShowMe] = useState(false);
  const [saveFailureOpen, setSaveFailureOpen] = useState(false);
  const [pendingLoadAction, setPendingLoadAction] = useState<(() => void) | null>(null);

  const handleLanguageChange = async (locale: string) => {
    await loadTranslations(locale);
    await i18n.activate(locale);
    setLocale(locale);
  };

  // Reset transient views when dialog is re-opened
  useEffect(() => {
    if (open) {
      setShowResetConfirm(false);
      setShowCredits(false);
      setShowMe(false);
      setShowRecovery(false);
    }
  }, [open]);

  const handleUpdateProfile = async (nickname: string | null) => {
    try {
      await updateProfile({ nickname });
      toast.success(i18n._("Profile updated successfully!"));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(i18n._("Failed to update profile. Please try again."));
    }
  };

  const handleLogout = async () => {
    await saveCurrentCharacter();
    signOut();
  };

  const handleDownloadJSON = () => {
    const characterData = normalizeCharacter(characterStore.getCharacterData());

    const jsonString = JSON.stringify(characterData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CozyCrowns_${characterData.name || "Character"}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    try {
      const characterData = characterStore.getCharacterData();

      // Ensure schemaVersion is always a number (not undefined)
      const pdfData = {
        ...characterData,
        schemaVersion: characterData.schemaVersion ?? 1,
      };

      const { downloadPdf } = await import("@/lib/pdf_generator");
      await downloadPdf(pdfData);
      toast.success(i18n._("PDF downloaded successfully!"));
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(i18n._("Failed to download PDF. Please try again."));
    }
  };

  const importFile = async (file: File) => {
    if (importing.current) return;
    importing.current = true;
    setIsImporting(true);
    const scope = accountScope.current();
    const selectedId = characterStore.selectedCharacterId;
    const originalContent = JSON.stringify(characterStore.getCharacterData());
    const isCurrent = () =>
      mounted.current &&
      accountScope.current().accountId === scope.accountId &&
      accountScope.current().generation === scope.generation &&
      useCharacterStore.getState().selectedCharacterId === selectedId &&
      JSON.stringify(useCharacterStore.getState().getCharacterData()) === originalContent;
    try {
      const rawData: unknown = JSON.parse(await file.text());
      const validation = CharacterDataSchema.safeParse(rawData);
      if (!validation.success) {
        const errorMessages = validation.error.issues
          .map((error) => `${error.path.join(".")}: ${error.message}`)
          .join(", ");
        toast.error(i18n._(msg`Invalid character data format: ${errorMessages}`));
        return;
      }
      const apply = () => {
        if (!isCurrent()) {
          toast.error(
            i18n._(msg`Your sheet changed while the file was opening. Load the file again.`),
          );
          return;
        }
        characterStore.updateSelected(validation.data);
        characterStore.clearCurrentCharacterIdAndVersion();
        onOpenChange?.(false);
        toast.success(i18n._("Character data loaded successfully!"));
      };
      if (!isCurrent()) {
        apply();
        return;
      }
      if (await saveCurrentCharacter()) apply();
      else {
        setPendingLoadAction(() => apply);
        setSaveFailureOpen(true);
      }
    } catch (error) {
      toast.error(
        i18n._(
          error instanceof SyntaxError
            ? "Invalid JSON file format."
            : "Error loading character data. Please check the file format.",
        ),
      );
    } finally {
      importing.current = false;
      if (mounted.current) setIsImporting(false);
    }
  };

  const handleLoadFromJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void importFile(file);
    });
    input.click();
  };

  const handleSaveFailureContinue = () => {
    if (pendingLoadAction) {
      pendingLoadAction();
      setPendingLoadAction(null);
    }
    setSaveFailureOpen(false);
  };

  const handleSaveFailureCancel = () => {
    setPendingLoadAction(null);
    setSaveFailureOpen(false);
  };

  const confirmReset = () => {
    characterStore.updateSelected({
      ...createDefaultCharacter(),
      abilities: getDefaultAbilities(),
    });

    setShowResetConfirm(false);
    onOpenChange?.(false);
    toast.success(i18n._("Character reset successfully!"));
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const getMaxWidth = () => {
    if (showRecovery) return "sm:max-w-[600px]";
    if (showResetConfirm) return "sm:max-w-[525px]";
    if (showMe || showCredits) return "sm:max-w-[500px]";
    return "sm:max-w-[425px]";
  };

  return (
    <DialogContent
      aria-busy={isImporting}
      onDragOver={(event) => {
        if (
          showMe ||
          showCredits ||
          showResetConfirm ||
          saveFailureOpen ||
          !event.dataTransfer.types.includes("Files")
        )
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsDraggingFile(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setIsDraggingFile(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setIsDraggingFile(false);
        if (showMe || showCredits || showResetConfirm || saveFailureOpen) return;
        const file = event.dataTransfer.files[0];
        void importFile(file);
      }}
      onPaste={(event) => {
        if (
          showMe ||
          showCredits ||
          showResetConfirm ||
          saveFailureOpen ||
          (event.target as HTMLElement).closest("input, textarea")
        )
          return;
        const file = event.clipboardData.files[0];
        if (!file) return;
        event.preventDefault();
        void importFile(file);
      }}
      className={`${isDraggingFile ? "ring-2 ring-primary" : ""} ${getMaxWidth()} ${showResetConfirm ? "confirmation-dialog" : showRecovery ? "max-w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-y-auto bg-secondary text-secondary-foreground border-border shadow-lg" : "bg-secondary/90 border-0 shadow-none"}`}
      style={showResetConfirm || showRecovery ? undefined : { boxShadow: "none" }}
    >
      <VisuallyHidden.Root asChild>
        <DialogTitle>Menu</DialogTitle>
      </VisuallyHidden.Root>
      {isImporting && (
        <p role="status" className="text-center text-sm text-foreground">
          {i18n._(msg`Opening save file…`)}
        </p>
      )}
      {showRecovery ? (
        <div className="min-w-0 space-y-5">
          <h2 className="text-lg font-semibold">
            <Trans>Recently deleted Mavens</Trans>
          </h2>
          <p className="text-sm leading-relaxed">
            <Trans>
              The most recent 20 deleted Mavens are available for 30 days. Restoring creates a
              separate local copy.
            </Trans>
          </p>
          {archivedCharacters.length === 0 && (
            <p>
              <Trans>No deleted Mavens to recover.</Trans>
            </p>
          )}
          {user &&
            characterCoordinator.pending(user.id).map((deletion) => (
              <div
                key={deletion.localId}
                className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <Trans>Pending cloud deletion</Trans>
                </span>
                <Button
                  variant="dark"
                  className="shrink-0"
                  onClick={() =>
                    void characterCoordinator
                      .delete(user.id, deletion.localId)
                      .then(() => setRecoveryTick((tick) => tick + 1))
                      .catch(() =>
                        toast.error(
                          i18n._(msg`Could not finish deletion. The pending request is preserved.`),
                        ),
                      )
                  }
                >
                  <Trans>Retry</Trans>
                </Button>
              </div>
            ))}
          <div className="max-h-80 space-y-4 overflow-y-auto px-1 py-1">
            {archivedCharacters.map((entry) => (
              <div
                key={entry.record.localId}
                className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {entry.record.name || i18n._(msg`Unnamed Maven`)}
                </span>
                <Button
                  variant="dark"
                  className="shrink-0"
                  onClick={() => {
                    characterStore.restoreArchived(entry.record.localId);
                    onOpenChange?.(false);
                  }}
                >
                  <Trans>Restore copy</Trans>
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setShowRecovery(false)}>
            <Trans>Back</Trans>
          </Button>
        </div>
      ) : showResetConfirm ? (
        <ResetConfirmView onConfirm={confirmReset} onCancel={cancelReset} />
      ) : showMe ? (
        <MeView
          user={user}
          onUpdateProfile={handleUpdateProfile}
          onLogout={handleLogout}
          onBack={() => setShowMe(false)}
          isUpdatingProfile={isUpdatingProfile}
        />
      ) : showCredits ? (
        <CreditsView onBack={() => setShowCredits(false)} />
      ) : (
        <MainMenuView
          onDownloadPDF={handleDownloadPDF}
          onDownloadJSON={handleDownloadJSON}
          onLoadFromJSON={handleLoadFromJSON}
          onResetClick={() => setShowResetConfirm(true)}
          onCreditsClick={() => setShowCredits(true)}
          onRecoveryClick={() => setShowRecovery(true)}
          onMeClick={() => setShowMe(true)}
          onOpenNavigator={() => {
            onOpenChange?.(false);
            window.dispatchEvent(new Event("cozycrowns:open-navigation"));
          }}
          onLanguageChange={handleLanguageChange}
          isAuthenticated={isAuthenticated}
          onBookClubsClick={onBookClubsClick}
        />
      )}
      <Dialog open={saveFailureOpen} onOpenChange={setSaveFailureOpen}>
        <SaveFailureDialog
          onContinue={handleSaveFailureContinue}
          onCancel={handleSaveFailureCancel}
        />
      </Dialog>
    </DialogContent>
  );
};

export default MenuDialog;
