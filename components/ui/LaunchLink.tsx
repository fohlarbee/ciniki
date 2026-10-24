"use client";

import Link, { useLinkStatus } from "next/link";

function Content({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending && <span className="btn-spinner" aria-hidden="true" />}
      {children}
      {pending && <span className="sr-only">Loading</span>}
    </>
  );
}

/** Link styled as a button that shows a spinner while the next page loads. */
export default function LaunchLink({ href = "/app", className = "btn btn-primary", children }: { href?: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className}>
      <Content>{children}</Content>
    </Link>
  );
}
