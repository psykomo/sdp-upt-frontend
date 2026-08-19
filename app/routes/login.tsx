import { Form, data, redirect, useNavigation } from "react-router";
import { apiLogin, hasSession } from "../lib/session";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Masuk — SDP" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  if (await hasSession(request)) throw redirect("/identitas");
  const url = new URL(request.url);
  return { returnTo: url.searchParams.get("return") ?? "/identitas" };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const returnTo = String(form.get("return") ?? "/identitas");

  try {
    await apiLogin(username, password, request);
    const dest = returnTo.startsWith("/") ? returnTo : "/identitas";
    return redirect(dest);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    return data(
      { error: error.message || "Login gagal." },
      { status: 401 },
    );
  }
}

export default function LoginPage({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const error = actionData?.error;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">SDP</span>
          <span className="login-brand-copy">
            <strong>Sistem Database</strong>
            <span>Pemasyarakatan · SDP 4.0</span>
          </span>
        </div>

        <h1>Masuk ke SDP 4.0</h1>
        <p className="login-intro">
          Gunakan akun yang sama dengan aplikasi lama. Sesi ini menerbitkan JWT
          untuk API dan frontend baru.
        </p>

        {error ? (
          <p className="login-error">{error}</p>
        ) : null}

        <Form method="post" className="login-form">
          <input type="hidden" name="return" value={loaderData.returnTo} />
          <label className="login-field">
            Username
            <input
              name="username"
              autoComplete="username"
              required
            />
          </label>
          <label className="login-field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="primary-button login-submit" disabled={submitting}>
            {submitting ? "Masuk…" : "Masuk"}
          </button>
        </Form>
      </section>
    </main>
  );
}
