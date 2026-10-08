import { redirect } from "next/navigation";
import { requireViewer } from "@/server/session";

export default async function ProfileIndex() {
  const viewer = await requireViewer();
  redirect(`/in/${viewer.username}`);
}
