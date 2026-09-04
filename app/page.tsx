import { AtSignIcon, LogOutIcon } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { AliasForm } from "@/components/alias-form";
import { AliasList } from "@/components/alias-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getRoutingStatus, listDestinations, listRules } from "@/lib/cloudflare";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export default async function Home() {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  const [rules, destinations, routing] = await Promise.all([listRules(), listDestinations(), getRoutingStatus()]);
  const domain = process.env.ALYAS_DOMAIN ?? "example.com";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center gap-3">
        <div aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card"><AtSignIcon /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance font-heading font-semibold text-xl">Alyas</h1>
          <p className="truncate font-mono text-muted-foreground text-xs">{domain}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 font-medium text-xs ${routing.enabled && routing.status === "ready" ? "border-success/30 bg-success/10 text-success-foreground" : "border-warning/30 bg-warning/10 text-warning-foreground"}`}>
          {routing.enabled ? routing.status : "disabled"}
        </span>
        <ThemeToggle />
        <form action={logout}>
          <Button aria-label="Sign out" size="icon" type="submit" variant="ghost"><LogOutIcon aria-hidden="true" /></Button>
        </form>
      </header>
      <AliasForm destinations={destinations.map((item) => item.email)} domain={domain} />
      <AliasList rules={rules} />
    </main>
  );
}
