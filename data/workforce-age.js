(() => {
  const bands = ["20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"];
  // Compare the midpoint of each target period with the midpoint of 2024.
  const yearsFrom2024 = {"2024":0, "2025":1, "2026-q2":1.875};
  // China Labour Statistical Yearbook 2024, 1-50, and 2025, 2-18 (urban survey, both sexes).
  const urbanShares2023 = [5.5,10.2,14.3,15.4,13.2,12.4,12.4,8.8,3.3,3.8];
  const urbanShares2024 = [5.52350,9.83692,13.07274,16.20881,13.27927,12.29808,12.40185,9.04644,3.88378,3.70111];
  const project = (previous,current,offset) => current+(current-previous)*offset;
  const mainland = Object.fromEntries(Object.entries(yearsFrom2024).map(([period,offset])=>
    [period,urbanShares2024.map((share,index)=>project(urbanShares2023[index],share,offset))]));

  // C&SD 210-06301, published shares of all employed persons, both sexes.
  const hongKong = {
    "2024":[3.8,9.1,11.7,12.7,13.2,12.1,12.0,10.5,8.4,6.0],
    "2025":[3.5,8.7,11.7,12.9,13.6,12.4,12.1,10.3,8.2,6.2],
    "2026-q2":[3.2,8.2,11.5,12.9,13.7,12.7,12.1,10.6,8.1,6.5],
  };

  // C&SD 210-06306: [all employed, age 40+] in thousands, both sexes.
  // For splits, C&SD 210-06305 supplies the detailed sector totals in the same period.
  const hkIndustry = {
    "2024":{
      manufacturing:[86.5,66.3], construction:[351.6,230.3], importWholesale:[296.5,220.1],
      retailFood:[513.7,322.1], transportInfo:[421.7,270.3], finance:[849.6,533.7],
      publicServices:[1149.5,638.5], other:[24.6,17.1], retail:251.5, food:262.1, transport:290.9, info:130.9,
    },
    "2025":{
      manufacturing:[88.3,67.3], construction:[338.1,227.1], importWholesale:[282.6,211.3],
      retailFood:[493.6,316.8], transportInfo:[418.5,272.8], finance:[860,545.6],
      publicServices:[1164.9,648.7], other:[26.1,17.1], retail:236.1, food:257.6, transport:287.7, info:130.8,
    },
    "2026-q2":{
      manufacturing:[87.1,65.3], construction:[324.6,220], importWholesale:[282.2,218.6],
      retailFood:[490.2,319.5], transportInfo:[407.3,260.5], finance:[863.9,557.1],
      publicServices:[1169.1,665.9], other:[21.7,15.2], retail:226.7, food:263.5, transport:280.6, info:126.8,
    },
  };
  const ratio = ([total,older]) => older/total*100;
  // Use the 2021 project age-35+ gaps as proxies for the splits' age-40+ gaps.
  // Centre those offsets so the detailed sectors' weighted share matches the official broad group.
  function splitShare(group,firstTotal,secondTotal,gap) {
    const first = ratio(group)+gap*secondTotal/(firstTotal+secondTotal);
    return [first,first-gap];
  }
  const hongKongIndustry = Object.fromEntries(Object.entries(hkIndustry).map(([period,group])=>{
    const [retail,food] = splitShare(group.retailFood,group.retail,group.food,75.41-70.12);
    const [transport,info] = splitShare(group.transportInfo,group.transport,group.info,81.35-61.43);
    const [importWholesaleTotal,importWholesale40] = group.importWholesale;
    const trade = (importWholesale40*100+retail*group.retail)/(importWholesaleTotal+group.retail);
    return [period,{
      manufacturing:ratio(group.manufacturing), construction:ratio(group.construction), trade, transport, food, info,
      finance:ratio(group.finance), publicServices:ratio(group.publicServices), other:ratio(group.other),
    }];
  }));

  // Mainland 40+ shares for 2023 and 2024. Combined sectors are weighted by the
  // all-ages employment shares from tables 1-49 (2024 yearbook) and 2-17 (2025 yearbook).
  const industryRows = [
    {id:"制造业", name:["制造业","Manufacturing"], key:"manufacturing", shares:[51.9,52.76575]},
    {id:"建筑业", name:["建筑业","Construction"], key:"construction", shares:[61.5,62.85646]},
    {id:"批发零售/进出口", name:["批发零售／进出口","Wholesale, retail and import/export"], key:"trade", shares:[52.1,53.21948]},
    {id:"运输仓储邮政", name:["运输仓储邮政","Transport, storage and postal services"], key:"transport", shares:[54.7,55.05621]},
    {id:"住宿餐饮", name:["住宿餐饮","Accommodation and food services"], key:"food", shares:[52.3,52.33453]},
    {id:"信息通讯", name:["信息通讯","Information and communications"], key:"info", shares:[24.2,25.69511]},
    {id:"金融地产商务", name:["金融地产商务","Finance, real estate and business services"], key:"finance", shares:[44.44891,45.40463]},
    {id:"公共教育医疗社会个人服务", name:["公共、教育、医疗及社会服务","Public, education, health and social services"], key:"publicServices", shares:[48.89953,49.14250]},
    {id:"其他（农林采矿/公用事业/国际组织）", name:["其他（农林、公用等）","Other industries"], key:"other", shares:[79.56972,80.15731]},
  ];
  const industries = industryRows.map(({id,name,key,shares})=>({
    id, name,
    mainland:Object.fromEntries(Object.entries(yearsFrom2024).map(([period,offset])=>[period,project(...shares,offset)])),
    hongKong:Object.fromEntries(Object.entries(hongKongIndustry).map(([period,shares])=>[period,shares[key]])),
  }));

  globalThis.workforceAge = {bands,mainland,hongKong,industries};
})();
