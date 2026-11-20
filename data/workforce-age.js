/* Shares of all employed persons, both sexes. Age bands shown start at 20.
 * Mainland: China Labour Statistical Yearbook 2025, table 2-10 (2024 survey).
 * Hong Kong: C&SD table 210-06301, annual 2024 and 2025, moving 3 months ending September 2026.
 */
globalThis.workforceAge = {
  bands: ["20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"],
  mainland2024: [4.99045, 8.66748, 11.48145, 14.04, 11.60232, 11.25597, 12.59534, 10.67934, 5.87342, 7.97067],
  hongKong: {
    "2024": [3.8, 9.1, 11.7, 12.7, 13.2, 12.1, 12.0, 10.5, 8.4, 6.0],
    "2025": [3.5, 8.7, 11.7, 12.9, 13.6, 12.4, 12.1, 10.3, 8.2, 6.2],
    "2026-q3": [3.1, 8.2, 11.5, 12.8, 13.8, 12.8, 12.2, 10.6, 8.2, 6.5],
  },
};
