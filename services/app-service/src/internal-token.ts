import crypto from "crypto";

export interface InternalClaims {
  userId: string;
  email?: string;
}

export function signInternalToken(claims: InternalClaims, secret: string): string {
  const payload = {
    sub: claims.userId,
    email: claims.email,
    iat: Date.now(),
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
