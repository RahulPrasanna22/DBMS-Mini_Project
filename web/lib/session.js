import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "session";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null; // bad signature or expired
  }
}