import { useCharacterStore } from "@/lib/character_store";
import { createDefaultCharacter } from "@/lib/character_document";
import { useSettingsStore } from "@/lib/settings_store";
import { downloadPdf } from "@/lib/pdf_generator";
import { loadTranslations } from "@/lib/utils";
import { CharacterDataSchema } from "@/types/characterSchema";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
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
  const characterStore = useCharacterStore();
  const { setLocale } = useSettingsStore();
  const { i18n } = useLingui();
  const { user, updateProfile, isUpdatingProfile, signOut, isAuthenticated } = useAuth();
  const { saveCurrentCharacter } = useCharacterSave();
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

  const handleLogout = () => {
    signOut();
  };

  const handleDownloadJSON = () => {
    const characterData = characterStore.getCharacterData();

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

      await downloadPdf(pdfData);
      toast.success(i18n._("PDF downloaded successfully!"));
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(i18n._("Failed to download PDF. Please try again."));
    }
  };

  const handleLoadFromJSON = async () => {
    const saveSuccess = await saveCurrentCharacter();
    if (!saveSuccess) {
      const loadAction = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.addEventListener("change", (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) return;

          const reader = new FileReader();
          reader.addEventListener("load", (e) => {
            try {
              const rawData = JSON.parse(e.target?.result as string);

              const validationResult = CharacterDataSchema.safeParse(rawData);

              if (!validationResult.success) {
                const errorMessages = validationResult.error.issues
                  .map((err) => `${err.path.join(".")}: ${err.message}`)
                  .join(", ");
                console.error(errorMessages);
                toast.error(i18n._(msg`Invalid character data format: ${errorMessages}`));
                return;
              }

              const characterData = validationResult.data;

              characterStore.updateSelected(characterData);

              characterStore.clearCurrentCharacterIdAndVersion();

              onOpenChange?.(false);
              toast.success(i18n._("Character data loaded successfully!"));
            } catch (error) {
              if (error instanceof SyntaxError) {
                toast.error(i18n._("Invalid JSON file format."));
              } else {
                toast.error(i18n._("Error loading character data. Please check the file format."));
              }
            }
          });
          reader.readAsText(file);
        });

        input.click();
      };
      setPendingLoadAction(() => loadAction);
      setSaveFailureOpen(true);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener("load", (e) => {
        try {
          const rawData = JSON.parse(e.target?.result as string);

          const validationResult = CharacterDataSchema.safeParse(rawData);

          if (!validationResult.success) {
            const errorMessages = validationResult.error.issues
              .map((err) => `${err.path.join(".")}: ${err.message}`)
              .join(", ");
            console.error(errorMessages);
            toast.error(i18n._(msg`Invalid character data format: ${errorMessages}`));
            return;
          }

          const characterData = validationResult.data;

          characterStore.updateSelected(characterData);

          characterStore.clearCurrentCharacterIdAndVersion();

          onOpenChange?.(false);
          toast.success(i18n._("Character data loaded successfully!"));
        } catch (error) {
          if (error instanceof SyntaxError) {
            toast.error(i18n._("Invalid JSON file format."));
          } else {
            toast.error(i18n._("Error loading character data. Please check the file format."));
          }
        }
      });
      reader.readAsText(file);
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
    characterStore.updateSelected(createDefaultCharacter());

    setShowResetConfirm(false);
    onOpenChange?.(false);
    toast.success(i18n._("Character reset successfully!"));
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const getMaxWidth = () => {
    if (showResetConfirm) return "sm:max-w-[525px]";
    if (showMe || showCredits) return "sm:max-w-[500px]";
    return "sm:max-w-[425px]";
  };

  return (
    <DialogContent
      className={`${getMaxWidth()} ${showResetConfirm ? "confirmation-dialog" : "bg-secondary/90 border-0 shadow-none"}`}
      style={showResetConfirm ? undefined : { boxShadow: "none" }}
    >
      <VisuallyHidden.Root asChild>
        <DialogTitle>Menu</DialogTitle>
      </VisuallyHidden.Root>
      {showResetConfirm ? (
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
          onMeClick={() => setShowMe(true)}
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
