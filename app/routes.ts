import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  layout("routes/app-layout.tsx", [
    route("identitas", "routes/identitas.tsx"),
    route("identitas/export", "routes/identitas-export.ts"),
    route("identitas/:nomorInduk/ubah", "routes/identitas-ubah.tsx"),
    route("identitas/:nomorInduk/hapus", "routes/identitas-hapus.tsx"),
    route("identitas/:nomorInduk", "routes/identitas-detail.tsx"),
  ]),
  route("auth/legacy", "routes/auth-legacy.ts"),
] satisfies RouteConfig;
