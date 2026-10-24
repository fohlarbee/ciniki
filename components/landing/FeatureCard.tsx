"use client";

import Icon, { type IconName } from "../ui/Icon";

/** Feature card with a glow that follows the cursor. */
export default function FeatureCard({ icon, title, body, example }: { icon: IconName; title: string; body: string; example: string }) {
  return (
    <article
      className="f-card"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      <span className="f-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="f-example">
        <Icon name="chat" size={14} /> “{example}”
      </span>
    </article>
  );
}
