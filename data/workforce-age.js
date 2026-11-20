/* Shares of all employed persons, both sexes. Age bands shown start at 20.
 * Mainland: China Labour Statistical Yearbook 2025, table 2-10 (2024 survey).
 * Hong Kong: C&SD table 210-06301, annual 2024 and 2025, moving 3 months ending June 2026.
 */
globalThis.workforceAge = {
  bands: ["20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"],
  mainland2024: [4.99045, 8.66748, 11.48145, 14.04, 11.60232, 11.25597, 12.59534, 10.67934, 5.87342, 7.97067],
  hongKong: {
    "2024": [3.8, 9.1, 11.7, 12.7, 13.2, 12.1, 12.0, 10.5, 8.4, 6.0],
    "2025": [3.5, 8.7, 11.7, 12.9, 13.6, 12.4, 12.1, 10.3, 8.2, 6.2],
    "2026-q2": [3.2, 8.2, 11.5, 12.9, 13.7, 12.7, 12.1, 10.6, 8.1, 6.5],
  },
  // Mainland 40+ shares use table 2-18 (2024 urban survey), weighted by sector
  // employment shares in table 2-17 where sectors are combined.
  // C&SD 210-06306 counts are [all ages, age 40+] in thousands, both sexes.
  industries: [
    {id:"制造业", name:["制造业","Manufacturing"], mainland:52.76575,
      hongKong:{"2024":[86.5,66.3],"2025":[88.3,67.3],"2026-q2":[87.1,65.3]}},
    {id:"建筑业", name:["建筑业","Construction"], mainland:62.85646,
      hongKong:{"2024":[351.6,230.3],"2025":[338.1,227.1],"2026-q2":[324.6,220]}},
    // Mainland wholesale and retail are reported together. Combine both Hong Kong trade groups.
    {id:"批发零售住宿餐饮", name:["进出口、批发零售及住宿餐饮","Trade, retail, accommodation and food"], mainland:52.96507,
      hongKong:{"2024":[810.2,542.2],"2025":[776.2,528.1],"2026-q2":[772.4,538.1]}},
    {id:"运输及信息通讯", name:["运输、邮政及信息通讯","Transport, postal and communications"], mainland:46.36851,
      hongKong:{"2024":[421.7,270.3],"2025":[418.5,272.8],"2026-q2":[407.3,260.5]}},
    // Mainland finance, real estate, leasing/business and scientific/technical services.
    {id:"金融地产商务", name:["金融、保险、地产及专业商务","Finance, real estate and professional services"], mainland:45.40463,
      hongKong:{"2024":[849.6,533.7],"2025":[860,545.6],"2026-q2":[863.9,557.1]}},
    // Mainland household/repair services, education, health/social work, culture and public administration.
    {id:"公共教育医疗社会个人服务", name:["公共行政、社会及个人服务","Public administration, social and personal services"], mainland:49.14250,
      hongKong:{"2024":[1149.5,638.5],"2025":[1164.9,648.7],"2026-q2":[1169.1,665.9]}},
  ],
};
