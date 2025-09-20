import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: "firefly-iii-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

// For Next.js App Router
export const getSession = () => {
    return getIronSession(cookies(), sessionOptions);
}
