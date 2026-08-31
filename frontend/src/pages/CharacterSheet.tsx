import Abilities from "@/components/character/Abilities";
import Advancements from "@/components/character/Advancements";
import CharacterTabs from "@/components/character/CharacterTabs";
import Conditions from "@/components/character/Conditions";
import CozyActivity from "@/components/character/CozyActivity";
import CozyLittlePlace from "@/components/character/CozyLittlePlace";
import CrownOfTheQueen from "@/components/character/CrownOfTheQueen";
import CrownOfTheVoid from "@/components/character/CrownOfTheVoid";
import DeleteConfirmDialog from "@/components/character/DeleteConfirmDialog";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { useIsLargeScreen } from "@/hooks/useIsLargeScreen";
import { useCharacterSave } from "@/hooks/useCharacterSave";
import { useBackendCharactersSync } from "@/hooks/useBackendCharactersSync";
import { useBackendDarkConspiraciesSync } from "@/hooks/useBackendDarkConspiraciesSync";
import { SaveFailureDialog } from "@/components/MenuDialog/SaveFailureDialog";
import { useCharacterStore } from "@/lib/character_store";
import { useAuth } from "@/hooks/useAuth";
import DarkConspiracySheet from "@/pages/DarkConspiracySheet";
import EndOfSession from "@/components/character/EndOfSession";
import MavenMoves from "@/components/character/MavenMoves";
import MenuDialog from "@/components/MenuDialog/MenuDialog";
import Name from "@/components/character/Name";
import Style from "@/components/character/Style";
import Tentacles from "@/components/character/Tentacles";
import XpTrack from "@/components/character/XpTrack";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useEffect, useMemo, useRef, useState } from "react";

const CharacterSheet = ({ onBookClubsClick }: { onBookClubsClick: () => void }) => {
  // useLingui() is Required to ensure component rerenders when locale changes
  useLingui();
  useBackendCharactersSync();
  useBackendDarkConspiraciesSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveFailureOpen, setSaveFailureOpen] = useState(false);
  const [pendingSwitchIndex, setPendingSwitchIndex] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"character" | "darkConspiracy">("character");
  const isLargeScreen = useIsLargeScreen();
  const {
    deleteConfirmOpen,
    deleteConfirmIndex,
    handleDeleteCharacter,
    confirmDelete,
    cancelDelete,
    setDeleteConfirmOpen,
  } = useDeleteConfirmation();
  const { saveCurrentCharacter } = useCharacterSave();
  const { setCurrentCharacter } = useCharacterStore();
  const currentCharacter = useCharacterStore(
    (state) => state.characters[state.currentCharacterIndex],
  );
  const currentCharacterIndex = useCharacterStore((state) => state.currentCharacterIndex);
  const { isAuthenticated, user } = useAuth();
  const lastAutoSaved = useRef<string | null>(null);
  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        characterKey: currentCharacterIndex,
        data: currentCharacter && {
          name: currentCharacter.name,
          style: currentCharacter.style,
          activity: currentCharacter.activity,
          abilities: currentCharacter.abilities,
          xp: currentCharacter.xp,
          conditions: currentCharacter.conditions,
          endOfSessionChecks: currentCharacter.endOfSessionChecks,
          advancementChecks: currentCharacter.advancementChecks,
          mavenMoves: currentCharacter.mavenMoves,
          crownChecks: currentCharacter.crownChecks,
          voidChecks: currentCharacter.voidChecks,
          cozyItems: currentCharacter.cozyItems,
        },
      }),
    [currentCharacter, currentCharacterIndex],
  );

  useEffect(() => {
    lastAutoSaved.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !currentCharacter?.name.trim()) return;
    if (lastAutoSaved.current === autoSaveSignature) return;

    const timer = window.setTimeout(() => {
      void saveCurrentCharacter().then((saved) => {
        if (saved) lastAutoSaved.current = autoSaveSignature;
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [autoSaveSignature, currentCharacter?.name, isAuthenticated, saveCurrentCharacter]);

  const handleSwitchCharacter = async (index: number): Promise<boolean> => {
    const saveSuccess = await saveCurrentCharacter();
    if (!saveSuccess) {
      setPendingSwitchIndex(index);
      setSaveFailureOpen(true);
      return false;
    }
    return true;
  };

  const handleSaveFailureContinue = () => {
    if (pendingSwitchIndex !== null) {
      setCurrentCharacter(pendingSwitchIndex);
      setPendingSwitchIndex(null);
    }
    setSaveFailureOpen(false);
  };

  const handleSaveFailureCancel = () => {
    setPendingSwitchIndex(null);
    setSaveFailureOpen(false);
  };

  return (
    <div
      className={`min-h-screen w-full from-gray-900 to-gray-800 p-3 sm:p-4 md:p-5 lg:p-6 ${isLargeScreen ? "pb-4" : "pb-20"}`}
    >
      <div className="w-full max-w-none">
        <div className="mb-5 text-center sm:mb-8">
          <h1 className="text-3xl font-bold text-white mb-0">CozyCrowns 👑</h1>
          <div
            className="text-xs font-normal text-gray-300 font-sans -mt-4"
            style={{ marginLeft: "4.5rem" }}
          >
            <Trans>by Odin</Trans>
          </div>
        </div>

        {activeView === "character" ? (
          <div className="conspiracy-view-enter relative mx-auto grid max-w-7xl grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {/* Column 1 */}
            <div className="relative col-span-1 flex min-h-0 flex-col space-y-4 rounded-lg bg-gray-800 p-4 shadow-lg sm:space-y-5 sm:p-5 lg:p-6">
              <div className="absolute top-0 left-0 w-full -mt-8">
                <Tentacles setMenuOpen={setMenuOpen} />
              </div>
              <Name />
              <Style />
              <CozyActivity />
              <Abilities />
              <XpTrack />
              <Conditions />
            </div>

            {/* Column 2 */}
            <div className="relative z-20 col-span-1 flex min-h-0 flex-col space-y-4 rounded-lg bg-gray-800 p-4 shadow-lg sm:space-y-5 sm:p-5 lg:p-6">
              <EndOfSession />
              <Advancements />
              <MavenMoves />
            </div>

            {/* Column 3 */}
            <div className="col-span-1 flex min-h-0 flex-col space-y-4 rounded-lg bg-gray-800 p-4 shadow-lg sm:space-y-5 sm:p-5 lg:p-6">
              <CrownOfTheQueen />
              <CrownOfTheVoid />
              <CozyLittlePlace />
            </div>

            {/* Menu Button - Desktop version */}
            <div className="hidden lg:block absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              <Button
                onClick={() => setMenuOpen(true)}
                variant="dark"
                className="transition-all duration-300 origin-top rounded-t-none h-8 dark-ring hover:scale-y-110 -mt-2 relative z-10"
              >
                <Trans>Menu</Trans>
              </Button>
            </div>
          </div>
        ) : (
          <div className="conspiracy-view-enter">
            <DarkConspiracySheet />
          </div>
        )}
      </div>

      {/* Menu Button - Mobile version */}
      <div className="lg:hidden flex justify-center mt-8">
        <Button onClick={() => setMenuOpen(true)} variant="dark">
          <Trans>Menu</Trans>
        </Button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuDialog
          onOpenChange={setMenuOpen}
          open={menuOpen}
          onBookClubsClick={() => {
            setMenuOpen(false);
            onBookClubsClick();
          }}
        />
      </Dialog>

      {/* Delete confirmation for character tabs */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DeleteConfirmDialog
          characterIndex={deleteConfirmIndex}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          isAuthenticated={isAuthenticated}
        />
      </Dialog>

      {/* Save failure dialog */}
      <Dialog open={saveFailureOpen} onOpenChange={setSaveFailureOpen}>
        <SaveFailureDialog
          onContinue={handleSaveFailureContinue}
          onCancel={handleSaveFailureCancel}
        />
      </Dialog>

      <CharacterTabs
        onDeleteCharacter={handleDeleteCharacter}
        onSwitchCharacter={handleSwitchCharacter}
        activeView={activeView}
        onSwitchToCharacter={() => setActiveView("character")}
        onSwitchToDarkConspiracy={() => setActiveView("darkConspiracy")}
      />
    </div>
  );
};

export default CharacterSheet;
