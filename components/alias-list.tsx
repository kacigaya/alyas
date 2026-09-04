"use client";

import { CopyIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { deleteAlias, setAliasEnabled, type ActionState } from "@/app/actions";
import type { EmailRule } from "@/lib/cloudflare";
import {
  AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogPopup, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";

type OptimisticAction = { type: "toggle"; tag: string; enabled: boolean } | { type: "delete"; tag: string };
const actionInitial: ActionState = { ok: false, message: "" };

function address(rule: EmailRule): string {
  return rule.matchers.find((matcher) => matcher.field === "to")?.value ?? "Unknown address";
}

function destination(rule: EmailRule): string {
  return rule.actions.find((action) => action.type === "forward")?.value?.[0] ?? "No destination";
}

export function AliasList({ rules }: { rules: EmailRule[] }) {
  const [announcement, setAnnouncement] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EmailRule | null>(null);
  const [optimisticRules, updateOptimistic] = useOptimistic(rules, (current, action: OptimisticAction) => {
    if (action.type === "delete") return current.filter((rule) => rule.tag !== action.tag);
    return current.map((rule) => rule.tag === action.tag ? { ...rule, enabled: action.enabled } : rule);
  });

  function report(state: ActionState) {
    setAnnouncement(state.message);
    toastManager.add({ title: state.ok ? "Done" : "Request failed", description: state.message, type: state.ok ? "success" : "error" });
  }

  function toggle(rule: EmailRule, enabled: boolean) {
    startTransition(async () => {
      updateOptimistic({ type: "toggle", tag: rule.tag, enabled });
      const data = new FormData();
      data.set("tag", rule.tag);
      data.set("enabled", String(enabled));
      report(await setAliasEnabled(actionInitial, data));
    });
  }

  function remove(rule: EmailRule) {
    setDeleteTarget(null);
    startTransition(async () => {
      updateOptimistic({ type: "delete", tag: rule.tag });
      const data = new FormData();
      data.set("tag", rule.tag);
      report(await deleteAlias(actionInitial, data));
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      const message = `${value} copied.`;
      setAnnouncement(message);
      toastManager.add({ title: "Copied", description: value, type: "success" });
    } catch {
      setAnnouncement("Could not copy the address.");
      toastManager.add({ title: "Copy failed", description: "Select and copy the address manually.", type: "error" });
    }
  }

  return (
    <section aria-labelledby="aliases-heading" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-balance font-heading font-semibold text-lg" id="aliases-heading">Aliases</h2>
          <p className="text-pretty text-muted-foreground text-sm">Live Cloudflare Email Routing rules.</p>
        </div>
        <span className="font-mono text-muted-foreground text-xs tabular-nums">{optimisticRules.length}</span>
      </div>

      {optimisticRules.length === 0 ? (
        <Card className="items-center gap-2 p-8 text-center">
          <p className="font-medium">No aliases yet</p>
          <p className="text-pretty text-muted-foreground text-sm">Create one with the form above.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {optimisticRules.map((rule) => {
            const email = address(rule);
            return (
              <li key={rule.tag}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono font-medium text-sm" title={email}>{email}</p>
                      <p className="truncate text-muted-foreground text-xs" title={destination(rule)}>{rule.name || "Unlabeled"} · {destination(rule)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch aria-label={`${rule.enabled ? "Disable" : "Enable"} ${email}`} checked={rule.enabled} onCheckedChange={(checked) => toggle(rule, checked)} />
                      <Button aria-label={`Copy ${email}`} onClick={() => copy(email)} size="icon-sm" type="button" variant="ghost"><CopyIcon aria-hidden="true" /></Button>
                      <Menu>
                        <MenuTrigger aria-label={`More actions for ${email}`} render={<Button size="icon-sm" type="button" variant="ghost" />}><MoreHorizontalIcon aria-hidden="true" /></MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem closeOnClick onClick={() => setDeleteTarget(rule)} variant="destructive"><Trash2Icon aria-hidden="true" />Delete</MenuItem>
                        </MenuPopup>
                      </Menu>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">{announcement}</p>
      <AlertDialog onOpenChange={(open) => !open && setDeleteTarget(null)} open={Boolean(deleteTarget)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alias?</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">Mail sent to {deleteTarget ? address(deleteTarget) : "this address"} will stop forwarding. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" />}>Cancel</AlertDialogClose>
            <AlertDialogClose render={<Button type="button" variant="destructive" />} onClick={() => deleteTarget && remove(deleteTarget)}>Delete alias</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </section>
  );
}
