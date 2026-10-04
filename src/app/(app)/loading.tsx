// Shown while a page's data loads.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid">
      <div className="skeleton" style={{ height: 30, width: 280 }} />
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      </div>
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
