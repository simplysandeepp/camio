import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { streamUrls } from "@/lib/stream";
import CameraPlayer from "@/components/CameraPlayer";
import StatusPanel from "@/components/StatusPanel";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const urls = streamUrls();

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">📹 Camio</div>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted">{session?.sub ?? "user"}</span>
          <LogoutButton />
        </div>
      </header>

      <section className="stage">
        <CameraPlayer whep={urls.whep} hls={urls.hls} />
      </section>

      <section className="panel">
        <StatusPanel />
      </section>
    </main>
  );
}
