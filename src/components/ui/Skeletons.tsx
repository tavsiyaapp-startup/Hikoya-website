// Loading placeholders shaped like the page that is coming (styles:
// .skeleton in globals.css). Used by the loading.tsx files so a slow page
// shows its outline at once instead of a spinner.

function Bar({ className }: { className: string }) {
  return <div className={`skeleton rounded-full ${className}`} />;
}

export function CardRowSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden sm:gap-5.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[118px] shrink-0 xs:w-[138px] sm:w-[158px] lg:w-[172px]">
          <div className="skeleton mb-2.5 aspect-[3/4] rounded-[12px]" />
          <Bar className="mb-1.5 h-3 w-4/5" />
          <Bar className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Generic page: a heading, a line of text, a row of filters and two rows
// of story cards — close enough to most pages of the site.
export function PageSkeleton() {
  return (
    <div role="status" aria-busy className="py-2">
      <Bar className="mb-3 h-8 w-56" />
      <Bar className="mb-6 h-3.5 w-full max-w-120" />
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="flex flex-col gap-11">
        <CardRowSkeleton />
        <CardRowSkeleton />
      </div>
    </div>
  );
}

export function StorySkeleton() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-6 lg:flex-row lg:gap-9">
      <div className="w-full lg:w-75">
        <div className="skeleton mx-auto mb-4.5 aspect-[3/4] w-full max-w-60 rounded-[14px] sm:max-w-70 lg:max-w-none" />
        <Bar className="h-13 w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex gap-2">
          <Bar className="h-7 w-20" />
          <Bar className="h-7 w-16" />
        </div>
        <Bar className="mb-6 h-10 w-3/4" />
        <div className="skeleton mb-7 h-22 rounded-[18px]" />
        <Bar className="mb-2.5 h-4 w-full max-w-160" />
        <Bar className="mb-2.5 h-4 w-11/12 max-w-150" />
        <Bar className="mb-9 h-4 w-2/3 max-w-110" />
        <div className="skeleton h-64 rounded-[18px]" />
      </div>
    </div>
  );
}

export function TopicListSkeleton() {
  return (
    <div role="status" aria-busy className="mx-auto max-w-200">
      <Bar className="mb-3 h-9 w-52" />
      <Bar className="mb-7 h-3.5 w-full max-w-130" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-[14px] border border-border bg-card p-5">
            <div className="skeleton h-16 w-12 shrink-0 rounded-[12px]" />
            <div className="flex-1">
              <Bar className="mb-3 h-3 w-40" />
              <Bar className="mb-2.5 h-4.5 w-3/4" />
              <Bar className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
