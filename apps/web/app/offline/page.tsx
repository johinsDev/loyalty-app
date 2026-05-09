export const metadata = {
  title: "Sin conexión · Loyalty",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-600 text-3xl font-bold text-white">
        L
      </div>
      <h1 className="text-2xl font-semibold text-neutral-900">Sin conexión</h1>
      <p className="max-w-sm text-neutral-600">
        Parece que perdiste la conexión. Cuando vuelvas a estar online la app va
        a recargarse automáticamente.
      </p>
    </main>
  );
}
