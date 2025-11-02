import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode } = body;

    const correctPasscode = process.env.BIMAH_PASSCODE;

    if (!correctPasscode) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (passcode === correctPasscode) {
      // Set httpOnly cookie
      const cookieStore = await cookies();
      cookieStore.set("bimah_session", "ok", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
