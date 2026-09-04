import { LogOutIcon } from "lucide-react";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { AliasForm } from "@/components/alias-form";
import { AliasList } from "@/components/alias-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getRoutingStatus, listDestinations, listRules } from "@/lib/cloudflare";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Keep the route blocking so the defense-in-depth session check completes
// before any account data is fetched or rendered.
export const instant = false;

export default async function Home() {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  const [rules, destinations, routing] = await Promise.all([listRules(), listDestinations(), getRoutingStatus()]);
  const domain = process.env.ALYAS_DOMAIN ?? "example.com";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center gap-3">
        {/* The wordmark below names the app, so the logo is decorative. */}
        <Image alt="" className="size-9 shrink-0 rounded-lg" height={36} priority src="/logo.svg" width={36} />
        <div className="min-w-0 flex-1">
          <h1 className="text-balance font-heading font-semibold text-xl">Alyas</h1>
          <p className="truncate font-mono text-muted-foreground text-xs">{domain}</p>
        </div>
        {/* Routing state is only worth surfacing when it would stop mail. */}
        {!(routing.enabled && routing.status === "ready") && (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 font-medium text-warning-foreground text-xs">
            {routing.enabled ? routing.status : "routing disabled"}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <ThemeToggle />
          <form action={logout}>
            <Button aria-label="Sign out" size="icon" type="submit" variant="ghost"><LogOutIcon aria-hidden="true" /></Button>
          </form>
        </div>
      </header>
      <AliasForm destinations={destinations.map((item) => item.email)} domain={domain} />
      <AliasList rules={rules} />
    </main>
  );
}
