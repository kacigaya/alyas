"use client";

import { useActionState } from "react";
import { login, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { ok: false, message: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle render={<h1 />}>Alyas</CardTitle>
        <CardDescription className="text-pretty">Sign in to manage your email aliases.</CardDescription>
      </CardHeader>
      <CardPanel>
        <form action={action} className="flex flex-col gap-4">
          <Field invalid={state.field === "password"}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              aria-describedby={state.message ? "login-message" : undefined}
              aria-invalid={state.field === "password" || undefined}
              autoComplete="current-password"
              autoFocus
              id="password"
              name="password"
              required
              type="password"
            />
            {state.message && <FieldError id="login-message">{state.message}</FieldError>}
          </Field>
          <Button loading={pending} type="submit">Sign in</Button>
          <p className="text-pretty text-muted-foreground text-xs">
            Five failed attempts lock login for 15 minutes.
          </p>
        </form>
      </CardPanel>
    </Card>
  );
}
