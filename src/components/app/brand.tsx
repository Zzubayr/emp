import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "Presents", in the flyer's script with its underline. */
export function Presents({ children = "Presents", className }: { children?: ReactNode; className?: string }) {
  return <span className={cn("inline-block border-navy border-b-2 px-1 pb-0.5 font-script text-[40px] leading-none text-navy dark:border-white dark:text-white", className)}>{children}</span>;
}

/** The navy title box with the cyan outline and a hard offset shadow. */
export function TitleBox({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("brand-tag shadow-[5px_5px_10px_rgb(35_31_32/0.25)] dark:shadow-none", className)}>{children}</span>;
}

/** The thin navy-outlined info line under the flyer title. */
export function InfoBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("inline-flex border border-navy px-4 py-2.5 font-black text-navy dark:border-white/60 dark:text-white", className)}>{children}</div>;
}

export function DotList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5", className)}>
      {items.map((i) => <li className="flex items-center gap-2 font-medium text-[15px] text-navy dark:text-white" key={i}><span className="cyan-dot" />{i}</li>)}
    </ul>
  );
}

/** The navy footer bar from the flyer: socials and contact. */
export function SocialBar({ instagram, linkedin, email, className, children }: { instagram?: string; linkedin?: string; email?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("bg-navy text-white", className)}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-[15px] sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {instagram && <a className="flex items-center gap-2 hover:text-cyan" href={`https://instagram.com/${instagram}`} rel="noreferrer" target="_blank"><Image alt="Instagram" className="h-5 w-auto" height={26} src="/brand/instagram.svg" width={28} />{instagram}</a>}
          {linkedin && <a className="flex items-center gap-2 hover:text-cyan" href={`https://www.linkedin.com/company/${linkedin}`} rel="noreferrer" target="_blank"><Image alt="LinkedIn" className="h-5 w-auto" height={26} src="/brand/linkedin.svg" width={26} />{linkedin}</a>}
          {email && <a className="hover:text-cyan" href={`mailto:${email}`}>{email}</a>}
        </div>
        {children}
      </div>
    </div>
  );
}
