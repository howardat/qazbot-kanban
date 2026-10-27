// Shown instantly while the next page loads on the server, so a click never looks ignored.
export default function Loading() {
  return (
    <main aria-busy="true" className="animate-pulse">
      <div className="border-b px-4 py-4 md:px-6">
        <div className="h-6 w-48 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-72 max-w-full rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-40 rounded-lg border bg-muted/40" />
        ))}
      </div>
    </main>
  );
}
