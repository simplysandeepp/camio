export default function Home() {
  return (
    <main className="center">
      <div className="card">
        <div className="brand">📹 Camio</div>
        <p className="muted">
          Self-hosted security camera. The live dashboard and login arrive in the
          next steps of the build.
        </p>
        <p className="muted">
          Health check:{" "}
          <a href="/api/health">/api/health</a>
        </p>
      </div>
    </main>
  );
}
