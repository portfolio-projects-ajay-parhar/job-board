import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const session = await getServerSession(authOptions);

  return (
    <HeaderNav
      session={
        session
          ? {
              name: session.user?.name ?? null,
              email: session.user?.email ?? null,
              role: session.user?.role,
            }
          : null
      }
    />
  );
}
