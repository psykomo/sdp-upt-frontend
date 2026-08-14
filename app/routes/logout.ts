import { redirect } from "react-router";
import { tokenCookie } from "../lib/session.server";

export async function action() {
  return redirect("/login", {
    headers: {
      "Set-Cookie": await tokenCookie.serialize("", { maxAge: 0 }),
    },
  });
}

export async function loader() {
  return redirect("/login", {
    headers: {
      "Set-Cookie": await tokenCookie.serialize("", { maxAge: 0 }),
    },
  });
}
