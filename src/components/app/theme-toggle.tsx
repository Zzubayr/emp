"use client";

import { useMounted } from "@/components/app/use-mounted";
import { useTheme } from "next-themes";
import SwitchButton from "@/components/kokonutui/switch-button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return <span className="size-8" />;
  return <SwitchButton onThemeChange={setTheme} size="sm" theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}
