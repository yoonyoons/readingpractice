/*
 * jose 대신: 체험판의 로그인 표시는 이 브라우저 안에만 있으므로 서명 없이 내용만 담는다.
 * (파일로 열면 WebCrypto를 못 쓰는 브라우저가 있어 진짜 서명은 쓰지 않는다)
 */
interface Claims {
  [key: string]: unknown;
  sub?: string;
  exp?: number;
}

export class SignJWT {
  private claims: Claims;
  constructor(payload: Claims) {
    this.claims = { ...payload };
  }
  setProtectedHeader() {
    return this;
  }
  setSubject(sub: string) {
    this.claims.sub = sub;
    return this;
  }
  setIssuedAt() {
    return this;
  }
  setExpirationTime(exp: number) {
    this.claims.exp = exp;
    return this;
  }
  async sign() {
    return encodeURIComponent(JSON.stringify(this.claims));
  }
}

export async function jwtVerify(token: string) {
  const payload = JSON.parse(decodeURIComponent(token)) as Claims;
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("expired");
  return { payload };
}
