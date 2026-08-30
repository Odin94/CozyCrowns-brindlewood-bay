type BookClubSocket = {
  readyState: number;
  send: (message: string) => void;
};

const socketsByUser = new Map<string, Set<BookClubSocket>>();

export const registerBookClubSocket = (userId: string, socket: BookClubSocket) => {
  const sockets = socketsByUser.get(userId) ?? new Set<BookClubSocket>();
  sockets.add(socket);
  socketsByUser.set(userId, sockets);

  return () => {
    sockets.delete(socket);
    if (!sockets.size) socketsByUser.delete(userId);
  };
};

export const notifyBookClubUsers = (userIds: Iterable<string>) => {
  const message = JSON.stringify({ type: "book-clubs-updated" });
  for (const userId of new Set(userIds)) {
    for (const socket of socketsByUser.get(userId) ?? []) {
      if (socket.readyState === 1) socket.send(message);
    }
  }
};
