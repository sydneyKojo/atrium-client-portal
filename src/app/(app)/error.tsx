"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="card empty" role="alert">
      <h3>This page didn&apos;t load</h3>
      <p>Something went wrong on our side. Your data is safe. Try again, and if it keeps happening, contact support{error.digest ? ` with reference ${error.digest}` : ""}.</p>
      <button className="btn" onClick={() => retry()}>Try again</button>
    </div>
  );
}
