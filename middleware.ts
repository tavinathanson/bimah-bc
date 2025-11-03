import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to /enter page and /enter/api endpoint
  if (pathname === "/enter" || pathname.startsWith("/enter/")) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("bimah_session");

  if (!session || session.value !== "ok") {
    // Redirect to enter page
    return NextResponse.redirect(new URL("/enter", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
