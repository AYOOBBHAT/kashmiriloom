import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/cookie";

/**
 * Sends visitors without a session cookie to the sign-in page before the dashboard renders.
 * A cookie is not proof of an administrator. Pages and server actions still check the sealed session.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }
  if (!request.cookies.get(ADMIN_COOKIE_NAME)?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
