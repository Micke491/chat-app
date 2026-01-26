import { io } from "socket.io-client";

export const getSocket = (token?: string) => {
  const socket = io(process.env.NEXT_PUBLIC_SITE_URL!, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    auth: token ? { token } : undefined,
  });
  return socket;
};