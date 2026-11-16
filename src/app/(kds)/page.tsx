import { env } from "@/lib/env";

export default function KdsHomePage() {
  return (
    <section className="p-6">
      <h1 className="text-xl font-semibold">Kitchen Display System</h1>
      <p className="mt-2 text-sm opacity-75">API: {env.apiBaseUrl}</p>
    </section>
  );
}

