(() => {
  const bands = ["20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"];
  // Compare the midpoint of each target period with the midpoint of 2024.
  const yearsFrom2024 = {"2024":0, "2025":1, "2026-h1":1.75};
  // China Labour Statistical Yearbook 2024, 1-50, and 2025, 2-18 (urban survey, both sexes).
  const urbanShares2023 = [5.5,10.2,14.3,15.4,13.2,12.4,12.4,8.8,3.3,3.8];
  const urbanShares2024 = [5.52350,9.83692,13.07274,16.20881,13.27927,12.29808,12.40185,9.04644,3.88378,3.70111];
  const project = (previous,current,offset) => current+(current-previous)*offset;
  const mainland = Object.fromEntries(Object.entries(yearsFrom2024).map(([period,offset])=>
    [period,urbanShares2024.map((share,index)=>project(urbanShares2023[index],share,offset))]));

  const sumCounts = (first,second) => first.map((count,index)=>count+second[index]);
  // C&SD 210-06301: total employment followed by the displayed age bands, both sexes.
  const hkAgeCounts = {
    "2024":[3693.6,140.7,334.5,433.1,469.2,487.2,447.4,443.3,388.7,309.4,222.3],
    "2025":[3672,129,320,428.1,472,498.4,456.6,442.9,379.7,302.7,226.4],
    "2026-h1":sumCounts(
      [3655.7,118.6,306.6,425.8,474.3,499.7,463,439.1,383.1,298,232.4],
      [3646.1,117.8,300.1,420.6,471.3,498.9,464.4,439.6,385.3,296.3,237.6],
    ),
  };
  const hongKong = Object.fromEntries(Object.entries(hkAgeCounts).map(([period,[total,...counts]])=>
    [period,counts.map(count=>count/total*100)]));

  // C&SD 210-06306: [all employed, age 25–39, age 40+] in thousands, both sexes.
  // For splits, C&SD 210-06305 supplies the detailed sector totals in the same period.
  const hkIndustry = {
    "2024":{
      manufacturing:[86.5,18.6,66.3], construction:[351.6,108.6,230.3], importWholesale:[296.5,71.3,220.1],
      retailFood:[513.7,148.3,322.1], transportInfo:[421.7,135.4,270.3], finance:[849.6,287.4,533.7],
      publicServices:[1149.5,460.2,638.5], other:[24.6,6.9,17.1], retail:251.5, food:262.1, transport:290.9, info:130.9,
    },
    "2025":{
      manufacturing:[88.3,18.8,67.3], construction:[338.1,102.5,227.1], importWholesale:[282.6,66.8,211.3],
      retailFood:[493.6,138.5,316.8], transportInfo:[418.5,130.7,272.8], finance:[860,290.5,545.6],
      publicServices:[1164.9,464,648.7], other:[26.1,8.3,17.1], retail:236.1, food:257.6, transport:287.7, info:130.8,
    },
    "2026-q1":{
      manufacturing:[86.3,20.1,64.7], construction:[328.3,100.1,221], importWholesale:[279.3,59.9,214.8],
      retailFood:[489.3,135.6,318.4], transportInfo:[409.5,136.3,259.9], finance:[861.8,288.2,551.7],
      publicServices:[1176.9,458.9,669.1], other:[24.2,7.7,15.7], retail:231.2, food:258.1, transport:280.9, info:128.6,
    },
    "2026-q2":{
      manufacturing:[87.1,19.7,65.3], construction:[324.6,96,220], importWholesale:[282.2,60.2,218.6],
      retailFood:[490.2,136.5,319.5], transportInfo:[407.3,135,260.5], finance:[863.9,280.6,557.1],
      publicServices:[1169.1,458,665.9], other:[21.7,6.1,15.2], retail:226.7, food:263.5, transport:280.6, info:126.8,
    },
  };
  const ratio = ([total,older]) => older/total*100;
  // Keep the weighted share of each pair at the estimated broad-group share.
  function splitShare(groupShare,firstTotal,secondTotal,gap) {
    const first = groupShare+gap*secondTotal/(firstTotal+secondTotal);
    return [first,first-gap];
  }
  const half1 = hkIndustry["2026-q1"], half2 = hkIndustry["2026-q2"];
  const industryPeriods = {"2024":hkIndustry["2024"],"2025":hkIndustry["2025"],
    "2026-h1":Object.fromEntries(Object.entries(half1).map(([key,counts])=>
      [key,Array.isArray(counts) ? sumCounts(counts,half2[key]) : counts+half2[key]]))};
  const hongKongIndustry = Object.fromEntries(Object.entries(industryPeriods).map(([period,group])=>{
    // Allocate each industry's 25–39 group using the share aged 35–39 in the same period citywide.
    const [, ,age25to29,age30to34,age35to39] = hkAgeCounts[period];
    const fraction35to39 = age35to39/(age25to29+age30to34+age35to39);
    const counts35Plus = ([total,age25to39,age40Plus])=>[total,age40Plus+age25to39*fraction35to39];
    const share35Plus = counts=>ratio(counts35Plus(counts));
    const [retail,food] = splitShare(share35Plus(group.retailFood),group.retail,group.food,75.41-70.12);
    const [transport,info] = splitShare(share35Plus(group.transportInfo),group.transport,group.info,81.35-61.43);
    const [importWholesaleTotal,importWholesale35] = counts35Plus(group.importWholesale);
    const trade = (importWholesale35*100+retail*group.retail)/(importWholesaleTotal+group.retail);
    return [period,{
      manufacturing:share35Plus(group.manufacturing), construction:share35Plus(group.construction), trade, transport, food, info,
      finance:share35Plus(group.finance), publicServices:share35Plus(group.publicServices), other:share35Plus(group.other),
    }];
  }));

  // Mainland 35+ shares for 2023 and 2024. Combined sectors are weighted by the
  // all-ages employment shares from tables 1-49 (2024 yearbook) and 2-17 (2025 yearbook).
  const industryRows = [
    {id:"制造业", name:["制造业","Manufacturing"], key:"manufacturing", shares:[69.3,71.03559]},
    {id:"建筑业", name:["建筑业","Construction"], key:"construction", shares:[76.3,78.44003]},
    {id:"批发零售/进出口", name:["批发零售／进出口","Wholesale, retail and import/export"], key:"trade", shares:[69.3,70.88182]},
    {id:"运输仓储邮政", name:["运输仓储邮政","Transport, storage and postal services"], key:"transport", shares:[71.2,72.44818]},
    {id:"住宿餐饮", name:["住宿餐饮","Accommodation and food services"], key:"food", shares:[66.5,67.52699]},
    {id:"信息通讯", name:["信息通讯","Information and communications"], key:"info", shares:[42.4,45.39661]},
    {id:"金融地产商务", name:["金融地产商务","Finance, real estate and business services"], key:"finance", shares:[61.60109,64.05971]},
    {id:"公共教育医疗社会个人服务", name:["公共、教育、医疗及社会服务","Public, education, health and social services"], key:"publicServices", shares:[63.74028,64.95824]},
    {id:"其他（农林采矿/公用事业/国际组织）", name:["其他（农林、公用等）","Other industries"], key:"other", shares:[87.68532,88.74757]},
  ];
  const industries = industryRows.map(({id,name,key,shares})=>({
    id, name,
    mainland:Object.fromEntries(Object.entries(yearsFrom2024).map(([period,offset])=>[period,project(...shares,offset)])),
    hongKong:Object.fromEntries(Object.entries(hongKongIndustry).map(([period,shares])=>[period,shares[key]])),
  }));

  globalThis.workforceAge = {bands,mainland,hongKong,industries};
})();
