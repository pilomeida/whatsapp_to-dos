import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/reset", "/api/whatsapp", "/api/auth", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("auth")?.value;
  if (auth !== process.env.APP_SECRET) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
