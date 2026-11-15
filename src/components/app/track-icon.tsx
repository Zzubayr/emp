import { BookOpen, Briefcase, Camera, Code, FlaskConical, GraduationCap, HeartHandshake, Leaf, Palette, Rocket, Sparkles, Users, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = { GraduationCap, BookOpen, Code, Palette, HeartHandshake, Briefcase, Rocket, Users, FlaskConical, Camera, Leaf, Sparkles };

export function TrackIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? GraduationCap;
  return <Icon className={className} />;
}
