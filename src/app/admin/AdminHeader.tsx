export function AdminHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-5 border-b border-border bg-white px-4 py-5.5 sm:px-8.5">
      <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">{title}</h1>
    </div>
  );
}
