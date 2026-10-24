"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import LaunchLink from "../ui/LaunchLink";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export default function Nav({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`l-nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="l-nav-inner">
        <Link href="/" className="logo" onClick={() => setOpen(false)}>
          <span className="logo-mark">
            <Icon name="logo" />
          </span>
          {name}
        </Link>
        <nav className="l-links" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="l-nav-end">
          <LaunchLink className="btn btn-primary btn-sm l-launch">Launch app</LaunchLink>
          <button className="btn btn-icon l-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      <div className="l-sheet">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <LaunchLink className="btn btn-primary btn-lg">Launch app</LaunchLink>
      </div>
    </header>
  );
}
