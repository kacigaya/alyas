"use client";

import { RefreshCwIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { createAlias, type ActionState } from "@/app/actions";
import { generate, type GeneratorMode } from "@/lib/alias";
import { cn } from "@/lib/cn";
import { segmentedControlItemVariants, segmentedControlRootClassName } from "@/lib/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroupPrimitive, RadioPrimitive } from "@/components/ui/radio-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";

const initialState: ActionState = { ok: false, message: "" };
const modes: Array<{ value: GeneratorMode; label: string }> = [
  { value: "words", label: "Words" },
  { value: "hex", label: "Hex" },
  { value: "custom", label: "Custom" },
];

export function AliasForm({ destinations, domain }: { destinations: string[]; domain: string }) {
  const [mode, setMode] = useState<GeneratorMode>("words");
  const [localPart, setLocalPart] = useState(() => generate("words"));
  const [state, action, pending] = useActionState(async (previous: ActionState, data: FormData) => {
    const next = await createAlias(previous, data);
    if (next.ok) setLocalPart(generate(mode));
    return next;
  }, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const previousMessage = useRef("");

  useEffect(() => {
    if (!state.message || state.message === previousMessage.current) return;
    previousMessage.current = state.message;
    toastManager.add({ title: state.ok ? "Alias created" : "Could not create alias", description: state.message, type: state.ok ? "success" : "error" });
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [mode, state]);

  function selectMode(value: GeneratorMode) {
    setMode(value);
    setLocalPart(generate(value));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle render={<h2 />}>Create alias</CardTitle>
        <CardDescription className="text-pretty">Forward a new address without storing anything locally.</CardDescription>
      </CardHeader>
      <CardPanel>
        <form action={action} className="flex flex-col gap-5" ref={formRef}>
          <div className="flex flex-col gap-2">
            {/* The radio group is the labelled group, so the caption is a plain
                span: a fieldset here would announce a second nested group. */}
            <span className="font-medium text-sm" id="mode-label">Address type</span>
            {/* Base UI radio primitives, not the dotted Radio wrapper: a
                segmented control renders its own label and no radio indicator. */}
            <RadioGroupPrimitive
              aria-labelledby="mode-label"
              className={segmentedControlRootClassName}
              onValueChange={(value) => selectMode(value as GeneratorMode)}
              value={mode}
            >
              {modes.map((item) => (
                <RadioPrimitive.Root
                  // The recipe rests at text-muted-foreground/72, which is 3.8:1
                  // on this surface. Full opacity clears WCAG AA for 14px text.
                  className={cn(segmentedControlItemVariants({ state: "checked" }), "text-muted-foreground")}
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </RadioPrimitive.Root>
              ))}
            </RadioGroupPrimitive>
          </div>

          <Field invalid={state.field === "localPart"}>
            <FieldLabel htmlFor="localPart">Local-part</FieldLabel>
            <div className="flex w-full items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/24">
                <Input
                  aria-describedby={state.field === "localPart" ? "localPart-error" : undefined}
                  aria-invalid={state.field === "localPart" || undefined}
                  className="min-w-0 flex-1 border-0 bg-transparent shadow-none before:hidden has-focus-visible:ring-0"
                  id="localPart"
                  maxLength={64}
                  name="localPart"
                  onChange={(event) => setLocalPart(event.target.value)}
                  pattern="[a-z0-9]+(?:[._-][a-z0-9]+)*"
                  required
                  type="text"
                  value={localPart}
                />
                <span className="shrink-0 pe-3 font-mono text-muted-foreground text-xs">@{domain}</span>
              </div>
              {mode !== "custom" && (
                <Button aria-label="Generate another alias" onClick={() => setLocalPart(generate(mode))} size="icon" type="button" variant="outline">
                  <RefreshCwIcon aria-hidden="true" />
                </Button>
              )}
            </div>
            {state.field === "localPart" && <FieldError id="localPart-error">{state.message}</FieldError>}
          </Field>

          <Field invalid={state.field === "destination"}>
            <FieldLabel htmlFor="destination">Destination</FieldLabel>
            <Select defaultValue={destinations[0]} items={Object.fromEntries(destinations.map((email) => [email, email]))} name="destination" required>
              <SelectTrigger aria-describedby={state.field === "destination" ? "destination-error" : undefined} aria-invalid={state.field === "destination" || undefined} id="destination">
                <SelectValue placeholder="Choose a verified address" />
              </SelectTrigger>
              <SelectPopup>
                {destinations.map((email) => <SelectItem key={email} value={email}>{email}</SelectItem>)}
              </SelectPopup>
            </Select>
            {state.field === "destination" && <FieldError id="destination-error">{state.message}</FieldError>}
          </Field>

          <Field invalid={state.field === "label"}>
            <FieldLabel htmlFor="label">Label <span className="font-normal text-muted-foreground">Optional</span></FieldLabel>
            <Input aria-describedby={state.field === "label" ? "label-error" : undefined} aria-invalid={state.field === "label" || undefined} id="label" maxLength={100} name="label" placeholder="Where you used it" type="text" />
            {state.field === "label" && <FieldError id="label-error">{state.message}</FieldError>}
          </Field>

          {!state.ok && state.message && !state.field && <p className="text-destructive-foreground text-sm">{state.message}</p>}
          <Button disabled={destinations.length === 0} loading={pending} type="submit">Create alias</Button>
          {destinations.length === 0 && <p className="text-pretty text-muted-foreground text-xs">No verified Cloudflare destinations are available.</p>}
          <p aria-live="polite" className="sr-only">{state.message}</p>
        </form>
      </CardPanel>
    </Card>
  );
}
