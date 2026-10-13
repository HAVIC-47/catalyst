// Session cookie attributes shared by the browser client, server client and proxy.
// Secure in production so the auth cookie is never sent over plain HTTP.
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
