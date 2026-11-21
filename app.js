(() => {
  "use strict";
  const d = globalThis.guideData;
  const workforceAge = globalThis.workforceAge;
  const c = globalThis.guideCharts;
  const language = globalThis.guideLanguage;
  const guideTheme = globalThis.guideTheme;
  const pathway = globalThis.guidePathway;
  const {t, year: yearLabel, list, englishName, mapping} = language;
  const {esc, number, percent, money, legend, empty} = c;
  const P = () => c.purple, R = () => c.rose, C = () => c.colors;
  const darkNow = () => !!(guideTheme && guideTheme.isDark());
  const $ = id => document.getElementById(id);
  const main = $("content");
  const tooltip = $("chart-tooltip");
  const charts = new Map();
  const openPanels = new Set();
  let chapter, observers = [];
  let hoverBand = null;
  const item = (id, title, subtitle, question, summary) => ({
    id, get title() { return t(...title); }, get subtitle() { return t(...subtitle); },
    get question() { return t(...question); }, get summary() { return t(...summary); },
  });
  const pages = [
    item("markets",["两地对照","Two markets"],["香港值得深入看看吗？","Should I explore Hong Kong further?"],["毕业后，要不要把香港列为求职重点？","Should I focus my job search on Hong Kong?"],
      ["刚在香港读完硕士的嘉宁，正在考虑毕业后在哪里工作。她先看内地与香港的就业年龄结构和青年失业率，再参考深圳与香港的行业月薪。","Jia Ning has just finished her master’s degree in Hong Kong and is deciding where to look for work. She starts with workforce age and youth unemployment in both markets, then looks at industry wages in Shenzhen and Hong Kong."]),
    item("structure",["发现方向","Discover options"],["从行业趋势到求职方向","From industry trends to job options"],["在香港，我可以从哪些行业开始找工作？","Where could I start my job search in Hong Kong?"],
      ["先看香港各行业有多少人在工作、近年有何变化。再结合自己的专业、兴趣和技能选职业组，在下方流向图查看哪些行业有相关空缺。","Start with the size and trends of Hong Kong’s industries. Then use your studies, interests and skills to choose occupation groups and look for vacancies in the flow chart below."]),
    item("fit",["试算个人条件","Test my criteria"],["工资、工时和生活费怎么算？","How do pay, hours and costs add up?"],["这些方向，能支撑我想要的香港生活吗？","Could these options support the life I want in Hong Kong?"],
      ["带入你选的行业和职业组合，用行业工资、工时和每月开支试算。调整一个条件，看看哪些方向仍值得优先投递。","Test your selected industry and occupation pairs against industry pay, working hours and your monthly costs. Change one assumption and see which options still look worth applying for first."]),
  ];
  const defaultWageRate = 1.0828;
  const wageRateSource = "https://www.censtatd.gov.hk/en/data/stat_report/product/B1010003/att/B10100032025AN25B0100.pdf";
  const wageAgeGroups = {
    finance:"金融地产商务", information:"信息通讯", construction:"建筑业", manufacturing:"制造业",
    "land-transport":"运输仓储邮政", "real-estate":"金融地产商务", wholesale:"批发零售/进出口",
    retail:"批发零售/进出口", accommodation:"住宿餐饮", food:"住宿餐饮",
  };
  // 8 个就业大类（趋势图）与 10 个行业 ind（空缺交叉表）的对应；建造、其他大类无空缺口径。
  const BAND_TO_INDS = {
    0:["ind_C"], 1:[], 2:["ind_G45_46"], 3:["ind_G47","ind_I"],
    4:["ind_H","ind_J"], 5:["ind_K","ind_L","ind_M_N"], 6:["ind_P_S"], 7:[],
  };
  const IND_TO_BAND = {};
  Object.entries(BAND_TO_INDS).forEach(([band,inds])=>inds.forEach(ind=>{IND_TO_BAND[ind]=+band;}));
  const occToInds = occ => d.occupations.filter(r=>r.name===occ && r.count>0)
    .sort((a,b)=>b.count-a.count).map(r=>r.id);
  const indToOccs = ind => d.occupations.filter(r=>r.id===ind && r.count>0)
    .sort((a,b)=>b.count-a.count).map(r=>r.name);
  const occTopBands = (occ,n=3) => [...new Set(occToInds(occ).slice(0,n)
    .map(ind=>IND_TO_BAND[ind]).filter(b=>b!==undefined))];
  function bandTopOccs(band,n=3) {
    const sums={};
    BAND_TO_INDS[band].forEach(ind=>d.occupations.filter(r=>r.id===ind)
      .forEach(r=>{sums[r.name]=(sums[r.name]??0)+(r.count??0);}));
    return Object.entries(sums).filter(([,v])=>v>0)
      .sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k])=>k);
  }
  const {fitBroad,fitDetails,fitCell,fitVacancyMode,fitOccupations,marketPeriod:formerIndustryPeriod,workforceView:formerWorkforceView,...saved} = pathway.load();
  const savedWorkforcePeriod = ["2026-q2","2026-q3"].includes(saved.workforcePeriod) ? "2026-h1" : saved.workforcePeriod;
  const savedMarketIndustry = wageAgeGroups[saved.wageIndustry] ?? saved.marketIndustry;
  const state = {
    marketAge:"over", overviewYear:2025, marketRegion:"", overviewIndustry:null,
    wageRate:defaultWageRate, wageCurrency:"CNY", wageSort:"hk", wageIndustry:"",
    selected:[], vacancyMode:"count", payYear:2025, startYear:2016,
    targetPay:25000, maxHours:42, targetSurplus:6000, offer:25000, rent:10000, living:6500, deduct:2000,
    profile:pathway.emptyProfile(), pairs:[], occupations:"all", taskOccupations:{}, vacancyCell:"", sortBy:"surplus",
    industryDetails:[], budgetScope:true, cross:null, fitGroups:[],
    ...saved,
    workforcePeriod:Object.hasOwn(workforceAge.hongKong,savedWorkforcePeriod) ? savedWorkforcePeriod : "2024",
    marketIndustry:workforceAge.industries.some(group=>group.id===savedMarketIndustry) ? savedMarketIndustry : "",
  };
  state.cross=null;
  let playing = false, playTimer = null;
  function stopPlay() {
    playing = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
  }
  function togglePlay() {
    if (playing) { stopPlay(); render(); return; }
    playing = true;
    const step = () => {
      if (!playing) return;
      const next = state.overviewYear >= 2025 ? 2016 : state.overviewYear + 1;
      state.overviewYear = next;
      render();
      playTimer = setTimeout(step, 900);
    };
    playTimer = setTimeout(step, 260);
    render();
  }
  const aliases = {
    "Manufacturing":"制造业","Construction":"建筑业","Import/export & wholesale":"进出口及批发",
    "Retail & accommodation":"零售、住宿及餐饮","Transportation & information":"运输及资讯",
    "Finance & professional":"金融、地产及商务","Public & social services":"公共及社会服务","Other industries":"其他行业",
    "Employees":"雇员","Employers":"雇主","Self-employed":"自雇","Unpaid family workers":"无酬家庭从业者",
    "Managers":"经理","Professionals":"专业人员","Associate professionals":"辅助专业人员",
    "Clerical support workers":"文书支援人员","Services and sales workers":"服务及销售人员",
    "Craft and related trades workers":"工艺及有关人员","Plant and machine operators and assemblers":"机械操作及装配人员",
    "Elementary occupations":"非技术工人","Other occupations":"其他职业",
    "Skilled agricultural and fishery workers":"熟练农渔工人",
    "公共教育医疗社会个人服务":"公共、教育、医疗及社会服务",
    "其他（农林采矿/公用事业/国际组织）":"其他（农林、公用等）",
  };
  const occShortEn = {
    "Managers":"Managers","Professionals":"Professionals","Associate professionals":"Associate prof.",
    "Clerical support workers":"Clerical support","Services and sales workers":"Services & sales",
    "Skilled agricultural and fishery workers":"Skilled agri./fishy","Craft and related trades workers":"Craft trades",
    "Plant and machine operators and assemblers":"Plant & machine operators","Elementary occupations":"Elementary",
  };
  const label = x => t(aliases[x] ?? x, englishName(x));
  const occLabel = g => t(aliases[g] ?? g, occShortEn[g] ?? g);
  const span = (a,b) => Array.from({length:b-a+1},(_,i)=>i+a);
  const historyX = p => Number(p.slice(0,4)) + (Number(p.slice(-1))-1)/4;
  const unique = data => [...new Set(data)];
  const by = (rows,key) => Map.groupBy(rows,r=>r[key]);
  const figure = (id,title,unit,body,note,options={}) => `<figure class="card${options.full?" span-full":""}" id="${id}">
    <div class="card-head"><div><h3>${title}</h3><p class="card-unit">${unit}</p></div>${options.control ?? ""}</div>
    ${options.key ?? ""}<div class="viz">${body}</div><figcaption>${note}</figcaption></figure>`;
  const viz = (id,fn) => {
    charts.set(id,fn);
    return `<div data-chart="${id}"></div>`;
  };
  const grid = (...items) => `<div class="grid">${items.join("")}</div>`;
  const select = (key,title,choices,render=String,selected=state[key]) => `<label class="field">${title}<select id="${key}" data-control="${key}">
    ${choices.map(v=>`<option value="${esc(v)}"${selected===v?" selected":""}>${esc(render(v))}</option>`).join("")}</select></label>`;
  const sliderRanges = {
    targetPay:[0,60000,500], maxHours:[20,80,1], targetSurplus:[0,30000,500],
    offer:[0,60000,500], rent:[0,30000,500], living:[0,20000,250], deduct:[0,15000,250],
  };
  const budgetField = (key,title,step) => {
    const [rmin,rmax,rstep] = sliderRanges[key] ?? [0,60000,step];
    const val = state[key];
    const fill = Math.max(0, Math.min(100, (val - rmin) / (rmax - rmin) * 100));
    return `<label class="field slider-field">
      <span class="slider-caption">${title}<b id="num-${key}">${number(val)}</b></span>
      <input class="slider" type="range" style="--fill:${fill}%" min="${rmin}" max="${rmax}" step="${rstep}" value="${val}" data-range="${key}" aria-label="${title}">
      <input id="${key}" class="slider-number" type="number" min="${rmin}" max="${rmax}" step="${step}" value="${val}" data-control="${key}"></label>`;
  };
  const controls = (...items) => `<div class="control-bar">${items.join("")}</div>`;
  const hint = (zh,en) => `<p class="mode-note">${t(zh,en)}</p>`;
  const stats = (...items) => `<div class="stats">${items.map(([value,caption])=>`<div class="stat"><strong>${value}</strong><span>${caption}</span></div>`).join("")}</div>`;
  const chip = (action,value,title,pressed) => `<button type="button" class="chip" data-action="${action}" data-value="${esc(value)}" data-focus="${esc(action+":"+value)}"${pressed===undefined?"":` aria-pressed="${pressed}"`}>${esc(title)}</button>`;
  const filterLegend = (action,entries,active,where) => `<div class="legend">${entries.map(([key,name,color])=>
    `<button type="button" data-action="${action}" data-value="${esc(key)}" data-focus="${esc(action+":"+where+":"+key)}" aria-pressed="${active===key}"><i style="background:${color}"></i>${esc(name)}</button>`).join("")}</div>`;
  const series = (id,sets,options) => viz(id,w=>c.series(w,sets,options));
  const lineSet = (name,points,color=P(),dash=false) => ({name,points,color,dash});
  const mk = i => String(i).padStart(2,"0");
  const keyOf = pair => pathway.pairKey(pair.id,pair.occupation);
  const vacancyShare = row => Number.isFinite(row.share) ? percent(row.share * 100) : "—";
  const industryName = id => label(d.demand.find(row => row.id === id)?.name ?? id);
  const pairTitle = pair => `${industryName(pair.id)} × ${label(pair.occupation)}`;
  const insight = pair => {
    const rule = pathway.suggestions(state.profile).find(option => option.groups.includes(pair.occupation));
    if (pair.comparison) return t("手动加入作对照","Manually added for comparison");
    return rule ? `${rule.task} · ${list(rule.match)}` : t("本人选定的探索方向","Manually selected for exploration");
  };

  function markets() {
    const periods = {
      "2024":t("2024 年（全年）","2024 (full year)"),
      "2025":t("2025 年（全年）","2025 (full year)"),
      "2026-h1":t("2026 年 1–6 月","Jan–Jun 2026"),
    };
    const periodLabel = periods[state.workforcePeriod];
    const illustrationLabel = t("走势示意（模拟数据）","Illustration (simulated data)");
    const {bands} = workforceAge;
    const ages = span(0,bands.length-1);
    const ageRange = order=>parseInt(bands[order],10)<35 ? "under" : "over";
    const start35 = bands.indexOf("35–39");
    const ageBoundary = start35-0.5;
    const regionEntries = [["内地",t("内地城镇","Urban Mainland"),P()],["香港",t("香港","Hong Kong"),R()]];
    const reference = d.markets.filter(row=>row.kind==="A_2010年龄对照");
    // Shift a small share from the younger bands to the older ones in each successive scenario.
    const shifts = [[-0.1,-0.1,-0.1,0.1,0.1,0,0,0.1,0,0],[-0.1,-0.2,-0.1,0,0,0.1,0.1,0.1,0,0.1]];
    const regionData = regionEntries.map(([key],index)=>{
      const baseline = reference.filter(row=>row.region===key).sort((a,b)=>a.order-b.order);
      return Object.fromEntries(Object.keys(periods).map((period,step)=>
        [period,baseline.map((row,band)=>row.value+step*shifts[index][band])]));
    });
    const shares = regionData.map(data=>data[state.workforcePeriod]);
    const sets = regionEntries.map(([key,name,color],index)=>{
      const data = regionData[index];
      const points = shares[index].map((value,order)=>{
        const comparison = Object.entries(periods).map(([period,label])=>`${label} · ${percent(data[period][order])}`);
        const heading = `${name} · ${bands[order]} · ${illustrationLabel}`;
        return [order,value,[heading,...comparison].join("\n")];
      });
      return {
        ...lineSet(name,points,color,index===1),key,pointValue:ageRange,
        opacity:state.marketRegion && state.marketRegion!==key ? 0.82 : 1,
        strokeWidth:state.marketRegion===key ? 3.2 : 2.4,
      };
    });
    const agePlot = viz("workforce-age",width=>c.series(width,sets,{
      height:width>=390 ? 310 : 238,
      x:[ages[0],ages.at(-1)], xTicks:width>=390 ? ages : ages.filter((_,i)=>i%2===0 && i<ages.length-2).concat(ages.at(-1)),
      xFormat:order=>bands[order], yFormat:percent, y:[0,15], yTicks:[0,5,10,15], right:24,
      action:"marketAge", label:illustrationLabel,
    }));
    const [urban35Plus,hk35Plus] = shares.map(values=>values.slice(start35).reduce((total,share)=>total+share,0));
    const overallComparison = (name,urbanShare,hkShare)=>{
      const regions = [[regionEntries[0][1],urbanShare],[regionEntries[1][1],hkShare]];
      const [higher,lower] = regions.sort((a,b)=>b[1]-a[1]);
      const relation = percent(higher[1])===percent(lower[1]) ? t("与","and") : t("高于","compared with");
      return `<p><strong>${name}</strong> · ${higher[0]} ${percent(higher[1])} ${relation} ${lower[0]} ${percent(lower[1])}</p>`;
    };
    const ageCaption = `<div class="market-age-comparison">
      ${overallComparison(t("35 岁以下","Under 35"),100-urban35Plus,100-hk35Plus)}
      ${overallComparison(t("35 岁及以上","35 and over"),urban35Plus,hk35Plus)}
    </div><p>${t("走势以原图的 2010 年点位为起点，各时期作小幅模拟调整。悬停或聚焦数据点可查看三个时期，点选可切换右图的年龄范围。",
      "The illustration starts from the original chart’s 2010 values and applies small simulated changes across periods. Hover or focus a point to see all three periods. Select it to change the age band in the industry chart.")}</p>`;
    return heading(pages[0],0,"market-compare")
      + controls(select("workforcePeriod",t("两张年龄图共用时期","Shared period for both age charts"),Object.keys(periods),period=>periods[period]))
      + `<div class="grid wide-pair market-ages">`
      + figure("ages",t("就业人口年龄结构","Employed population by age"),
          `${periodLabel} · ${t("走势示意","Illustration")}`,agePlot,ageCaption,
          {key:filterLegend("marketRegion",regionEntries,state.marketRegion,"ages")})
      + marketIndustryAge(periodLabel)
      + `</div>`
      + marketUnemployment()
      + shenzhenHongKongPay()
      + `<div class="decision market-next"><strong>${t("嘉宁决定先看看香港有哪些适合自己的岗位，同时保留内地求职选项。","Jia Ning decides to look for roles that fit her in Hong Kong while keeping her Mainland job search open.")}</strong>
        <div class="chapter-actions"><a class="primary-link" href="#structure" data-start-example>${t("跟随嘉宁找香港岗位","Explore Hong Kong vacancies with Jia Ning")}</a>
        <button type="button" class="secondary-link" data-action="startOwn"${state.pairs.length ? ' aria-describedby="own-search-note"' : ""}>${t("用我的背景探索","Explore with my own background")}</button></div>
        ${state.pairs.length ? `<p id="own-search-note">${t("从这里开始会清空已选方向和对应的面试备注。","Starting here clears your shortlist and its interview notes.")}</p>` : ""}</div>`;
  }

  function marketIndustryAge(periodLabel) {
    const ageLabel = band=>band==="under" ? t("35 岁以下","Under 35") : t("35 岁及以上","35 and over");
    const share = value=>state.marketAge==="under" ? 100-value : value;
    const rows = workforceAge.industries.map(industry=>{
      const mainland = share(industry.mainland[state.workforcePeriod]), hk = share(industry.hongKong[state.workforcePeriod]);
      return {key:industry.id, name:t(...industry.name), mainland, hk, gap:hk-mainland};
    }).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
    const maxGap = Math.max(...workforceAge.industries.flatMap(industry=>Object.keys(industry.mainland)
      .map(period=>Math.abs(industry.hongKong[period]-industry.mainland[period]))));
    const gapLimit = Math.max(5,Math.ceil(maxGap/5)*5);
    const gapFormat = new Intl.NumberFormat(language.code(),{minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:"exceptZero"});
    const gapLabel = gap=>gapFormat.format(gap).replace(/^-/,"−");
    const comparison = row=>t(`内地城镇 ${percent(row.mainland)} · 香港 ${percent(row.hk)}`,`Urban Mainland ${percent(row.mainland)} · Hong Kong ${percent(row.hk)}`);
    const title = t("哪些行业的年龄结构差异最大？","Which industries have the biggest age gaps?");
    const chart = `<div class="industry-gap-chart" role="group" aria-label="${esc(title)}">
      <div class="industry-gap-row industry-gap-axis" aria-hidden="true">
        <span class="industry-gap-track"><span>−${gapLimit}</span><span>0</span><span>+${gapLimit}</span></span>
        <span class="industry-gap-number">${t("百分点","pp")}</span>
      </div>
      ${rows.map(row=>{
        const tip = `${row.name} · ${comparison(row)} · ${gapLabel(row.gap)} ${t("个百分点","percentage points")}`;
        return `<button type="button" class="industry-gap-row" data-action="marketIndustry" data-value="${esc(row.key)}"
          data-focus="marketIndustry:${esc(row.key)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${state.marketIndustry===row.key}">
          <span class="industry-gap-name">${esc(row.name)}</span>
          <span class="industry-gap-track" aria-hidden="true"><i class="industry-gap-bar${row.gap<0?" is-negative":""}" style="--gap-width:${Math.abs(row.gap)/gapLimit*50}%"></i></span>
          <span class="industry-gap-number">${gapLabel(row.gap)}</span>
        </button>`;
      }).join("")}
    </div>`;
    const picked = rows.find(row=>row.key===state.marketIndustry);
    const hasWage = picked && Object.values(wageAgeGroups).includes(picked.key);
    const wageLink = `<a class="secondary-link" href="#pay-comparison" data-scroll="pay-comparison">${t("查看对应行业的深港工资","See corresponding Shenzhen–Hong Kong wages")}</a>`;
    const detail = picked ? `<div class="industry-gap-detail" role="status"><strong>${esc(picked.name)}</strong> · ${comparison(picked)}
      <p>${hasWage ? wageLink : t("现有深港工资图缺少这一大类的对应行业数据。","The wage chart has no corresponding industry data for this group.")}</p></div>` : "";
    const period = t(`${periodLabel} · 内地城镇与香港`,`${periodLabel} · Urban Mainland and Hong Kong`);
    return figure("industry-age",title,period+" · "+ageLabel(state.marketAge),
      chart+detail,
      t("条向右表示香港占比较高，向左表示内地城镇占比较高。分母为各地该组就业人口。九个行业的统计口径及拆分方法见数据来源。",
        "Bars point right when Hong Kong has the higher share and left when urban Mainland China does. Shares use each market’s employment in the same group. See Data and methods for the nine group definitions and how the detailed shares are derived."),
      {control:select("marketAge",t("年龄范围","Age band"),["over","under"],ageLabel)});
  }

  function marketUnemployment() {
    const data = d.marketContext;
    const group = row => t(row.nameZh,row.nameEn);
    const unemployment = (area,title,period,note,color,max) => {
      const rows = data.filter(row=>row.indicator==="unemployment" && row.area===area);
      return figure(`unemployment-${area}`,title,period+t(` · 本图 0–${max}%`,` · Local scale 0–${max}%`),
        c.bars(rows.map(row=>({name:group(row),values:[row.value]})),{colors:[color],max,format:percent,label:title}),
        note);
    };
    return `<section aria-labelledby="risk-heading"><header class="subhead"><h2 id="risk-heading">${t("两地年轻人的失业率是多少？","What are the youth unemployment rates?")}</h2>
      ${hint("每张图比较当地的总体失业率与青年失业率。两地的年龄分组、在校生口径和统计时期不同，请按各图的百分比读数。","Each chart compares the local overall rate with its youth rates. Age bands, treatment of students and reference periods differ. Read the percentages shown on each chart.")}</header>`
      + grid(unemployment("CN",t("内地城镇调查失业率","Surveyed urban unemployment in Mainland China"),t("2025 年 12 月","December 2025"),
        t("总体包含符合劳动力定义的在校生。两个青年组都剔除在校生。","The overall rate can include students in the labour force. Both youth rates exclude students."),P(),20),
        unemployment("HK",t("香港失业率","Hong Kong unemployment"),t("2025 年第四季度","2025 Q4"),
          t("全港总体及分年龄失业率均未经季节性调整。年龄组沿用综合住户统计调查。","Overall and age-group rates are not seasonally adjusted. Age bands follow the General Household Survey."),R(),15))
      + "</section>";
  }

  function shenzhenHongKongPay() {
    const data = d.payComparison ?? [];
    if (!data.length) return "";
    const rate = state.wageRate;
    const cnyUnit = t("人民币／月","CNY/month"), hkdUnit = t("港元／月","HKD/month");
    const inCny = state.wageCurrency === "CNY";
    const unit = inCny ? cnyUnit : hkdUnit;
    const amount = value => number(Math.round(value) || 0);
    const sz = t("深圳","Shenzhen"), hk = t("香港","Hong Kong");
    const difference = t("差额（香港 − 深圳）","Gap (Hong Kong − Shenzhen)");
    const title = t("深圳与香港的行业月薪中位数","Median monthly wages in Shenzhen and Hong Kong");
    const sortLabels = {
      hk:t("香港月薪","Hong Kong wage"), sz:t("深圳月薪","Shenzhen wage"), gap:t("两地差额","Wage gap"),
    };
    const rows = data.filter(row=>row.id!=="all").map(row=>{
      const sz = row.sz/12 * (inCny ? 1 : rate);
      const hk = row.hk / (inCny ? rate : 1);
      return {id:row.id, name:t(row.nameZh,row.nameEn), sz, hk, gap:hk-sz, note:t(row.noteZh,row.noteEn)};
    }).sort((a,b)=>b[state.wageSort]-a[state.wageSort]);
    const highest = Math.max(...rows.flatMap(row=>[row.sz,row.hk]));
    const magnitude = 10 ** Math.floor(Math.log10(highest/4));
    const step = [1,2,2.5,5,10].find(value=>value*magnitude>=highest/4)*magnitude;
    const tickCount = Math.ceil(highest/step);
    const position = value => (100 * value / (step*tickCount)).toFixed(4) + "%";
    const tickFormat = new Intl.NumberFormat(language.code(),{notation:"compact",maximumFractionDigits:1});
    const gapText = value => (Math.round(value)>0 ? "+" : "") + amount(value);
    const chart = `<div class="wage-chart" role="group" aria-label="${esc(t("按行业比较两地月薪和差额","Compare monthly wages and gaps by industry"))}">
      <div class="wage-chart-row wage-chart-axis" aria-hidden="true">
        <span class="wage-track wage-ticks">${span(0,tickCount).map(i=>`<span style="left:${position(i*step)}">${tickFormat.format(i*step)}</span>`).join("")}</span>
        <span class="wage-gap">${difference}</span>
      </div>
      ${rows.map(row=>{
        const active = state.wageIndustry===row.id;
        const related = !state.wageIndustry && state.marketIndustry===wageAgeGroups[row.id];
        const tip = [row.name, `${sz} ${amount(row.sz)} ${unit}`, `${hk} ${amount(row.hk)} ${unit}`,
          `${difference} ${gapText(row.gap)} ${unit}`, row.note].filter(Boolean).join("\n");
        return `<button type="button" class="wage-chart-row wage-choice${related?" wage-related":""}" data-action="wageIndustry" data-value="${row.id}"
          data-focus="wageIndustry:${row.id}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${active}">
          <span class="wage-industry">${esc(row.name)}</span>
          <span class="wage-track" style="--sz-position:${position(row.sz)};--hk-position:${position(row.hk)}" aria-hidden="true">
            <span class="wage-connector"></span>
            <span class="wage-point wage-sz" style="--point:${P()}"><b>${amount(row.sz)}</b></span>
            <span class="wage-point wage-hk" style="--point:${R()}"><b>${amount(row.hk)}</b></span>
          </span>
          <span class="wage-gap">${gapText(row.gap)}</span>
        </button>`;
      }).join("")}
    </div>`;
    const fx = `<form class="control-bar wage-exchange" data-wage-exchange>
      ${select("wageCurrency",t("图表币种","Chart currency"),["CNY","HKD"],value=>value==="CNY"?cnyUnit:hkdUnit)}
      ${select("wageSort",t("从高到低排序","Sort high to low"),Object.keys(sortLabels),value=>sortLabels[value])}
      <label class="field" for="wageRate">${t("汇率（1 人民币兑多少港元）","Exchange rate (HKD per CNY)")}
        <input id="wageRate" type="number" min="0.0001" max="100" step="any" required value="${rate}"></label>
      <button class="chip" type="submit" id="apply-wage-rate">${t("应用汇率","Apply rate")}</button>
      ${chip("resetWageRate","default",t("恢复默认","Reset to default"))}
      <p class="mode-note"><a class="secondary-link" href="${wageRateSource}">${t(`2024 年平均汇率（1 人民币 = ${defaultWageRate} 港元）`,`2024 average exchange rate (CNY 1 = HKD ${defaultWageRate})`)}</a></p>
      </form>`;
    const key = `<div class="legend wage-key" aria-label="${unit}">
      <span><i style="background:${P()}"></i>${sz}</span><span><i class="wage-key-circle" style="background:${R()}"></i>${hk}</span>
      <span>${unit}</span>
    </div>`;
    const selected = rows.find(row=>row.id===state.wageIndustry);
    const ageChartLink = `<a class="secondary-link" href="#industry-age" data-scroll="industry-age">${t("查看对应大类的年龄差异","See the age gap for this industry group")}</a>`;
    const selection = selected ? `<p class="mode-note wage-selection">${esc(selected.note)} ${ageChartLink}</p>` : "";
    const group = workforceAge.industries.find(industry=>industry.id===state.marketIndustry);
    const groupName = group ? t(...group.name) : "";
    const related = !selected && rows.some(row=>wageAgeGroups[row.id]===state.marketIndustry);
    const groupNote = related ? hint(`已突出「${groupName}」对应的工资行业。`,`Highlighted wage industries for ${groupName}.`) : "";
    return figure("pay-comparison",title,t("2024 年 · 男女合计 · 金额取整","2024 · Both sexes combined · Rounded to whole currency units"),
      fx + key + groupNote + chart + selection,
      t("点选行业可查看口径说明，并在年龄差值图中突出对应大类。深圳采用全年工资中位数除以 12，香港采用 5–6 月调查期的月薪中位数。两地金额按同一汇率换算。专业及商业服务、社会及个人服务缺少可对应的整体中位数。",
        "Select an industry to see coverage notes and highlight its broader group in the age gap chart. Shenzhen’s annual median is divided by 12. Hong Kong uses the median monthly wage from its May–June survey. Both use the same exchange rate. Comparable overall medians are unavailable for professional and business services and for social and personal services."));
  }

  function structure() {
    const year=state.overviewYear;
    const total=d.total.find(r=>r.year===year)?.value;
    const industries=d.structure.filter(r=>r.kind==="industry_share");
    const years=unique(industries.map(r=>r.year)).sort((a,b)=>a-b);
    const counts = by(d.industryEmployment,"name");
    const totalName = t("全港总量","Hong Kong total"), totalColor=darkNow()?"#d6d3ec":"#30213f";
    const thousand = value=>`${number(value)}${t(" 千人"," thousand people")}`;
    const yearPoints = (name,rows)=>rows.slice().sort((a,b)=>a.year-b.year)
      .map(r=>[r.year,r.value,`${yearLabel(r.year)} · ${name} · ${thousand(r.value)}`]);
    const sets=[...by(industries,"name")].map(([name,rs],i)=>({
      key:i,name:label(name), color:C()[i], values:years.map(y=>rs.find(r=>r.year===y)?.share),
      points:yearPoints(label(name),counts.get(name)), pointValue:y=>`${y}|${i}`,
    }));
    const allIndustries = t("全部行业","All industries");
    const focused = sets[state.overviewIndustry];
    const biggest = sets.slice().sort((a,b)=>b.values[years.indexOf(year)]-a.values[years.indexOf(year)])[0];
    const highlighted = focused ?? biggest;
    const totals = {...lineSet(totalName,yearPoints(totalName,d.total),totalColor),strokeWidth:3.2,area:true};
    const industryKeys = sets.map(s=>[String(s.key),s.name,s.color]);
    const activeIndustry = focused ? String(focused.key) : "all";
    const yearTicks = {xTicks:[2008,2012,2016,2020,2025],xFormat:String,refX:year,
      action:"overviewYear",canSelect:x=>x>=2016};
    const status=d.structure.filter(r=>r.kind==="status" && r.year===year);
    const work=d.structure.filter(r=>r.kind==="occupation" && r.year===year);
    const overview = stats([number(total)+t(" 千人","k"),t(`${year} 年香港就业总量`,`Total employment in ${year}`)],
      [percent(highlighted.values[years.indexOf(year)]),t(`${highlighted.name}占全港就业的比例`,`${highlighted.name} share of Hong Kong employment`)],
      [percent(status.find(r=>r.name==="Employees").status/status.reduce((a,r)=>a+r.status,0)*100),t(`${year} 年全港雇员占比`,`Hong Kong employee share in ${year}`)])
      + controls(select("overviewYear",t("联动年份","Linked year"),span(2016,2025).reverse()),
        select("overviewIndustry",t("查看行业","Industry view"),["all",...sets.map(s=>String(s.key))],
          id=>id==="all"?allIndustries:sets[Number(id)].name,activeIndustry),
        `<button type="button" class="play-btn${playing?" playing":""}" data-action="playTimeline"><span class="dot"></span>${playing?t("停止","Pause"):t("播放年份","Play years")}</button>`,
        hint("选择行业会同步更新人数图和占比图。点任一趋势图上的 2016–2025 年数据，可切换两张全港构成图的年份。",
          "Select an industry to update the headcount and share charts. Select a year from 2016 to 2025 on either trend chart to update both Hong Kong breakdowns."))
      + crossBanner()
      + grid(
        figure("employment",t("香港就业人数","Hong Kong employment headcount"),(focused ? focused.name+" · " : "")+t("2008–2025 年 · 千人","2008–2025 · Thousands of people"),
          series("employment-line",focused?[focused]:[totals,...sets],
            {...yearTicks,...(focused?{area:true}:{y:[0,4200],yTicks:[0,1000,2000,3000,4000]}),
              label:t("香港就业人数年度折线图","Annual employment headcount in Hong Kong")}),
          t("深色线是全港总量，彩线是各行业的就业人数。点某条行业折线的年份圆点，可同时选择行业和年份。单行业视图会调整纵轴，点「全港总量」可对照所有曲线。",
            "The dark line shows the Hong Kong total. Coloured lines show industry headcounts. Select a point to choose its industry and year. The scale adjusts in single-industry view. Choose “Hong Kong total” to restore all lines."),
          {key:filterLegend("overviewIndustry",[["all",totalName,totalColor],...industryKeys],activeIndustry,"employment")}),
        figure("industry",t("行业就业占比","Employment share by industry"),t("2008–2025 年 · 占全港就业的百分比","2008–2025 · Percentage of total employment"),
          focused ? series("industry-area",[lineSet(focused.name,
            years.map((y,i)=>[y,focused.values[i],`${focused.name} · ${yearLabel(y)} · ${percent(focused.values[i])}`]),focused.color)],
            {...yearTicks,yFormat:percent,area:true,label:focused.name})
            : viz("industry-area",w=>c.stack(w,sets,years,year)),
          t("色带厚度表示该行业占全港就业的份额。点击色带或图例可查看单一行业，同时更新左侧人数图。",
            "Band thickness shows each industry’s share of total Hong Kong employment. Select a band or legend item to see one industry in both trend charts."),
          {key:filterLegend("overviewIndustry",industryKeys,activeIndustry,"industry"),
            control:focused ? chip("overviewIndustry","all",allIndustries) : ""}),
        figure("employment-status",t("雇佣身份构成","Employment status"),yearLabel(year)+t(" · 全港就业人口"," · Hong Kong employed population"),
          c.donut(status.map(r=>({name:label(r.name),value:r.status,raw:r.name}))),
          t("比较受雇、自雇等身份的结构。刚毕业时可以从雇员岗位入手，再按具体工作形式扩展搜索。",
            "Compare employees, the self-employed and other groups. Jia Ning starts with employee roles and can broaden her search to other arrangements.")),
        figure("occupation",t("职业构成","Occupational mix"),yearLabel(year)+t(" · 全港就业人口"," · Hong Kong employed population"),
          c.treemap(work.map(r=>({name:occLabel(r.name),value:r.work,occ:r.name,
            occupation:pathway.occupationGroups.includes(r.name)?r.name:null}))),
          t("方块面积表示该职业组的全港就业人数。点击职业组可在下方流向图查看当前空缺。",
            "Tile area shows how many people in Hong Kong work in each occupation group. Select an occupation group to explore its current vacancies in the flow chart below.")));
    const rules = pathway.suggestions(state.profile);
    const taskGroups = new Set(rules.map(rule=>state.taskOccupations[rule.id]).filter(Boolean));
    return heading(pages[1],1)
      + `<section id="structure-data" aria-labelledby="structure-overview-heading"><header class="subhead">
        <h2 id="structure-overview-heading">${t("香港就业规模与构成","Hong Kong employment and its composition")}</h2>
        <a class="secondary-link" href="#profile-heading" data-scroll="profile-heading">${t("跳到我的求职背景","Jump to my search profile")} ↓</a>
        </header>${overview}</section>`
      + profilePanel(rules)
      + vacancyPanel(taskGroups) + pairReview();
  }

  // —— 沉浸式求职方向问答 ——
  const majorIcons = {analytics:"📊",business:"💼",statistics:"📈",computing:"💻",engineering:"⚙️",science:"🔬",education:"🎓",health:"🩺",design:"🎨",other:"✨"};
  const interestIcons = {analyse:"🔍",build:"🛠️",create:"🎨",research:"🔬",serve:"💬",organise:"🗂️",handsOn:"🔧",care:"❤️"};
  const skillIcons = {sql:"🗄️",code:"⌨️",viz:"📊",writing:"✍️",production:"🎬",customers:"🤝",project:"📋",labs:"🧪"};
  const archetypeMap = {
    "data-analysis":{emoji:"🔍",name:["数据洞察型","The Data Insight"],desc:["你擅长从数据里找答案，把复杂信息讲清楚。","You turn data into clear answers and stories."]},
    "information-systems":{emoji:"💻",name:["技术构建型","The Tech Builder"],desc:["你喜欢把东西做出来、跑起来，享受解决技术问题。","You like building things that work and solving technical problems."]},
    "design-content":{emoji:"🎨",name:["创意表达型","The Creative Voice"],desc:["你有审美和表达欲，擅长把想法变成看得见的内容。","You turn ideas into visible, well-crafted content."]},
    "engineering":{emoji:"⚙️",name:["工程实践型","The Engineering Hand"],desc:["你喜欢动手、到现场，把技术方案落到实处。","You like hands-on work that makes technical plans real."]},
    "research-teaching":{emoji:"🔬",name:["研究探索型","The Research Mind"],desc:["你享受刨根问底、收集证据，也愿意把知识讲给别人。","You enjoy evidence, inquiry and sharing knowledge."]},
    "health-care":{emoji:"❤️",name:["照护支持型","The Care Supporter"],desc:["你有耐心和同理心，愿意直接帮助具体的人。","You bring patience and empathy to help people directly."]},
    "customer-service":{emoji:"🤝",name:["客户联结型","The People Connector"],desc:["你擅长理解人、建立信任，在沟通中推动事情。","You read people, build trust and move things through conversation."]},
    "operations":{emoji:"🗂️",name:["组织协调型","The Organising Coordinator"],desc:["你能把杂乱的事情理出头绪，让团队运转顺畅。","You bring order so teams and workflows run smoothly."]},
  };
  const openArchetype = {emoji:"🧭",name:["开放探索型","The Open Explorer"],desc:["你还没有明显偏向，正好广泛看看各个方向。","No strong lean yet — a good time to explore broadly."]};
  function buildQuizSteps() {
    const opt = (catalog,icons)=>(id)=>({value:id,icon:icons[id]??"•",label:pathway.nameOf(catalog,id)});
    return [
      {kind:"single",field:"major",optional:true,
        question:["你的专业背景更接近哪一类？","Which field best matches your studies?"],
        options:Object.keys(pathway.majors).map(opt(pathway.majors,majorIcons))},
      {kind:"multi",field:"interests",max:3,
        question:["哪些工作内容会让你愿意投入？","Which work would you enjoy doing?"],
        options:Object.keys(pathway.interests).map(opt(pathway.interests,interestIcons))},
      {kind:"multi",field:"skills",max:3,
        question:["你能拿出手的技能有哪些？","Which skills can you demonstrate?"],
        options:Object.keys(pathway.skills).map(opt(pathway.skills,skillIcons))},
      {kind:"text",field:"keywords",optional:true,
        question:["有想带进工作的爱好或关键词吗？","Any hobbies or keywords to bring into work?"],
        placeholder:t("例如摄影、零售数据分析，可留空","e.g. photography, retail analytics (optional)")},
    ];
  }
  function profilePanel(rules) {
    return `<section class="profile-quiz card" id="profile-card" aria-labelledby="profile-heading">
      <div class="quiz" data-quiz>
        <div class="quiz-head">
          <div class="quiz-progress" aria-hidden="true"><i data-quiz-bar></i></div>
          <span class="quiz-count" data-quiz-count></span>
        </div>
        <div class="quiz-stage" data-quiz-stage></div>
      </div>
    </section>`;
  }
  let quizIndex=-1, quizSteps=buildQuizSteps(), quizTimer=null;
  const quizStage = ()=>main.querySelector("[data-quiz-stage]");
  function clearQuizTimer(){ if(quizTimer){clearTimeout(quizTimer);quizTimer=null;} }
  function setQuizBar() {
    const bar=main.querySelector("[data-quiz-bar]"), count=main.querySelector("[data-quiz-count]");
    const total=quizSteps.length; let pct=0, text="";
    if(quizIndex>=0&&quizIndex<total){ pct=quizIndex/total*100; text=t(`第 ${quizIndex+1} / ${total} 题`,`Q ${quizIndex+1} / ${total}`); }
    else if(quizIndex>=total){ pct=100; text=t("结果","Result"); }
    if(bar)bar.style.width=pct+"%";
    if(count)count.textContent=text;
  }
  function switchPane(html) {
    const stage=quizStage(); if(!stage)return;
    stage.innerHTML=html;
    const pane=stage.querySelector(".q-pane");
    if(pane){ pane.classList.add("q-enter"); requestAnimationFrame(()=>pane.classList.remove("q-enter")); }
  }
  function coverPane() {
    return `<div class="q-pane q-cover">
      <div class="q-cover-emoji">🧭</div>
      <h2 id="profile-heading" class="q-cover-title">${t("测测你适合在香港做什么","Which Hong Kong career path fits you?")}</h2>
      <p class="q-cover-sub">${t("用 4 个轻松的问题，看看你的专业、兴趣和技能对应哪些在招的职业方向。","Four light questions map your studies, interests and skills to hiring directions.")}</p>
      <button type="button" class="q-primary" data-quiz-act="start">${t("开始测试","Start")}</button>
      <div class="q-cover-actions">
        <button type="button" class="q-ghost" data-quiz-act="example">${t("载入嘉宁的背景","Load Jia Ning's profile")}</button>
        <button type="button" class="q-ghost" data-quiz-act="clear">${t("清空，浏览全部","Clear and browse all")}</button>
      </div></div>`;
  }
  function questionPane(i) {
    const step=quizSteps[i], profile=state.profile;
    const chosen=step.kind==="single"?[profile[step.field]]:profile[step.field];
    const body = step.kind==="text"
      ? `<input type="text" class="q-text" data-quiz-input maxlength="100" value="${esc(profile[step.field])}" placeholder="${esc(step.placeholder)}">`
      : `<div class="q-options${step.kind==="multi"?" q-multi":""}">${step.options.map(o=>{
          const on=chosen.includes(o.value);
          return `<button type="button" class="q-option${on?" on":""}" data-quiz-act="answer" data-value="${esc(o.value)}">
            <span class="q-option-icon">${o.icon}</span><span class="q-option-label">${esc(o.label)}</span>
            <span class="q-option-check">${on?"✓":""}</span></button>`;
        }).join("")}</div>`;
    const isLastText=step.kind==="text"&&i===quizSteps.length-1;
    const foot=`<div class="q-foot">
      ${i>0?`<button type="button" class="q-ghost" data-quiz-act="back">${t("上一题","Back")}</button>`:"<span></span>"}
      ${isLastText
        ?`<button type="button" class="q-primary q-small" data-quiz-act="continue">${t("查看结果","See my result")}</button>`
        :step.optional?`<button type="button" class="q-ghost" data-quiz-act="skip">${t("跳过","Skip")}</button>`
        :`<button type="button" class="q-primary q-small" data-quiz-act="continue">${t("继续","Next")}</button>`}</div>`;
    return `<div class="q-pane q-question">
      <p class="q-ask">${t(step.question[0],step.question[1])}${step.max?t(`（最多 ${step.max} 项）`,` (up to ${step.max})`):""}</p>
      ${body}${foot}</div>`;
  }
  function analyzingPane() {
    return `<div class="q-pane q-analyzing"><div class="q-dots"><i></i><i></i><i></i></div>
      <p>${t("正在分析你的方向…","Analyzing your direction…")}</p></div>`;
  }
  function resultPane() {
    const suggestions=pathway.suggestions(state.profile), top=suggestions[0];
    const arch=top?archetypeMap[top.id]:openArchetype;
    const groupChips=top?top.groups.map(g=>`<button type="button" class="q-group" data-quiz-act="group" data-value="${esc(g)}">${esc(label(g))}</button>`).join(""):"";
    const other=suggestions.slice(1,4).map(s=>{const a=archetypeMap[s.id];
      return `<button type="button" class="q-other" data-quiz-act="peek" data-value="${esc(s.id)}"><span>${a.emoji}</span>${esc(t(...a.name))}<b>${s.match.length}</b></button>`;
    }).join("");
    return `<div class="q-pane q-result">
      <div class="q-result-emoji">${arch.emoji}</div>
      <h3 class="q-result-name">${esc(t(...arch.name))}</h3>
      <p class="q-result-desc">${esc(t(...arch.desc))}</p>
      ${top?`<div class="q-result-block"><p class="q-block-label">${t("匹配的职业组","Matching occupation groups")}</p>
        <div class="q-group-row">${groupChips}</div>
        <p class="q-words">${t("岗位搜索词","Job-ad keywords")}：${esc(top.words)}</p></div>`:""}
      ${other?`<div class="q-result-other"><p class="q-block-label">${t("你也可能适合","You may also fit")}</p>${other}</div>`:""}
      <div class="q-result-actions">
        <button type="button" class="q-primary" data-quiz-act="view">${t("查看相关空缺","View related vacancies")}</button>
        <button type="button" class="q-ghost" data-quiz-act="restart">${t("重新测一次","Retake")}</button></div></div>`;
  }
  function renderQuiz() {
    const total=quizSteps.length;
    if(quizIndex===-1)switchPane(coverPane());
    else if(quizIndex<total)switchPane(questionPane(quizIndex));
    else if(quizIndex===total)switchPane(analyzingPane());
    else switchPane(resultPane());
    setQuizBar();
  }
  function go(i){ quizIndex=i; renderQuiz(); }
  function analyzeThenResult(){ clearQuizTimer(); go(quizSteps.length); quizTimer=setTimeout(()=>go(quizSteps.length+1),1300); }
  function initQuiz(){ clearQuizTimer(); quizSteps=buildQuizSteps(); quizIndex=-1; renderQuiz(); }
  function handleQuiz(e,el) {
    const act=el.dataset.quizAct, total=quizSteps.length;
    if(act==="start")go(0);
    else if(act==="restart"){ state.profile=pathway.emptyProfile(); state.fitGroups=[]; state.occupations="all"; go(-1); }
    else if(act==="clear"){ state.profile=pathway.emptyProfile(); state.fitGroups=[]; state.occupations="all"; go(total+1); }
    else if(act==="example"){ loadExampleProfile(); analyzeThenResult(); }
    else if(act==="back")go(Math.max(0,quizIndex-1));
    else if(act==="skip"||act==="continue"){
      if(quizIndex===total-1)analyzeThenResult(); else go(quizIndex+1);
    }
    else if(act==="answer"){
      const step=quizSteps[quizIndex], v=el.dataset.value;
      if(step.kind==="single"){
        state.profile[step.field]=v;
        switchPane(questionPane(quizIndex));
        clearQuizTimer();
        quizTimer=setTimeout(()=>{ if(quizIndex===total-1)analyzeThenResult(); else go(quizIndex+1); },300);
      } else {
        const arr=state.profile[step.field];
        if(arr.includes(v))arr.splice(arr.indexOf(v),1);
        else if(arr.length<step.max)arr.push(v);
        else { const st=quizStage();st.classList.add("q-shake");setTimeout(()=>st.classList.remove("q-shake"),320);return; }
        switchPane(questionPane(quizIndex));
      }
    }
    else if(act==="view"){
      applyFitToSankey();
      clearQuizTimer(); render(); $("hiring").scrollIntoView({block:"start"});
    }
    else if(act==="group"){
      const occ=el.dataset.value;
      if(occ)state.occupations=occ;
      clearQuizTimer(); render(); $("hiring").scrollIntoView({block:"start"});
    }
    else if(act==="peek"){
      // 把该方向临时置顶展示：用其 archetype 弹出轻量提示
      const a=archetypeMap[el.dataset.value];
      const tip=t(...a.name)+" · "+t(...a.desc);
      tooltip.textContent=tip; tooltip.hidden=false;
      const r=el.getBoundingClientRect();
      tooltip.style.left=Math.min(window.innerWidth-220,r.left)+"px";
      tooltip.style.top=Math.max(8,r.top-10)+"px";
    }
  }
  function applyFitToSankey() {
    const sug = pathway.suggestions(state.profile).slice(0, 3);
    const groups = [...new Set(sug.flatMap(s => s.groups).filter(g => pathway.occupationGroups.includes(g)))];
    const inds = [...new Set(groups.flatMap(g => occToInds(g)))];
    state.fitGroups = groups;
    if (inds.length) setIndustryFilter(inds, []);
    state.occupations = groups[0] ?? "all";
    state.vacancyCell = "";
  }
  function clearFit() { state.fitGroups = []; }
  function sankeyChart() {
    const selInds = new Set(visibleIndustries());
    const occActive = pathway.occupationGroups.includes(state.occupations) ? state.occupations : "";
    const fitGroupSet = new Set(state.fitGroups || []);
    const cell = state.vacancyCell || "";
    const isEn = language.code() === "en";
    const indShortEn = {
      "制造业": "Manufacturing", "进出口及批发": "Import/export & wholesale", "零售业": "Retail trade",
      "运输及邮政": "Transport & postal", "住宿及餐饮": "Accommodation & food", "资讯及通讯": "Info & comms",
      "金融及保险": "Financing & insurance", "地产业": "Real estate",
      "专业及商业服务": "Prof. & business services", "社会及个人服务": "Social & personal services",
    };

    const left = d.demand.map(ind => {
      const rows = d.occupations.filter(o => o.id === ind.id);
      const total = rows.reduce((s, r) => s + (r.count || 0), 0);
      return { id: ind.id, zh: ind.name, en: indShortEn[ind.name] || englishName(ind.name), name: label(ind.name), market: ind, total, rows };
    }).sort((a, b) => b.total - a.total);
    const right = pathway.occupationGroups.map(g => {
      const rows = d.occupations.filter(o => o.name === g);
      const total = rows.reduce((s, r) => s + (r.count || 0), 0);
      return { name: g, zh: aliases[g] ?? g, en: occShortEn[g] || g, total, rows };
    }).sort((a, b) => b.total - a.total);

    const links = [];
    left.forEach(L => L.rows.forEach(r => {
      if ((r.count || 0) > 0) links.push({ ind: L.id, indName: L.name, occ: r.name, count: r.count, share: r.share });
    }));
    left.forEach((n, i) => { n.color = C()[i % C().length]; });

    const SW = 1200, SH = 720, padT = 30, padB = 26, gapL = 12, gapR = 10;
    const totalAll = left.reduce((s, n) => s + n.total, 0);
    const availH = SH - padT - padB;
    const scaleY = (availH - gapL * (left.length - 1)) / totalAll;
    let y = padT;
    left.forEach(n => { n.h = Math.max(n.total * scaleY, 3); n.y0 = y; n.y1 = y + n.h; y = n.y1 + gapL; });
    y = padT;
    right.forEach(n => { n.h = Math.max(n.total * scaleY, 3); n.y0 = y; n.y1 = y + n.h; y = n.y1 + gapR; });
    let prev = padT - 30;
    left.forEach(n => { n.labelY = Math.max((n.y0 + n.y1) / 2, prev + 30); prev = n.labelY; });
    prev = padT - 30;
    right.forEach(n => { n.labelY = Math.max((n.y0 + n.y1) / 2, prev + 30); prev = n.labelY; });

    left.forEach(L => {
      let cy = L.y0;
      right.forEach(R => {
        const l = links.find(x => x.ind === L.id && x.occ === R.name);
        if (l) { const h = Math.max(l.count * scaleY, 1); l.ly0 = cy; l.ly1 = cy + h; cy += h; }
      });
    });
    right.forEach(R => {
      let cy = R.y0;
      left.forEach(L => {
        const l = links.find(x => x.ind === L.id && x.occ === R.name);
        if (l) { const h = Math.max(l.count * scaleY, 1); l.ry0 = cy; l.ry1 = cy + h; cy += h; }
      });
    });

    const xL = 180, xR = 1010, nodeW = 10, xMid = (xL + xR) / 2;
    const nameFs = isEn ? 11.5 : 12.5;
    const linkPath = l =>
      `M ${xL} ${l.ly0} C ${xMid} ${l.ly0}, ${xMid} ${l.ry0}, ${xR} ${l.ry0} L ${xR} ${l.ry1} C ${xMid} ${l.ry1}, ${xMid} ${l.ly1}, ${xL} ${l.ly1} Z`;

    const occTotal = name => {
      const rows = d.occupations.filter(o => o.name === name);
      return selInds.size === 0
        ? rows.reduce((s, r) => s + (r.count || 0), 0)
        : rows.filter(r => selInds.has(r.id)).reduce((s, r) => s + (r.count || 0), 0);
    };

    const filtering = selInds.size > 0 || occActive || fitGroupSet.size > 0;
    let content = "";
    content += `<text x="${xL}" y="16" fill="var(--faint)" font-size="11" letter-spacing=".08em">${esc(t("行业", "Industry"))}</text>`;
    content += `<text x="${xR + nodeW + 10}" y="16" fill="var(--faint)" font-size="11" letter-spacing=".08em">${esc(t("职业组", "Occupation group"))}</text>`;

    links.forEach(l => {
      const indOk = selInds.size === 0 || selInds.has(l.ind);
      const occOk = occActive ? l.occ === occActive : (!fitGroupSet.size || fitGroupSet.has(l.occ));
      const active = indOk && occOk;
      const op = !filtering ? ".22" : active ? ".55" : ".05";
      const key = pathway.pairKey(l.ind, l.occ);
      const tip = `${l.indName} → ${label(l.occ)}\n${t("空缺", "Vacancies")} ${number(l.count)} · ${t("行业内占比", "within-industry share")} ${percent(l.share * 100)}`;
      const m = c.mark(tip, "vacancyCell", key, cell === key, "vacancyCell:" + key);
      content += `<path d="${linkPath(l)}" fill="${left.find(n => n.id === l.ind).color}" fill-opacity="${op}" data-op="${op}" ${m}/>`;
    });

    left.forEach(n => {
      const on = selInds.has(n.id);
      const dim = selInds.size > 0 && !on;
      const tip = `${n.name}\n${t("空缺", "Vacancies")} ${number(n.total)} · ${t("空缺率", "Vacancy rate")} ${percent(n.market.rate * 100)}`;
      const m = c.mark(tip, "bubble", n.id, on, "bubble:" + n.id);
      content += `<g ${m} style="opacity:${dim ? ".35" : "1"};cursor:pointer">
        <rect x="${xL}" y="${n.y0}" width="${nodeW}" height="${Math.max(n.h, 3)}" fill="${n.color}"/>
        <text x="${xL - 10}" y="${n.labelY - 2}" text-anchor="end" fill="var(--ink)" font-weight="680" font-size="${nameFs}" stroke="none">${esc(t(n.zh, n.en))}</text>
        <text x="${xL - 10}" y="${n.labelY + 13}" text-anchor="end" fill="var(--muted)" font-size="11" stroke="none" style="font-variant-numeric:tabular-nums">${number(n.total)}</text></g>`;
    });

    right.forEach(n => {
      const on = occActive === n.name || fitGroupSet.has(n.name);
      const dim = (occActive || fitGroupSet.size) && !on;
      const tip = `${label(n.name)} · ${number(occTotal(n.name))}`;
      const m = c.mark(tip, "sankeyOcc", n.name, on, "sankeyOcc:" + n.name);
      content += `<g ${m} style="opacity:${dim ? ".35" : "1"};cursor:pointer">
        <rect x="${xR}" y="${n.y0}" width="${nodeW}" height="${Math.max(n.h, 3)}" fill="var(--node)"/>
        <text x="${xR + nodeW + 10}" y="${n.labelY - 2}" fill="var(--ink)" font-weight="680" font-size="${nameFs}" stroke="none">${esc(t(n.zh, n.en))}</text>
        <text x="${xR + nodeW + 10}" y="${n.labelY + 13}" fill="var(--muted)" font-size="11" stroke="none" style="font-variant-numeric:tabular-nums">${number(occTotal(n.name))}</text></g>`;
    });

    return `<svg viewBox="0 0 ${SW} ${SH}" role="img" style="width:100%;height:auto;display:block;overflow:visible" aria-label="${esc(t("行业到职业组的空缺流向桑基图", "Sankey of vacancies from industries to occupation groups"))}">${content}</svg>`;
  }

  function vacancyPanel(taskGroups) {
    const picked = visibleIndustries();
    const {vacancyCell:cell,occupations} = state;
    const scope = occupations==="tasks" && !taskGroups.size ? "all" : occupations;
    const groups = pathway.occupationGroups.filter(name =>
      scope==="all" || scope===name || (scope==="tasks" && taskGroups.has(name)));
    const occupationScopes = taskGroups.size ? ["tasks","all",...pathway.occupationGroups] : ["all",...pathway.occupationGroups];
    const [activeId,activeGroup] = cell.split("|");
    const isVisible = d.demand.some(row=>row.id===activeId) && groups.includes(activeGroup);
    const active = isVisible && pathway.findVacancy(activeId,activeGroup);
    const market = d.demand.find(row=>row.id===activeId);
    const alreadyAdded = state.pairs.some(pair=>keyOf(pair)===cell);
    return `<section aria-labelledby="find-heading" id="hiring">
      <header class="subhead"><h2 id="find-heading">${t("哪里在招聘？","Where are the vacancies?")}</h2></header>
      ${controls(industryFilters(),select("occupations",t("职业组","Occupation group"),occupationScopes,v=>{
        if(v==="tasks") return t("任务卡所选职业组","Groups selected on task cards");
        return v==="all"?t("全部职业","All occupations"):label(v);
      },scope))}
      ${state.fitGroups.length ? `<div class="cross-banner" role="status">
        <span class="cross-tag">${t("测试推荐","Fit-based")}</span>
        <span class="cross-text">${t(`已按你的测试结果高亮 ${state.fitGroups.length} 个职业组及对应行业；清除后浏览全部空缺。`,`Highlighted ${state.fitGroups.length} matching groups and their industries from your quiz; clear to browse all vacancies.`)}</span>
        <button type="button" data-action="clearFit">${t("清除推荐","Clear fit")}</button></div>` : ""}
      ${hint("招聘空缺按行业大类统计。点左侧行业单选，按住 ⌘/Ctrl 多选；点右侧职业组反查；点流带查看该行业×职业组合，可加入比较并带到 02 页试算。",
        "Vacancies are reported by broad industry. Click an industry to select; hold ⌘/Ctrl to multi-select. Click an occupation group to filter; click a band to inspect an industry×occupation pair and add it to your comparison for chapter 02.")}
      ${figure("sankey",t("行业 × 职业空缺流向","Vacancy flow: industry to occupation"),
        t("2026Q2 · 流带宽度代表空缺人数","2026 Q2 · Band width shows vacancy count"),
        viz("sankey",()=>sankeyChart()),
        t("流带从左侧行业流向右侧职业组，带宽为该组合空缺人数；选中行业后，右侧职业人数按所选行业子集重算。",
          "Bands flow from industries on the left to occupation groups on the right; width shows vacancy count. Right-side occupation totals recompute for the selected industries."),
        {full:true})}
      <div class="decision evidence" aria-live="polite">
        ${active && market ? `<strong>${esc(pairTitle({id:activeId,occupation:activeGroup}))}</strong>
          <p>${number(active.count)} ${t("个职业组空缺","vacancies in this occupation group")} · ${vacancyShare(active)}
            ${t("占该行业全部空缺","of all vacancies in this industry")} · ${t("行业空缺率","Industry vacancy rate")} ${percent(market.rate*100)} · ${market.period}</p>
          <div class="chip-row">
            ${alreadyAdded ? `<span class="good">${t("已加入比较","In your comparison")}</span>` : chip("addPair",cell,t("加入比较","Add to comparison"))}
            ${picked.length===1 ? "" : chip("focusIndustry",activeId,t("筛选此行业","Filter to this industry"))}</div>`
          : `<p>${t("点一条流带查看招聘证据。","Select a band to inspect the hiring evidence.")}</p>`}
      </div></section>`;
  }

  function pairReview() {
    const pairs = state.pairs;
    const title = t("确认带入预算的方向","Choose options to test in your budget");
    return `<section class="card pair-review" aria-labelledby="pairs-heading"><h2 id="pairs-heading">${title}</h2>
      <p class="mode-note">${t(`已选 ${pairs.length} 个方向`,`${pairs.length} options selected`)}</p>
      ${pairs.length ? `<ul class="pair-list">${pairs.map(pair=>{
        const key = keyOf(pair);
        const evidence = pathway.findVacancy(pair.id,pair.occupation);
        return `<li><div><strong>${esc(pairTitle(pair))}</strong>
          <p>${number(evidence.count)} ${t("个职业组空缺","occupation vacancies")} · ${vacancyShare(evidence)} ${t("占行业空缺","of industry vacancies")}</p>
          <p>${esc(insight(pair))}</p></div>
          <div class="chip-row">${chip("removePair",key,t("移出清单","Remove"))}</div>
          <label class="field pair-note">${t("面试时我想问什么（选填）","What I want to ask at an interview (optional)")}
            <input type="text" data-note="${esc(key)}" maxlength="180" value="${esc(pair.note)}"
              placeholder="${t("例如岗位实际工时是多少？","For example, what are the actual working hours?")}"></label>
        </li>`;
      }).join("")}</ul>` : empty(t("选一个行业和职业组，就能在这里继续。","Choose an industry and occupation pair to continue."))}
      ${pairs.length ? `<div class="chapter-actions">
        ${chip("finishReview","all",t("用所选方向试算工资、工时和生活费","Test pay, hours and living costs for these options"))}</div>` : ""}
      </section>`;
  }

  function candidate(row) {
    const outgoings = state.rent+state.living+state.deduct;
    const surplus=Number.isFinite(row.pay50)?row.pay50-outgoings:null;
    const missing=![row.pay50,row.hours50,surplus].every(Number.isFinite);
    const issues = [
      Number.isFinite(row.pay50)&&row.pay50<state.targetPay?t("月薪低于目标","Pay below target"):null,
      Number.isFinite(row.hours50)&&row.hours50>state.maxHours?t("工时高于上限","Hours above limit"):null,
      Number.isFinite(surplus)&&surplus<state.targetSurplus?t("月结余低于目标","Surplus below target"):null,
      missing?t("缺少工资或工时数据","Pay or hours data missing"):null,
    ].filter(Boolean);
    return {...row,surplus,issues,match:!issues.length,missing};
  }

  function intervals(rows, type, selectedIndustries) {
    const median = type+"50";
    const orderedRows = rows.slice().sort((a,b)=>{
      const first = a[median] ?? -Infinity;
      const second = b[median] ?? -Infinity;
      return first===second ? 0 : second-first;
    });
    const pay=type==="pay", target=pay?state.targetPay:state.maxHours;
    const step=pay?10000:10;
    const upper=Math.max(pay?50000:60,target, ...rows.map(r=>r[type+"75"] ?? 0));
    const upperTick=Math.ceil(upper/step)*step;
    const low=pay?0:Math.min(30,target,...rows.map(r=>r.hours25 ?? 30));
    const high = upperTick===low ? upperTick+step : upperTick;
    const position=v=>((v-low)/(high-low)*100);
    const shortTarget=pay?money(target):number(target)+t(" 小时"," hours");
    const targetName=pay?t("期望月薪","Target monthly pay"):t("期望每周工时上限","Weekly hours limit");
    return `<div class="legend"><span><i style="background:#cdb5de"></i>P25–P75</span><span><i style="background:${R()}"></i>P50</span>
      <span class="range-target-legend"><i class="range-target-swatch" aria-hidden="true"></i>${targetName} ${shortTarget}</span>
      <span><i class="range-selection-key"></i>${t("已确认方向所属行业","Industry covering a confirmed option")}</span></div>
      ${orderedRows.map(r=>{
        const selected=selectedIndustries.has(r.id);
        const a=r[type+"25"], m=r[type+"50"], b=r[type+"75"];
        const tip=label(r.name)+" · "+[a,m,b].map(number).join(" / ")+" · "+(pay?t("港元／月","HKD/month"):t("小时／周","hours/week"));
        return `<div class="range-lane${selected?" range-highlight":""}"><span class="range-name">${esc(label(r.name))}
          ${selected?`<span class="visually-hidden">${t("已确认方向所属行业","Industry covering a confirmed option")}</span>`:""}</span><div class="range-track">
          ${[a,b].every(Number.isFinite)?`<span class="range-band" style="left:${position(a)}%;width:${position(b)-position(a)}%" data-tip="${esc(tip)}"></span>`:""}
          <span class="range-ref" aria-hidden="true" style="left:${position(target)}%"></span>
          ${Number.isFinite(m) ? `<button type="button" class="range-point" style="left:${position(m)}%" data-tip="${esc(tip)}" aria-label="${esc(tip+(pay?t(" · 带入预算"," · Use in budget"):""))}"
              ${pay?` data-action="offerMedian" data-value="${m}" data-focus="${esc("offerMedian:"+m+":"+r.name)}"`:""}></button>
            <span class="range-value${position(m)>68?" left":""}" style="left:${position(m)}%">${number(m)}</span>` : `<span class="range-value">${t("缺测","No data")}</span>`}
          </div></div>`;
      }).join("")}
      <div class="range-axis">${span(0,4).map(i=>`<span>${number(low+(high-low)*i/4)}</span>`).join("")}</div>`;
  }

  function shortlistTable(options) {
    const conditionLabel = segment => segment.match ? t("三项达标","Meets all three criteria")
      : segment.missing ? t("待补资料","Data needed") : t("未达条件","Below criteria");
    const maxCount = Math.max(1,...options.map(o=>o.vacancy.count??0));
    const surplusVals = options.flatMap(o=>o.segments.map(s=>s.surplus)).filter(Number.isFinite);
    const surplusScale = Math.max(1,...surplusVals,state.targetSurplus);
    const barPct = (v,max)=>Math.max(0,Math.min(100,Math.round(v/max*100)));
    return `<div class="table-scroll" tabindex="0" aria-label="${t("候选方向对照，可横向滚动","Shortlist comparison, scrolls horizontally")}">
      <table class="compact-table viz-table"><thead><tr>
        <th scope="col">${t("行业 × 职业组","Industry × occupation")}</th>
        <th scope="col">${t("职业组空缺<br>数量／行业内占比","Occupation vacancies<br>Count / industry share")}</th>
        <th scope="col">${t("细分行业 P50<br>月薪／周工时","Industry-segment medians<br>Pay / weekly hours")}</th>
        <th scope="col">${t("估算月结余<br>条长＝相对目标","Estimated surplus<br>Bar vs target")}</th>
        <th scope="col" class="status-cell">${t("生活条件与个人线索","Criteria and personal rationale")}</th></tr></thead>
      <tbody>${options.map(option=>{
        const {pair,vacancy,market,segments,match,missing} = option;
        const multiple = segments.length>1;
        return `<tr data-pair="${esc(keyOf(pair))}"><th scope="row">${esc(pairTitle(pair))}</th>
          <td><div class="cell-num">${number(vacancy.count)} <span class="cell-share">/ ${vacancyShare(vacancy)}</span></div>
            <div class="mini-bar"><i style="width:${barPct(vacancy.count??0,maxCount)}%"></i></div>
            <span class="subcell">${market.period}</span></td>
          <td>${segments.flatMap(segment=>[multiple ? `<span class="subcell">${esc(label(segment.name))}</span>` : "",
            `<div class="cell-num">${money(segment.pay50)} <span class="cell-share">/ ${number(segment.hours50)} ${t("小时","h")}</span></div>`]).join("") || "—"}</td>
          <td>${segments.map(segment=>{
            if(!Number.isFinite(segment.surplus)) return `<div class="cell-num">—</div>`;
            return `<div class="surplus-row${multiple?" multi":""}">
              ${multiple?`<span class="subcell">${esc(label(segment.name))}</span>`:""}
              <div class="surplus-num">${money(segment.surplus)}</div>
              <div class="surplus-bar"><i class="${segment.match?"is-good":"is-bad"}" style="width:${barPct(segment.surplus,surplusScale)}%"></i></div>
            </div>`;
          }).join("") || "—"}</td>
          <td class="status-cell"><strong class="${match?"good":"check"}">
            ${match?(multiple?t("有细分行业达标","One or more segments meet criteria"):t("三项达标","Meets all three criteria"))
              :missing?t("待补资料","Data needed"):t("未达条件","Below criteria")}</strong>
            <span class="subcell">${esc(insight(pair))}</span>
            <details class="option-details"><summary>${t("核查依据","Evidence and next checks")}</summary>
              <p>${t("行业大类空缺率","Broad-industry vacancy rate")} ${percent(market.rate*100)} · ${t("用工同比","Employment YoY")} ${percent(market.yoy*100)}</p>
              ${segments.map(segment=>`<p>${esc(label(segment.name))} · ${conditionLabel(segment)}
                ${segment.issues.length ? " · "+esc(segment.issues.join(" · ")) : ""}<br>
                ${t("P25–P75 月薪","P25–P75 pay")} ${money(segment.pay25)}–${money(segment.pay75)} ·
                ${t("周工时","Weekly hours")} ${number(segment.hours25)}–${number(segment.hours75)}<br>
                ${esc(mapping(segment.mapping,label(market.name)))}</p>`).join("")}
              <p>${t("求职核查","Question to verify")} · ${esc(pair.note || t("确认实际薪酬、职级和工时","Verify actual pay, job grade and hours"))}</p>
            </details>
          </td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  const industrySegments = [...new Map(d.pay.map(({name,id})=>[name,{name,id}])).values()];
  const segmentsFor = ids => industrySegments.filter(row=>!ids.length||ids.includes(row.id));
  const visibleIndustries = () => state.industryDetails.length
    ? unique(segmentsFor(state.selected).filter(r=>state.industryDetails.includes(r.name)).map(r=>r.id))
    : state.selected;
  const hasIndustryFilter = () => state.selected.length>0 || state.industryDetails.length>0;

  function setIndustryFilter(ids, details = state.industryDetails) {
    state.selected=ids;
    const allowed = new Set(segmentsFor(ids).map(row=>row.name));
    state.industryDetails=details.filter(name=>allowed.has(name));
    state.budgetScope=true;
  }

  function industryFilters() {
    const broad = d.demand.map(row=>[row.id,label(row.name)]);
    const visible = visibleIndustries();
    return select("hiringIndustry",t("快速选一个行业","Quick pick (one industry)"),
      visible.length>1?["all","multiple",...broad.map(([id])=>id)]:["all",...broad.map(([id])=>id)],
      id=>id==="all"?t("全部行业","All industries"):id==="multiple"?t("已多选行业","Multiple industries selected"):industryName(id),
      visible.length>1?"multiple":visible[0]??"all")
      + (hasIndustryFilter()?chip("resetIndustryFilters","all",t("恢复全部行业","Show all industries")):"");
  }

  function fit() {
    const confirmed = state.pairs.filter(pair=>pair.kept);
    const editLink = `<a class="secondary-link" href="#hiring">${t("返回 01 调整招聘筛选","Edit hiring filters in chapter 01")}</a>`;
    const selectedIndustries = new Set(confirmed.map(pair=>pair.id));
    const filtered = hasIndustryFilter() && state.budgetScope;
    const visible = visibleIndustries();
    const chosen = d.demand.filter(r=>filtered?visible.includes(r.id):!confirmed.length||selectedIndustries.has(r.id));
    const referenceRows = d.pay.filter(r=>r.year===state.payYear && (!filtered ||
      visible.includes(r.id) && (!state.industryDetails.length || state.industryDetails.includes(r.name))));
    const rows = referenceRows.filter(r=>selectedIndustries.has(r.id)).map(candidate);
    const options = confirmed.filter(pair=>!filtered||visible.includes(pair.id)).map(pair=>{
      const vacancy = pathway.findVacancy(pair.id,pair.occupation);
      const market = d.demand.find(row=>row.id===pair.id);
      const segments = rows.filter(row=>row.id===pair.id);
      const match = segments.some(row=>row.match);
      const missing = !segments.some(row=>!row.missing);
      const comparisons = match ? segments.filter(row=>row.match) : segments;
      const maxSurplus = Math.max(-Infinity,...comparisons.map(row=>row.surplus ?? -Infinity));
      return {pair,vacancy,market,segments,match,missing,maxSurplus};
    });
    const ranked = options.sort((a,b)=>Number(b.match)-Number(a.match)||Number(a.missing)-Number(b.missing)
      ||(state.sortBy==="vacancies" ? (b.vacancy.count ?? -1)-(a.vacancy.count ?? -1)
        : b.maxSurplus-a.maxSurplus));
    const matched = ranked.filter(option=>option.match);
    const budget = state.offer-state.rent-state.living-state.deduct;
    const end = Math.max(...d.history.map(r=>historyX(r.period)));
    const history = chosen.map((industry,i)=>{
      const data = d.history.filter(r=>r.id===industry.id&&historyX(r.period)>=state.startYear)
        .map(r=>[historyX(r.period),r.value,`${label(industry.name)} · ${r.period} · ${t("指数","Index")} ${number(r.value)}`])
        .sort((a,b)=>a[0]-b[0]);
      return lineSet(label(industry.name),data,C()[i%C().length],i%3===1);
    });
    const status = matched.length ? t("优先查证","Investigate first")+" · "+list(matched.map(option=>pairTitle(option.pair)))
      : !confirmed.length ? t("从 01 页确认方向后，候选表就会生成。","Confirm options in chapter 01 to populate your shortlist.")
      : !ranked.length ? t("当前筛选范围内没有已确认方向。","No confirmed options in the current filters.")
      : t("目前没有同时满足三项条件的方向。","No options meet all three criteria.");
    const profile = state.profile;
    const tags = [profile.major,profile.minor].map(key=>pathway.nameOf(pathway.majors,key)).filter(Boolean)
      .concat(profile.interests.map(key=>pathway.nameOf(pathway.interests,key)),
        profile.skills.map(key=>pathway.nameOf(pathway.skills,key)));
    const filterNames = list(state.industryDetails.length ? state.industryDetails.map(label) : visible.map(industryName));
    return heading(pages[2],2) + stats(
      [ranked.length,t("当前视图中的已确认方向","Confirmed options in view")],
      [matched.length,t("至少一个细分行业满足三项条件","At least one segment meets all three criteria")],
      [money(budget),t("按当前 Offer 估算的月结余","Monthly surplus with the current offer")])
      + `<div class="decision" aria-live="polite"><strong>${esc(status)}</strong>
        ${hasIndustryFilter() ? `<p>${filtered
          ? `${t("沿用 01 页行业筛选","Using chapter 01 industry filters")} · ${esc(filterNames)}`
          : t("当前展示全部行业参考和已确认方向。","Showing all industry references and confirmed options.")}</p>
          ${filtered && confirmed.length>ranked.length ? `<p>${t(`已确认 ${confirmed.length} 个方向，当前筛选显示 ${ranked.length} 个。`,
            `${ranked.length} of ${confirmed.length} confirmed options are in view.`)}</p>` : ""}` : ""}
        ${state.pairs.length>confirmed.length ? `<p>${t("有新选方向待带入试算。可以回清单确认。","New options are ready to add. Confirm them from the shortlist.")}</p>` : ""}
        ${tags.length ? `<p>${t("个人线索","My profile")} · ${esc(list(tags))}</p>` : ""}
        ${profile.keywords ? `<p>${t("自定义求职搜索词","My job-ad keywords")} · ${esc(profile.keywords)}</p>` : ""}
        <div class="chapter-actions">${editLink}
          ${hasIndustryFilter() ? chip("budgetScope","toggle",filtered?t("显示全部行业与候选","Show all industries and options")
            :t("应用 01 页筛选","Apply chapter 01 filters")) : ""}
          <a class="secondary-link" href="#shortlist">${t("返回已选清单","Return to my shortlist")}</a>
          <a class="secondary-link" href="#shortlist-heading" data-scroll="shortlist-heading">${t("跳至候选表","Jump to shortlist")}</a>
          ${confirmed.length?"":chip("case","jia",t("载入嘉宁的演示方案","Load Jia Ning’s example"))}</div></div>`
      + `<section aria-labelledby="conditions-heading"><header class="subhead"><h2 id="conditions-heading">${t("待遇能否支撑留港？","Would the pay and hours work for me?")}</h2></header>`
      + `<form class="control-bar" data-budget-form>${select("payYear",t("工资参考年","Pay reference year"),span(2016,2025).reverse())}
        ${budgetField("targetPay",t("期望月薪（港元）","Target monthly pay (HKD)"),1)}${budgetField("maxHours",t("期望每周工时上限","Weekly hours limit"),.1)}
        ${budgetField("targetSurplus",t("期望月结余（港元）","Target monthly surplus (HKD)"),1)}
        <button class="chip apply-budget" type="submit" id="apply-targets">${t("更新目标","Apply criteria")}</button></form>`
      + hint(`两图当前展示 ${referenceRows.length} 个调查细分行业，${rows.length} 个高亮细分行业属于已确认方向。`,
        `Both charts show ${referenceRows.length} surveyed industry segments. The ${rows.length} highlighted segments cover confirmed options.`)
      + grid(
        figure("pay-range",t("月薪分位区间","Monthly pay range"),t(`${state.payYear} 年 5–6 月 · 全职雇员 · 港元／月`,`May–June ${state.payYear} · Full-time employees · HKD/month`),
          intervals(referenceRows,"pay",selectedIndustries),t("浅紫线段是第 25 至 75 百分位，保留行业中间一半的范围；圆点是中位数。点圆点可将该行业月薪带入预算。",
            "The pale band runs from the 25th to the 75th percentile, covering the middle half. The dot is the median. Select it to use that value in the budget.")),
        figure("hours-range",t("每周工时区间","Weekly hours range"),t(`${state.payYear} 年 5–6 月 · 全职雇员 · 小时／周`,`May–June ${state.payYear} · Full-time employees · Hours/week`),
          intervals(referenceRows,"hours",selectedIndustries),t("虚线是你设定的每周工时上限。即使中位数达标，仍可用整个区间判断是否要在面试中先问加班。",
            "The dashed line marks your weekly hours limit. Read the full range to decide whether to ask about overtime, even if the median fits.")))
      + `<div class="grid wide-pair budget-history">`
      + figure("budget",t("个人生活预算","Monthly budget"),t("可编辑示例 · 港元／月","Editable scenario · HKD per month"),
          `<form class="control-bar" data-budget-form>${budgetField("offer",t("Offer 月薪","Monthly offer"),1)}${budgetField("rent",t("每月房租","Monthly rent"),1)}
          ${budgetField("living",t("生活交通","Living and transport"),1)}${budgetField("deduct",t("预留扣款","Set-aside for deductions"),1)}
          <button class="chip apply-budget" type="submit" id="apply-budget">${t("更新预算","Apply budget")}</button></form>`
          +viz("budget-waterfall",w=>c.waterfall(w,state)),
          t("从 Offer 月薪扣去三项开支。预留扣款由你填写；可把预计税款和强积金统一填入，实际金额以适用规定和合约为准。",
            "The budget subtracts three expenses from the assumed offer. Enter your own allowance for items such as tax and MPF. Actual deductions depend on the applicable rules and contract."))
      + figure("history",t("哪些行业用工在扩张？","Where is industry employment growing?"),t("季度指数 · 以 2016Q1 为 100 · 按累计变化排序","Quarterly index · 2016 Q1 = 100 · sorted by total change"),
          viz("history-opportunity",w=>c.opportunity(w,history)),
          t("条形方向和长度表示该行业从起始年到最新季度的用工累计变化：向右绿色为扩张、向左红色为收缩，旁边的迷你走势展示完整过程。用工扩张通常意味着岗位更活跃，但不能据此估计个人失业风险。",
            "Bars show each industry’s cumulative change from the start year to the latest quarter: green to the right is growth, red to the left is contraction, with a sparkline showing the full path. Growing employment usually means more active hiring, but it does not estimate personal unemployment risk."),
          {control:select("startYear",t("历史起始年","History start year"),span(2016,2025))})
      + `</div></section><section aria-labelledby="shortlist-heading"><header class="subhead"><h2 id="shortlist-heading">${t("哪些方向值得优先查证？","Which options should I investigate first?")}</h2></header>`
      + grid(
        figure("candidates",t("候选方向对照","Shortlist comparison"),t("三项门槛都达到的方向排在前面","Options that meet all three criteria appear first"),
          ranked.length?shortlistTable(ranked):empty(status),
          t("招聘按行业和职业组统计。薪酬与工时按细分行业的全职雇员统计。表中按行业月薪 P50 估算结余，预算图使用输入的 Offer。",
            "Vacancies are reported by industry and occupation. Pay and hours cover full-time employees in each industry segment. The table estimates surplus from industry median pay. The budget uses your entered offer."),
          {control:select("sortBy",t("同组内排序","Sort within result"),["surplus","vacancies"],
            v=>v==="surplus"?t("按估算月结余","Estimated surplus"):t("按职业组空缺数","Occupation vacancy count")),full:true}))
      + "</section>";
  }

  function sources() {
    const hk = (code,zh,en)=>`<a href="https://www.censtatd.gov.hk/en/web_table.html?id=${code}">${code} · ${t(zh,en)}</a>`;
    return `<header class="chapter-header"><h1>${t("数据来源与统计口径","Data and methods")}</h1>
    <p>${t("图表来自整合工作簿中的原项目数据及新增官方数据。两地数据按各自调查范围和观察期展示。",
      "Charts use the original project extracts and new official figures in the consolidated workbook. Figures follow the coverage and period of their source surveys.")}</p></header>
    <section class="card source-card">
      <h3>${t("两地对照","Two markets")}</h3>
      <ul><li>${t("年龄结构图的走势示意采用原项目 2010 年曲线为基线，各时期的点位为模拟。",
        "The age chart’s illustration uses the original project’s 2010 curves as a baseline and simulates small changes across periods.")}</li>
      <li>${t("分行业年龄图使用内地城镇口径。2024 年数据来自城镇劳动力调查，合并行业按就业占比加权。2025 全年及 2026 年 1–6 月占比按 2023 至 2024 年的变化幅度线性外推。",
        "The industry age chart uses urban Mainland data. The 2024 observations come from the urban labour force survey. Combined industries are weighted by employment share. Figures for full-year 2025 and January–June 2026 extrapolate the 2023–2024 change linearly.")}
      <a href="https://dashboard.laodongqushi.com/yearbook/2024/">${t("《中国劳动统计年鉴 2024》表 1-49、1-50","China Labour Statistical Yearbook 2024, Tables 1-49 and 1-50")}</a> ·
      <a href="https://dashboard.laodongqushi.com/yearbook/2025/">${t("《中国劳动统计年鉴 2025》表 2-17、2-18","China Labour Statistical Yearbook 2025, Tables 2-17 and 2-18")}</a></li>
      <li>${t("香港使用相同统计时期的综合住户调查。2026 年 1–6 月合并第一、第二季度就业人数后计算占比。香港分行业表把 25–39 岁合为一组，按同期全港 25–39 岁就业者中 35–39 岁的比例分配，再加上行业 40 岁及以上人数。细行业按同期就业人数加权拆分，使用原项目 2021 年香港行业间的 35 岁及以上占比差作参照。「其他」组两地覆盖范围有差异。",
        "Hong Kong uses the General Household Survey for the same periods. January–June 2026 shares are calculated from combined first- and second-quarter counts. For each industry, the 35–39 share of its 25–39 group is allocated using the same-period citywide age mix, then added to the industry’s published 40+ count. Detailed industries are split using current employment weights and the original project’s 2021 Hong Kong age-35+ gaps as a reference. Coverage of the Other group differs across markets.")}
      ${hk("210-06301","香港分年龄就业人数","Hong Kong employment by age")} ·
      ${hk("210-06305","香港分细行业就业人数","Hong Kong employment by detailed industry")} ·
      ${hk("210-06306","香港按行业及年龄划分的就业人数","Hong Kong employment by industry and age")}</li>
      <li>${hk("210-06201","香港政府统计处劳动人口表","Hong Kong C&SD labour force table")}${t("提供劳动人口背景。两地行业、年龄定义及年份见整合 Excel 的「00_口径限制」。",
        " provides labour force context. See the consolidated workbook’s 00 methods sheet for definitions and reference years.")}</li>
      <li><a href="https://www.stats.gov.cn/sj/xwfbh/fbhwd/202601/t20260119_1962330.html">${t("国家统计局 · 2025 年就业形势","National Bureau of Statistics · 2025 employment conditions")}</a> ·
        <a href="https://data.stats.gov.cn/easyquery.htm?cn=A01">${t("国家数据 · 月度分年龄失业率","National Data · Monthly unemployment by age")}</a> ·
        ${hk("210-06401","香港分年龄失业率","Hong Kong unemployment by age")}${t("。内地为 2025 年 12 月，香港为第四季度、未经季调。",". Mainland figures refer to December 2025. Hong Kong figures refer to Q4, unadjusted.")}</li>
      <li><a href="https://www.sz.gov.cn/attachment/1/1703/1703629/12735140.pdf">${t("深圳市人社局工资价位（第一部分，页 5、15–16）","Shenzhen wage benchmark report (Part I, pp. 5, 15–16)")}</a> ·
        <a href="https://www.censtatd.gov.hk/wbr/B1050014/B10500142024AN24/att/en/B10500142024AN24.pdf">${t("香港政府统计处 2024 年收入及工时调查（表 6.10）","Hong Kong C&SD 2024 Annual Earnings and Hours Survey (Table 6.10)")}</a> ·
        <a href="${wageRateSource}">${t("2024 年平均汇率","2024 average exchange rate")}</a>${t("。深圳是 2024 年全年工资除以 12，香港是 2024 年 5–6 月调查期月薪。两地均显示人民币和港元，原调查的工资构成和覆盖范围有差异。",
          ". Shenzhen is full-year 2024 pay divided by 12. Hong Kong is the monthly wage from the May–June survey. Both are displayed in CNY and HKD. The underlying surveys differ in wage components and coverage.")}</li></ul>
      <h3>${t("香港就业构成","Hong Kong employment structure")}</h3>
      <p>${t("就业规模、行业占比、雇佣身份和职业构成来自整合 Excel 的 <code>01_01</code>、<code>01_02</code> 工作表。",
        "Employment levels, industry shares, employment status and occupational mix come from sheets <code>01_01</code> and <code>01_02</code>.")}</p>
      <h3>${t("求职方向探索","Job options")}</h3>
      <ul><li>${hk("215-16001","机构就业及空缺","Establishment employment and vacancies")} · ${hk("215-16007","行业 × 职业空缺","Vacancies by industry and occupation")}${t("。需求截面为 2026Q2，只涵盖调查行业，不含公务员。",
        ". The demand snapshot is 2026 Q2 and covers surveyed industries, excluding civil servants.")}</li>
      <li>${hk("220-23015","全职月薪分布","Full-time monthly pay distribution")} · ${hk("220-23034","全职工时分布","Full-time working hours distribution")}${t("。采用 2016–2025 年各年 5–6 月数据。大类和细分行业对应关系见项目数据说明。",
        ". These use May–June observations for 2016–2025. The project notes explain the mappings between broad industries and detailed segments.")}</li>
      <li>${t("行业空缺率以就业人数加空缺人数为分母。流向图中职业组占比以所在行业的全部空缺为分母。",
        "The industry vacancy rate divides vacancies by employment plus vacancies. The flow chart divides each occupation’s vacancies by all vacancies in its industry.")}</li>
      <li>${t("考察细分行业时使用 P50。同一个组合有多个细分行业，可以逐项查看。达标项优先，同组内可按估算结余或职业组空缺数排序，缺资料项排后。",
        "Each segment is assessed at P50. Expand a pair to inspect its segments. Options meeting the criteria appear first. Sort within each outcome by estimated surplus or vacancy count. Options with missing evidence appear last.")}</li>
      <li>${t("专业、兴趣和技能通过项目整理的工作任务规则提供探索线索。候选组合由用户确认，信息保存在当前浏览器标签页的会话内。",
        "Project-curated task rules suggest occupations from your studies, interests and skills. You choose the options, and your inputs stay in this tab’s browser session.")}</li></ul>
      <h3>${t("项目参考","Project reference")}</h3><p>${t("图表卡片和市场探索的呈现参考组员的","Chart cards and the market exploration layout draw on the team’s")}
        <a href="https://github.com/ketianli082-stack/hong-kong-job-market-explorer">Hong Kong Job Market Explorer</a>${t("。嘉宁是演示用的虚构人物。",
        ". Jia Ning is fictional.")}</p>
    </section>`;
  }

  function heading(page,index,id="") {
    return `<header class="chapter-header"${id?` id="${id}"`:""}><div class="eyebrow">${mk(index)} / ${page.title}</div>
      <h1>${page.question}</h1><p>${page.summary}</p></header>`;
  }

  const renderPage = {markets,structure,fit,sources};

  function renderInterface() {
    const title = t("香港就业市场探索器","Hong Kong Graduate Career Explorer");
    document.documentElement.lang = language.code();
    document.title = t("毕业后，留在香港？","After graduation, stay in Hong Kong?") + " | " + title;
    document.querySelector('meta[name="description"]').content = t(
      "跟着嘉宁了解两地就业年龄结构、青年失业率和深港月薪，再探索香港岗位并试算个人预算。",
      "Explore two labour markets with Jia Ning, then test which Hong Kong job options fit your priorities.");
    $("language").value = language.code();
    $("chapters").setAttribute("aria-label",t("章节","Chapters"));
    $("brand-title").textContent = title;
    $("footer-title").textContent = title;
    $("skip-link").textContent = t("跳至图表","Skip to charts");
    $("source-link-text").textContent = t("数据与统计口径","Data and methods");
    $("language-label").textContent = t("语言","Language");
    $("top-action-text").textContent = t("探索求职方向","Explore job options");
    $("footer-sources").textContent = t("数据来源与使用说明","Data sources and notes");
    const themeBtn = $("theme-toggle");
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", guideTheme.isDark()
        ? t("切换到浅色主题","Switch to light theme")
        : t("切换到深色主题","Switch to dark theme"));
    }
  }

  function animateNumbers() {
    main.querySelectorAll(".stats .stat strong").forEach(el=>{
      const raw = el.textContent;
      const m = raw.match(/([\d,]+\.?\d*)/);
      if (!m) return;
      const target = parseFloat(m[1].replace(/,/g,""));
      if (!Number.isFinite(target) || target === 0) return;
      const decimals = (m[1].split(".")[1] || "").length;
      const prefix = raw.slice(0, m.index), suffix = raw.slice(m.index + m[1].length);
      const dur = 620, t0 = performance.now();
      const frame = now => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (target * eased).toLocaleString("en-US",
          { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  function toggleCross(next) {
    const cur = state.cross;
    state.cross = (cur && cur.kind===next.kind && String(cur.key)===String(next.key)) ? null : next;
  }
  function applyCross() {
    main.querySelectorAll(".is-dim,.is-hl").forEach(el=>el.classList.remove("is-dim","is-hl"));
    const cross = state.cross;
    if(!cross) return;
    const focused = state.overviewIndustry!==null && state.overviewIndustry!==undefined;
    const lineGroups = [...main.querySelectorAll("#employment .series-g")];
    const bandEls = [...main.querySelectorAll("#industry .stack-band, #industry .stack-line")];
    const tiles = [...main.querySelectorAll("#occupation .tree-tile")];
    const slices = [...main.querySelectorAll("#employment-status .donut-slice, #employment-status .donut-legend li")];
    if(cross.kind==="status") {
      slices.forEach(el=>el.classList.add(el.dataset.status===cross.key?"is-hl":"is-dim"));
      return;
    }
    if(cross.kind==="occ") {
      tiles.forEach(el=>el.classList.add(el.dataset.occ===cross.key?"is-hl":"is-dim"));
      const bands = occTopBands(cross.key).map(String);
      if(bands.length && !focused) {
        lineGroups.forEach(g=>{if(g.dataset.ind!=="")g.classList.add(bands.includes(g.dataset.ind)?"is-hl":"is-dim");});
        bandEls.forEach(el=>el.classList.add(bands.includes(el.dataset.ind)?"is-hl":"is-dim"));
      }
      return;
    }
    if(cross.kind==="ind") {
      const key=String(cross.key);
      if(!focused) {
        lineGroups.forEach(g=>{if(g.dataset.ind!=="")g.classList.add(g.dataset.ind===key?"is-hl":"is-dim");});
        bandEls.forEach(el=>el.classList.add(el.dataset.ind===key?"is-hl":"is-dim"));
      }
      const occs = bandTopOccs(cross.key);
      if(occs.length) tiles.forEach(el=>el.classList.add(occs.includes(el.dataset.occ)?"is-hl":"is-dim"));
    }
  }
  function crossBanner() {
    const cross=state.cross;
    if(!cross) return "";
    const bandNames=[...new Set(d.structure.filter(r=>r.kind==="industry_share").map(r=>r.name))];
    let tag, text;
    if(cross.kind==="occ") {
      const names=occToInds(cross.key).slice(0,3).map(ind=>{
        const row=d.demand.find(r=>r.id===ind);
        return row?label(row.name):ind;
      });
      tag=label(cross.key);
      text=t(`空缺主要集中在 ${names.join("、")}；旁边行业图已同步高亮。`,
        `Vacancies concentrate in ${names.join(", ")}; the industry charts are highlighted.`);
    } else if(cross.kind==="ind") {
      const names=bandTopOccs(cross.key).map(o=>label(o));
      tag=label(bandNames[cross.key]);
      text=t(`该行业空缺主要对应这些职业组：${names.join("、")}；职业构成图已同步高亮。`,
        `Vacancies here mainly map to: ${names.join(", ")}; the occupation chart is highlighted.`);
    } else {
      tag=label(cross.key);
      text=t("已选中该身份，其余身份已变淡；身份与行业/职业没有交叉口径，故仅在本图高亮。",
        "This status is selected and others are dimmed. No cross-tab with industry or occupation exists, so only this chart highlights.");
    }
    return `<div class="cross-banner" role="status"><span class="cross-tag">${esc(tag)}</span><span class="cross-text">${esc(text)}</span><button type="button" data-action="clearCross">${t("清除联动","Clear")}</button></div>`;
  }
  function render(focusKey) {
    pathway.save(state);
    for(const details of main.querySelectorAll("details[data-persist-open]")) {
      if(details.open) openPanels.add(details.id);
      else openPanels.delete(details.id);
    }
    observers.forEach(ob => ob.disconnect());
    observers = [];
    charts.clear();
    tooltip.hidden=true;
    const activePage=pages.find(p=>p.id===chapter);
    const title=activePage?.title ?? t("数据与统计口径","Data and methods");
    $("breadcrumb").innerHTML = `${t("探索路径","Explorer")} <span aria-hidden="true">/</span> ${title}`;
    $("chapters").className="chapter-nav";
    $("chapters").innerHTML=pages.map((p,i)=>`<a href="#${p.id}"${p.id===chapter?' aria-current="page"':""}>
      <span class="nav-number">${mk(i)}</span><span><strong>${p.title}</strong><small>${p.subtitle}</small></span></a>`).join("");
    main.innerHTML=renderPage[chapter]();
    for(const details of main.querySelectorAll("details[data-persist-open]")) {
      details.open = openPanels.has(details.id);
    }
    main.querySelectorAll("[data-chart]").forEach(el=>{
      const callback=charts.get(el.dataset.chart);
      let last=0;
      const draw=()=>{
        const w=Math.floor(el.clientWidth);
        if(w>0 && w!==last) { last=w; el.innerHTML=callback(w); }
      };
      draw();
      const observer=new ResizeObserver(draw);
      observer.observe(el);
      observers.push(observer);
    });
    const updated=focusKey && (document.getElementById(focusKey) || [...main.querySelectorAll("[data-focus]")].find(el=>el.dataset.focus===focusKey));
    if(updated) updated.focus({preventScroll:true});
    animateNumbers();
    applyCross();
    if(main.querySelector("[data-quiz]")) initQuiz();
    else clearQuizTimer();
  }

  function route() {
    stopPlay();
    const id=location.hash.slice(1);
    if(id==="content") { main.focus(); return; }
    const anchors = new Map([
      ["shortlist",["structure","pairs-heading"]], ["review",["structure","pairs-heading"]],
      ["hiring",["structure","hiring"]], ["profile-heading",["structure","profile-heading"]],
      ["market-compare",["markets","market-compare"]], ["risk",["markets","risk-heading"]],
      ["ages",["markets","ages"]], ["industry-age",["markets","industry-age"]],
      ["equity",["markets","pay-comparison"]],
      ["pay-comparison",["markets","pay-comparison"]],
    ]);
    const anchor = anchors.get(id);
    const match=anchor?.[0] ?? (Object.hasOwn(renderPage,id) ? id : "markets");
    if(match===chapter && !anchor) return;
    chapter=match;
    render();
    const target = anchor && $(anchor[1]);
    if(target) target.scrollIntoView({block:"start"});
    else window.scrollTo(0,0);
    main.focus({preventScroll:true});
  }

  function toggleIndustry(selected,id,multiple) {
    return multiple
      ? selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]
      : selected.length===1&&selected[0]===id?[]:[id];
  }
  function loadExampleProfile() {
    state.profile=pathway.exampleProfile();
    state.taskOccupations=pathway.exampleTaskOccupations();
    state.occupations="tasks";
  }
  function action(e,el) {
    const key=el.dataset.action, value=el.dataset.value;
    if(key==="startOwn") {
      state.pairs=[];
      state.vacancyCell="";
      pathway.save(state);
      location.hash="structure";
      return;
    }
    if(key==="marketAge") state.marketAge=value;
    if(key==="marketRegion") state.marketRegion=state.marketRegion===value?"":value;
    if(key==="marketIndustry") {
      state.marketIndustry=state.marketIndustry===value?"":value;
      state.wageIndustry="";
    }
    if(key==="wageIndustry") {
      state.wageIndustry=state.wageIndustry===value?"":value;
      state.marketIndustry=wageAgeGroups[state.wageIndustry] ?? "";
    }
    if(key==="resetWageRate") state.wageRate=defaultWageRate;
    if(key==="playTimeline") { togglePlay(); return; }
    if(key==="clearCross") { state.cross=null; }
    if(key==="clearFit") { clearFit(); setIndustryFilter([],[]); state.occupations="all"; state.vacancyCell=""; }
    if(key==="overviewYear") {
      const [year,industry] = value.split("|").map(Number);
      if (year<2016) return;
      state.overviewYear=year;
      if (industry!==undefined) toggleCross({kind:"ind",key:industry});
    }
    if(key==="overviewBand") {
      const [index,year] = value.split("|").map(Number);
      if(year>=2016) state.overviewYear=year;
      toggleCross({kind:"ind",key:index});
    }
    if(key==="overviewIndustry") {
      state.overviewIndustry=value==="all"||state.overviewIndustry===+value?null:+value;
      state.cross=null;
    }
    if(key==="bubble") {
      clearFit();
      setIndustryFilter(toggleIndustry(visibleIndustries(),value,e.ctrlKey||e.metaKey),[]);
    }
    if(key==="focusIndustry") { clearFit(); setIndustryFilter([value]); }
    if(key==="setIndustryFilter") {
      clearFit();
      const [filter,mode] = value.split("|");
      if(filter==="selected") setIndustryFilter(mode==="all"?d.demand.map(r=>r.id):[]);
      else setIndustryFilter(state.selected,mode==="all"?segmentsFor(state.selected).map(r=>r.name):[]);
    }
    if(key==="resetIndustryFilters") { clearFit(); setIndustryFilter([],[]); }
    if(key==="budgetScope") state.budgetScope=!state.budgetScope;
    if(key==="offerMedian") state.offer=+value;
    if(key==="profileExample") loadExampleProfile();
    if(key==="clearProfile") {
      state.profile=pathway.emptyProfile();
      state.taskOccupations={};
      state.occupations="all";
      state.fitGroups=[];
    }
    if(key==="profileTag") {
      const [field,id] = value.split("|");
      const tags = state.profile[field];
      if(tags.includes(id)) state.profile[field]=tags.filter(tag=>tag!==id);
      else if(tags.length<3) tags.push(id);
      else {
        $("profile-limit").textContent=t("最多选择三项。请先取消一项。","Choose up to three. Remove a tag to add another.");
        return;
      }
    }
    if(key==="crossOcc") {
      clearFit();
      toggleCross({kind:"occ",key:value});
      state.occupations=value;
    }
    if(key==="crossStatus") toggleCross({kind:"status",key:value});
    if(key==="occupationGroup") { clearFit(); state.occupations=value; }
    if(key==="sankeyOcc") { clearFit(); state.occupations = state.occupations===value ? "all" : value; }
    if(key==="taskOccupation") {
      clearFit();
      const [task,group] = value.split("|");
      if(state.taskOccupations[task]===group) delete state.taskOccupations[task];
      else state.taskOccupations[task]=group;
      state.occupations="tasks";
    }
    if(key==="vacancyCell") state.vacancyCell=value;
    if(key==="addPair") {
      const [id,occupation] = value.split("|");
      if(!state.pairs.some(pair=>keyOf(pair)===value) && pathway.findVacancy(id,occupation)) {
        state.pairs.push({id,occupation,kept:false,note:""});
      }
    }
    if(key==="removePair") state.pairs=state.pairs.filter(pair=>keyOf(pair)!==value);
    if(key==="finishReview") {
      for(const pair of state.pairs) pair.kept=true;
      state.budgetScope=true;
      pathway.save(state);
      location.hash="fit";
      return;
    }
    if(key==="case") {
      loadExampleProfile();
      Object.assign(state,{
        pairs:pathway.examplePairs(true),selected:[],payYear:2025,startYear:2016,vacancyMode:"count",
        industryDetails:[],budgetScope:true,vacancyCell:"",fitGroups:[],
        targetPay:25000,maxHours:42,targetSurplus:6000,offer:25000,rent:10000,living:6500,deduct:2000,
      });
    }
    const focusKey = key==="addPair" ? "vacancyCell:"+value
      : key==="focusIndustry" ? "vacancyCell:"+state.vacancyCell
      : key==="overviewBand" ? "overviewIndustry:industry:"+value.split("|")[0] : el.dataset.focus;
    render(focusKey);
  }

  main.addEventListener("click",e=>{
    const quizEl=e.target.closest("[data-quiz-act]");
    if(quizEl){ handleQuiz(e,quizEl); pathway.save(state); return; }
    if(e.target.closest("[data-start-example]")) {
      loadExampleProfile();
      pathway.save(state);
      return;
    }
    const scroll=e.target.closest("[data-scroll]");
    if(scroll) {
      e.preventDefault();
      $(scroll.dataset.scroll).scrollIntoView({block:"start"});
      return;
    }
    const target=e.target.closest("[data-action]");
    if(target) {
      action(e,target);
    } else {
      const band=e.target.closest('[data-chart="industry-area"] [data-tip]');
      if(band) showTip(band,e);
    }
  });
  main.addEventListener("keydown",e=>{
    const target=e.target.closest("svg [data-action]");
    if(target&&(e.key==="Enter"||e.key===" ")) { e.preventDefault(); action(e,target); }
    if(e.key==="Escape") {
      tooltip.hidden=true;
      if(state.cross) { state.cross=null; render(); }
    }
  });
  main.addEventListener("change",e=>{
    if(e.target.matches('input[data-range]')) { render(); return; }
    if(e.target.dataset.industryFilter) {
      const key=e.target.dataset.industryFilter;
      const next=toggleIndustry(state[key],e.target.value,true);
      if(key==="selected") setIndustryFilter(next);
      else setIndustryFilter(state.selected,next);
      render(e.target.dataset.focus);
      return;
    }
    if(e.target.matches("select[data-profile]")) {
      const {profile} = e.target.dataset;
      state.profile[profile]=e.target.value;
      if(state.profile.major && state.profile.major===state.profile.minor) {
        state.profile[profile==="major"?"minor":"major"]="";
      }
      render(e.target.id);
      return;
    }
    const key=e.target.dataset.control;
    if(!key || e.target.type==="number") return;
    if(key==="overviewIndustry") { state.overviewIndustry=e.target.value==="all"?null:Number(e.target.value); state.cross=null; }
    else if(key==="hiringIndustry") {
      if(e.target.value==="multiple") return;
      setIndustryFilter(e.target.value==="all"?[]:[e.target.value],[]);
    }
    else if(typeof state[key]==="number") {
      if(e.target.value==="") { e.target.value=state[key]; return; }
      const want=Number(e.target.value);
      if(!Number.isFinite(want)) { e.target.value=state[key]; return; }
      state[key]=want;
    } else state[key]=e.target.value;
    render(e.target.id);
  });
  const budgetKeys = ["offer","rent","living","deduct"];
  function updateBudgetLive() {
    const wf = main.querySelector('[data-chart="budget-waterfall"]');
    if (wf) {
      const w = Math.floor(wf.clientWidth);
      if (w > 0) wf.innerHTML = c.waterfall(w, state);
    }
    const strong = main.querySelectorAll(".stats .stat strong");
    if (strong.length >= 3) strong[2].textContent = money(state.offer-state.rent-state.living-state.deduct);
  }
  function syncSliderFill(rangeEl, v) {
    const rmin = Number(rangeEl.min), rmax = Number(rangeEl.max);
    rangeEl.style.setProperty("--fill", Math.max(0, Math.min(100, (v-rmin)/(rmax-rmin)*100)) + "%");
  }
  main.addEventListener("input",e=>{
    const el = e.target;
    if(el.matches('input[data-quiz-input]')) {
      state.profile.keywords=el.value;
      pathway.save(state);
      return;
    }
    if(el.matches('input[data-range]')) {
      const key = el.dataset.range, v = Number(el.value);
      state[key] = v;
      const cap = $("num-"+key); if (cap) cap.textContent = number(v);
      const numInput = $(key); if (numInput) numInput.value = v;
      syncSliderFill(el, v);
      if (budgetKeys.includes(key)) updateBudgetLive();
      pathway.save(state);
      return;
    }
    if(el.matches('input.slider-number')) {
      const key = el.dataset.control, v = Number(el.value);
      if (!Number.isFinite(v)) return;
      state[key] = v;
      const range = main.querySelector(`input[data-range="${key}"]`);
      if (range) { range.value = v; syncSliderFill(range, v); }
      const cap = $("num-"+key); if (cap) cap.textContent = number(v);
      if (budgetKeys.includes(key)) updateBudgetLive();
      pathway.save(state);
      return;
    }
    if(e.target.id==="keywords") state.profile.keywords=e.target.value;
    else if(e.target.dataset.note) {
      const pair=state.pairs.find(pair=>keyOf(pair)===e.target.dataset.note);
      if(pair) pair.note=e.target.value;
    } else return;
    pathway.save(state);
  });
  main.addEventListener("submit",e=>{
    if(e.target.matches("[data-wage-exchange]")) {
      e.preventDefault();
      state.wageRate=$("wageRate").valueAsNumber;
      render(e.submitter?.id);
      return;
    }
    if(!e.target.matches("[data-budget-form]")) return;
    e.preventDefault();
    for(const input of e.target.querySelectorAll("input[type=number]")) {
      if(input.value!=="") state[input.dataset.control]=input.valueAsNumber;
    }
    render(e.submitter?.id);
  });
  function positionTip(x,y) {
    const padding=8;
    tooltip.style.left=Math.max(padding,Math.min(x+12,innerWidth-tooltip.offsetWidth-padding))+"px";
    tooltip.style.top=(y+tooltip.offsetHeight+14>innerHeight?Math.max(padding,y-tooltip.offsetHeight-10):y+12)+"px";
  }
  function highlightBand(band){
    if(!band) return;
    const svg=band.closest("svg");
    if(!svg) return;
    svg.querySelectorAll('path[data-action="vacancyCell"]').forEach(p=>{
      p.setAttribute("fill-opacity", p===band ? ".6" : ".06");
    });
    hoverBand=band;
  }
  function restoreBands(){
    if(hoverBand && !hoverBand.isConnected) hoverBand=null;
    if(!hoverBand) return;
    const svg=hoverBand.closest("svg");
    if(svg) svg.querySelectorAll('path[data-action="vacancyCell"]').forEach(p=>{
      p.setAttribute("fill-opacity", p.dataset.op || ".22");
    });
    hoverBand=null;
  }
  function showTip(el,event) {
    if(!el) return;
    const rect=el.getBoundingClientRect();
    const x=event?.clientX ?? rect.left+rect.width/2;
    const y=event?.clientY ?? rect.bottom;
    tooltip.textContent=el.dataset.tip;
    tooltip.hidden=false;
    positionTip(x,y);
  }
  function resetCross() {
    main.querySelectorAll(".hover-cross.on").forEach(l=>l.classList.remove("on"));
  }
  function showCross(cap,event) {
    const svgEl = cap.closest("svg");
    const lineEl = svgEl.querySelector(".hover-cross");
    if (lineEl) {
      const x = cap.dataset.crossX;
      lineEl.setAttribute("x1", x);
      lineEl.setAttribute("x2", x);
      lineEl.classList.add("on");
    }
    tooltip.textContent = cap.dataset.crossTip;
    tooltip.hidden = false;
    positionTip(event.clientX, event.clientY);
  }
  main.addEventListener("pointermove",e=>{
    const cap = e.target.closest(".x-capture");
    if (cap) { restoreBands(); showCross(cap,e); return; }
    const band=e.target.closest('[data-chart="sankey"] path[data-action="vacancyCell"]');
    if(band){ resetCross(); highlightBand(band); showTip(band,e); return; }
    if(hoverBand) restoreBands();
    const hit=e.target.closest("[data-tip]");
    if(hit) { resetCross(); showTip(hit,e); } else { tooltip.hidden=true; resetCross(); }
  });
  main.addEventListener("pointerleave",()=>{ restoreBands(); tooltip.hidden=true; resetCross(); });
  main.addEventListener("focusin",e=>{
    const band=e.target.closest('[data-chart="sankey"] path[data-action="vacancyCell"]');
    if(band){ highlightBand(band); showTip(band); return; }
    restoreBands();
    showTip(e.target.closest("[data-tip]"));
  });
  main.addEventListener("focusout",()=>{ restoreBands(); tooltip.hidden=true; });
  $("language").addEventListener("change",e=>{
    const drafts=[...main.querySelectorAll('input[type="number"]')].map(input=>[input.id,input.value]);
    language.set(e.target.value);
    renderInterface();
    render("language");
    for(const [id,value] of drafts) $(id).value=value;
  });
  $("theme-toggle").addEventListener("click",()=>{
    guideTheme.toggle();
    renderInterface();
    render("theme");
  });
  window.addEventListener("scroll",()=>{ tooltip.hidden=true; resetCross(); },{passive:true});
  window.addEventListener("hashchange",route);
  if (saved.industryDetails===undefined && (fitBroad?.length || fitDetails?.length)) {
    const hadIndustryFilter = state.selected.length>0;
    setIndustryFilter(hadIndustryFilter?state.selected:fitBroad??[],fitDetails??[]);
    if(!hadIndustryFilter) {
      state.vacancyCell ||= fitCell ?? "";
      state.vacancyMode = fitVacancyMode ?? state.vacancyMode;
      if(state.occupations==="all") state.occupations=fitOccupations ?? "all";
    }
  }
  const urlParams = new URLSearchParams(location.search);
  const indParam = (urlParams.get("ind") || "").split(",").filter(Boolean);
  if (indParam.length) setIndustryFilter(indParam, []);
  const occParam = urlParams.get("occ");
  if (occParam && pathway.occupationGroups.includes(occParam)) state.occupations = occParam;
  const cellParam = urlParams.get("cell");
  if (cellParam) state.vacancyCell = cellParam;
  renderInterface();
  route();
})();
