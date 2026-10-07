// A placeholder shown while content loads. Give it the same size as the final content,
// so the layout does not move when the content arrives. The pulse stops for users who
// prefer reduced motion (see globals.css).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-raised ${className}`} />;
}
