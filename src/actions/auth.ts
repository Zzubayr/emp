"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestOtp, signOut, verifyOtp } from "@/lib/auth";

export async function requestCode(email: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return requestOtp(email, ip);
}

export async function verifyCode(email: string, code: string) {
  if (!/^\d{6}$/.test(code.trim())) return { ok: false as const, error: "Enter the 6-digit code." };
  return verifyOtp(email, code);
}

export async function signOutAction() {
  await signOut();
  redirect("/sign-in");
}
