/**
 * Scroll reveal done in CSS (scroll-driven animations), so content is never
 * hidden waiting for JavaScript. Browsers without support just show it.
 */
export default function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: React.ReactNode; delay?: number; as?: any; className?: string }) {
  const start = Math.round(delay / 25);
  return (
    <Tag className={`reveal ${className}`} style={delay ? ({ "--reveal-start": `${start}%`, "--reveal-end": `${35 + start}%` } as React.CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}
