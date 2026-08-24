export function AdminHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-5 border-b border-border bg-white px-8.5 py-5.5">
      <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
    </div>
  );
}
