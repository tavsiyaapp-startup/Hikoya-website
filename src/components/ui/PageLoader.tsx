export function PageLoader() {
  return (
    <div className="flex min-h-100 w-full items-center justify-center py-20">
      <div
        role="status"
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700"
      />
    </div>
  );
}
