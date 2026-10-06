type BookClubSocket = {
  readyState: number;
  send: (message: string) => void;
};

const socketsByUser = new Map<string, Set<BookClubSocket>>();
const maxSocketsPerUser = 5;

export const registerBookClubSocket = (userId: string, socket: BookClubSocket) => {
  const sockets = socketsByUser.get(userId) ?? new Set<BookClubSocket>();
  if (sockets.size >= maxSocketsPerUser) return undefined;
  sockets.add(socket);
  socketsByUser.set(userId, sockets);

  return () => {
    sockets.delete(socket);
    if (!sockets.size) socketsByUser.delete(userId);
  };
};

export const notifyBookClubUsers = (userIds: Iterable<string>) => {
  notifyBookClubUsersWithMessage(userIds, { type: "book-clubs-updated" });
};

export const notifyBookClubUsersWithMessage = (
  userIds: Iterable<string>,
  payload: Record<string, unknown>,
) => {
  const message = JSON.stringify(payload);
  for (const userId of new Set(userIds)) {
    const sockets = socketsByUser.get(userId);
    if (!sockets) continue;
    for (const socket of sockets) {
      if (socket.readyState !== 1) {
        sockets.delete(socket);
        continue;
      }
      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
      }
    }
    if (!sockets.size) socketsByUser.delete(userId);
  }
};
