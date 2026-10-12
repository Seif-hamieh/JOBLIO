import { redirect } from "next/navigation";

// /people → the unified search (people come first there).
export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const q = (await searchParams).q;
  redirect(`/search${typeof q === "string" && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
}
