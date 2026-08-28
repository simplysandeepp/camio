import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { streamUrls, statusUrl } from "@/lib/stream";
import CameraPlayer from "@/components/CameraPlayer";
import StatusPanel from "@/components/StatusPanel";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const multi = config.cameras.length > 1;

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">📹 Camio</div>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted">{session?.sub ?? "user"}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="camera-grid">
        {config.cameras.map((cam) => {
          const urls = streamUrls(cam.id);
          return (
            <section key={cam.id} className="camera-tile">
              {multi && <h2 className="camera-label">{cam.label}</h2>}
              <div className="stage">
                <CameraPlayer whep={urls.whep} hls={urls.hls} />
              </div>
              <div className="panel">
                <StatusPanel url={statusUrl(cam.id)} />
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
