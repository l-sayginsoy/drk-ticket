/**
 * Inline-SVG für E-Mail-Ticket-Balken: gleiche Punkt-Logik wie `ModernDashboard` Desktop-Hero
 * (`hero-halftone` — 12 Zeilen, wachsende Spaltenzahl, Kreisradius steigt nach rechts).
 */
export function buildDrkEmailHeroHalftoneSvg(): string {
  const W = 580;
  const H = 278;
  const rowCount = 12;
  /** Unten ausrichten, horizontal mittig — entspricht dem Hero (Punkte wachsen von unten/rechts) */
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="260" height="108" preserveAspectRatio="xMidYMax meet" style="display:block;margin:0 auto;">`,
  ];
  for (let r = 0; r < rowCount; r++) {
    const numColsForThisRow = Math.floor(6 + r * 2.2);
    for (let c = 0; c < numColsForThisRow; c++) {
      const processLeftToRight = (numColsForThisRow - 1 - c) / (numColsForThisRow - 1);
      const radius = 1.2 + Math.pow(processLeftToRight, 1.2) * 5.0;
      const cx = W + 10 - c * 22;
      const cy = 24 + r * 22;
      parts.push(
        `<circle cx="${cx.toFixed(2)}" cy="${cy}" r="${radius.toFixed(2)}" fill="#ffffff" fill-opacity="0.12"/>`,
      );
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
