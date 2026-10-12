import { redirect } from "next/navigation";

// Settings live on one page; this URL jumps to its section.
export default function Page() {
  redirect("/settings#notifications");
}
