import { createCharacterCoordinator } from "./character_sync";
import { useCharacterStore } from "./character_store";
import { accountScope } from "./account_scope";
import { api, tokenStorage } from "../utils/api";
export const characterCoordinator = createCharacterCoordinator({
  storage: localStorage,
  sessionKey: tokenStorage.sessionKey,
  record: (localId) => useCharacterStore.getState().record(localId),
  creationId: (localId) => useCharacterStore.getState().ensureCreationId(localId),
  acknowledge: (localId, id, version, content) =>
    useCharacterStore
      .getState()
      .updateRemoteVersion(
        localId,
        id,
        version,
        accountScope.current().accountId ?? undefined,
        content,
      ),
  remove: (localId) => useCharacterStore.getState().remove(localId),
  create: api.createCharacter,
  update: api.updateCharacter,
  delete: api.deleteCharacter,
});
