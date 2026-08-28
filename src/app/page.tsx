import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Middleware guarantees a valid session here, but read it for the greeting.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  return (
    <main className="center">
      <div className="card">
        <div className="row">
          <div className="brand">📹 Camio</div>
          <LogoutButton />
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Signed in as <strong>{session?.sub ?? "user"}</strong>.
        </p>
        <p className="muted">
          The live camera dashboard is added in the next step. The camera
          pipeline runs via <code>npm run camera</code>.
        </p>
      </div>
    </main>
  );
}
