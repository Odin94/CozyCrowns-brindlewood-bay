import { MavenPersistence } from "./maven_persistence";
import { accountScope } from "./account_scope";
import { useCharacterStore } from "./character_store";
import { api } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";

export const mavenPersistence = new MavenPersistence({
  scope: accountScope.current,
  storage: localStorage,
  record: (id) => useCharacterStore.getState().record(id),
  claim: (id, ownerId) => useCharacterStore.getState().claimOwner(id, ownerId),
  acknowledge: (localId, result, ownerId, submittedContent) =>
    useCharacterStore
      .getState()
      .updateRemoteVersion(localId, result.id, result.version, ownerId, submittedContent),
  merge: (records, ownerId) =>
    useCharacterStore
      .getState()
      .mergeRemote(records, ownerId, (record) => mavenPersistence.canReplace(record)),
  list: api.getCharacters,
  create: api.createCharacter,
  update: api.updateCharacter,
  failed: (error) => {
    console.error("Failed to save character:", error);
    if ((error as Error & { status?: number }).status === 409)
      toast.error(t`This Maven changed elsewhere. Your edits are still here.`, {
        action: { label: t`Reload`, onClick: () => window.location.reload() },
      });
  },
});
