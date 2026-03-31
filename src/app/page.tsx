import { redirect } from "next/navigation";
import { getAdminUserOrNull } from "@/lib/auth/require-admin";

export default async function HomePage() {
  const adminUser = await getAdminUserOrNull();

  if (adminUser) {
    redirect("/dashboard");
  }

  redirect("/login");
}
