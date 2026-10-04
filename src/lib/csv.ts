// RFC 4180 CSV. Cells starting with = + - @ are prefixed with ' so spreadsheets don't run them as formulas.
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Plain numbers and phone numbers (e.g. +233 30 123 4567, -42.5) are safe and left as they are.
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d][\d\s().-]*$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
