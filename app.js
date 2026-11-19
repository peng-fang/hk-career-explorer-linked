(() => {
  "use strict";
  const d = globalThis.guideData;
  const c = globalThis.guideCharts;
  const language = globalThis.guideLanguage;
  const pathway = globalThis.guidePathway;
  const {t, year: yearLabel, list, englishName, mapping} = language;
  const {esc, number, percent, money, colors, purple, rose, legend, empty} = c;
  const $ = id => document.getElementById(id);
  const main = $("content");
  const tooltip = $("chart-tooltip");
  const charts = new Map();
  const openPanels = new Set();
  let chapter, observers = [];
  const item = (id, title, subtitle, question, summary) => ({
    id, get title() { return t(...title); }, get subtitle() { return t(...subtitle); },
    get question() { return t(...question); }, get summary() { return t(...summary); },
  });
  const pages = [
    item("markets",["两地对照","Two markets"],["香港值得深入看看吗？","Should I explore Hong Kong further?"],["毕业后，要不要把香港列为求职重点？","Should I focus my job search on Hong Kong?"],
      ["嘉宁先看两地的行业结构，再了解年轻人就业形势和行业收入。她用这些信息决定要不要继续查香港的岗位，同时保留内地求职选项。","Jia Ning looks at industry structure, youth unemployment and earnings. She uses this context to decide whether to explore Hong Kong vacancies while keeping Mainland options open."]),
    item("structure",["发现方向","Discover options"],["从我的背景找方向","Explore options that fit my background"],["香港哪些行业在招我想做的工作？","Which Hong Kong industries hire for the work I want to do?"],
      ["先用专业、兴趣和技能找到可探索的职业组，再根据真实空缺选出想进一步查证的行业和职业组合。","Start with your studies, interests and skills. Use vacancy data to choose industry and occupation pairs worth investigating."]),
    item("fit",["试算个人条件","Test my criteria"],["工资、工时和生活费怎么算？","How do pay, hours and costs add up?"],["这些方向，能支撑我想要的香港生活吗？","Could these options support the life I want in Hong Kong?"],
      ["带入你选的行业和职业组合，用行业工资、工时和每月开支试算。调整一个条件，看看哪些方向仍值得优先投递。","Test your selected industry and occupation pairs against industry pay, working hours and your monthly costs. Change one assumption and see which options still look worth applying for first."]),
  ];
  const defaultWageRate = 1.0828;
  const wageRateSource = "https://www.censtatd.gov.hk/en/data/stat_report/product/B1010003/att/B10100032025AN25B0100.pdf";
  const state = {
    marketPeriod:"latest", overviewYear:2025, riskYear:2025, age:"20 - 24", equityYear:2025, education:"all",
    wageRate:defaultWageRate,
    selected:[], vacancyMode:"count", payYear:2025, startYear:2016,
    targetPay:25000, maxHours:42, targetSurplus:6000, offer:25000, rent:10000, living:6500, deduct:2000,
    profile:pathway.emptyProfile(), pairs:[], occupations:"all", taskOccupations:{}, vacancyCell:"", sortBy:"surplus",
    ...pathway.load(),
  };
  const aliases = {
    "Manufacturing":"制造业","Construction":"建筑业","Import/export & wholesale":"进出口及批发",
    "Retail & accommodation":"零售、住宿及餐饮","Transportation & information":"运输及资讯",
    "Finance & professional":"金融、地产及商务","Public & social services":"公共及社会服务","Other industries":"其他行业",
    "Financing, insurance, real estate, professional and business services":"金融、保险、地产及商务",
    "Import/export trade and wholesale":"进出口及批发",
    "Public administration, social and personal services":"公共行政、社会及个人服务",
    "Retail, accommodation and food services":"零售、住宿及餐饮",
    "Transportation, storage, postal and courier services, information and communications":"运输、邮政及资讯",
    "Employees":"雇员","Employers":"雇主","Self-employed":"自雇","Unpaid family workers":"无酬家庭从业者",
    "Managers":"经理","Professionals":"专业人员","Associate professionals":"辅助专业人员",
    "Clerical support workers":"文书支援人员","Services and sales workers":"服务及销售人员",
    "Craft and related trades workers":"工艺及有关人员","Plant and machine operators and assemblers":"机械操作及装配人员",
    "Elementary occupations":"非技术工人","Other occupations":"其他职业",
    "Skilled agricultural and fishery workers":"熟练农渔工人",
    "Primary and below":"小学或以下","Secondary":"中学","Post-secondary":"专上教育",
    "SARS (2003 Q2)":"沙士 · 2003Q2","Global financial crisis (2008 Q4)":"全球金融危机 · 2008Q4",
    "COVID-19 onset (2020 Q1)":"新冠疫情初期 · 2020Q1",
    "公共教育医疗社会个人服务":"公共、教育、医疗及社会服务",
    "其他（农林采矿/公用事业/国际组织）":"其他（农林、公用等）",
  };
  const label = x => t(aliases[x] ?? x, englishName(x));
  const span = (a,b) => Array.from({length:b-a+1},(_,i)=>i+a);
  const q = row => row.year + (row.quarter-1)/4;
  const quarter = n => Math.floor(n) + "Q" + (Math.round((n % 1)*4)+1);
  const historyX = p => Number(p.slice(0,4)) + (Number(p.slice(-1))-1)/4;
  const ageLabel = key => t(key.replace(" - ","–") + " 岁", "Age " + key.replace(" - ","–"));
  const unique = data => [...new Set(data)];
  const by = (rows,key) => Map.groupBy(rows,r=>r[key]);
  const mean = xs => xs.reduce((total,v)=>total+v,0)/xs.length;
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
  const budgetField = (key,title,step) => `<label class="field">${title}<input id="${key}" type="number" min="0" max="${key==="maxHours"?168:10000000}" step="${step}" value="${state[key]}" data-control="${key}"></label>`;
  const controls = (...items) => `<div class="control-bar">${items.join("")}</div>`;
  const hint = (zh,en) => `<p class="mode-note">${t(zh,en)}</p>`;
  const stats = (...items) => `<div class="stats">${items.map(([value,caption])=>`<div class="stat"><strong>${value}</strong><span>${caption}</span></div>`).join("")}</div>`;
  const chip = (action,value,title,pressed) => `<button type="button" class="chip" data-action="${action}" data-value="${esc(value)}" data-focus="${esc(action+":"+value)}"${pressed===undefined?"":` aria-pressed="${pressed}"`}>${esc(title)}</button>`;
  const series = (id,sets,options) => viz(id,w=>c.series(w,sets,options));
  const lineSet = (name,points,color=purple,dash=false) => ({name,points,color,dash});
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
  const appendix = (id, title, content) => `<details class="appendix" id="${id}"><summary>${title}</summary>${content}</details>`;

  function markets() {
    const snapshot = d.markets.filter(r=>r.kind==="A_2010年龄对照");
    const current = d.markets.filter(r=>r.kind===(state.marketPeriod==="early"?"F_行业35_早期":"G_行业35_最新"));
    const paired = rows => [...by(rows,"order")].sort(([a],[b])=>a-b).map(([,rs])=>({
      name:label(rs[0].label), values:["内地","香港"].map(region=>rs.find(r=>r.region===region)?.value),
    }));
    const aged35AndOver = paired(current).map(row=>({
      ...row, values:row.values.map(value=>Number.isFinite(value) ? 100-value : value),
    }));
    const palette = [purple,rose], regions = ["内地","香港"].map(label);
    const keys = legend(regions.map((name,i)=>[name,palette[i]]));
    const era = state.marketPeriod==="early"
      ? t("内地 2010 年 · 香港 2011 年","Mainland 2010 · Hong Kong 2011")
      : t("内地 2020 年 · 香港 2021 年","Mainland 2020 · Hong Kong 2021");
    const hero = `<section class="hero"><div class="hero-copy"><p class="eyebrow">${t("香港就业市场探索器","Hong Kong Graduate Career Explorer")}</p>
      <h1>${t("毕业后，<br>留在香港？","After graduation,<br>stay in Hong Kong?")}</h1>
      <p>${t("刚在香港读完硕士的嘉宁，还没决定在哪里工作。跟她一起提问、点选图表、调整假设，看看哪些方向值得下一步查证。",
        "Jia Ning has just finished her master’s in Hong Kong and is weighing where to work. Follow her questions, explore the charts and change the assumptions to see which options are worth investigating.")}</p>
      <a class="hero-button" href="#market-compare" data-scroll="market-compare">${t("开始探索","Start exploring")} <span aria-hidden="true">↓</span></a></div>
      <img class="hero-image" src="assets/harbour.webp" alt="${t("维多利亚港傍晚的香港岛天际线，生成示意图","Generated illustration of the Hong Kong Island skyline at dusk, across Victoria Harbour")}"></section>`;
    return hero + heading(pages[0],0,"h2","market-compare")
      + `<div class="grid wide-pair market-ages">`
      + figure("ages",t("就业人口年龄结构","Employed population by age"),t("2010 年 · 各年龄段占比","2010 · Share by age group"),
          c.bars(paired(snapshot),{colors:palette,labels:regions,mirror:true,max:18,format:percent,label:t("2010年两地就业人口年龄结构镜像图","Mirrored bars comparing the age profiles of both workforces in 2010")}),
          t("每行比较同一年龄段，左为内地、右为香港。沿用原表对齐分组，仅显示列出的年龄段，各列未重归一；两地就业统计定义有差异。",
            "Each row pairs the same age group: Mainland China on the left, Hong Kong on the right. The chart uses the original aligned groups and denominators. Employment definitions differ between the two markets."),
          {key:keys})
      + figure("industry-age",t("各行业 35 岁及以上就业占比","Workers aged 35 and over by industry"),era,
          c.bars(aged35AndOver,{colors:palette,labels:regions,max:100,format:percent,label:t("两地各行业 35 岁及以上就业占比","Share of workers aged 35 and over by industry and market")}),
          t("35 岁及以上占比为 100% 减去 35 岁以下占比，分母为各地各行业的就业人数。两地统计时点相差一年，内地细分数据为项目估计。用于观察年龄结构，岗位需求见下一章。",
            "The share aged 35 and over equals 100% minus the under-35 share. The denominator is each industry’s workforce. Snapshots are one year apart and Mainland industry breakdowns are project estimates. See the next chapter for vacancy data."),
          {key:keys,control:`<div class="chip-row">${chip("marketPeriod","early",t("早期","Earlier"),state.marketPeriod==="early")}${chip("marketPeriod","latest",t("较新","More recent"),state.marketPeriod==="latest")}</div>`})
      + `</div>`
      + marketEvidence()
      + `<div class="decision"><strong>${t("嘉宁决定先查香港的岗位，同时保留内地投递。","Jia Ning decides to explore Hong Kong vacancies while keeping her Mainland search open.")}</strong>
        <div class="chapter-actions"><a class="hero-button" href="#structure" data-start-example>${t("跟随嘉宁找香港岗位","Explore Hong Kong vacancies with Jia Ning")}</a>
        <a class="secondary-link" href="#structure">${t("用我的背景探索","Explore with my own background")}</a></div></div>`;
  }

  function marketEvidence() {
    const data = d.marketContext;
    const cn = t("内地","Mainland China"), hk = t("香港","Hong Kong");
    const group = row => t(row.nameZh,row.nameEn);
    const unemployment = (area,title,period,note,color,max) => {
      const rows = data.filter(row=>row.indicator==="unemployment" && row.area===area);
      return figure(`unemployment-${area}`,title,period+t(` · 本图 0–${max}%`,` · Local scale 0–${max}%`),
        c.bars(rows.map(row=>({name:group(row),values:[row.value]})),{colors:[color],max,format:percent,label:title}),
        note);
    };
    const participationRows = data.filter(row=>row.indicator==="participation");
    const sexes = [t("女性","Women"), t("男性","Men")];
    const participation = figure("participation-markets",t("两地男女劳动参与率","Labour force participation by sex and market"),
      t("2025 年 · 15 岁及以上 · 国际劳工组织模型估计","2025 · Ages 15 and over · Modelled ILO estimates"),
      c.bars([["CN",cn],["HK",hk]].map(([area,name])=>({
        name,values:["Women","Men"].map(sex=>participationRows.find(row=>row.area===area && row.nameEn===sex)?.value),
      })),
        {colors:[rose,purple],labels:sexes,max:100,format:percent,label:t("同口径比较两地男女劳动参与率","Comparable labour force participation rates by sex and market")}),
      t("劳动参与率是同一性别人口中正在工作或处于失业状态的人所占的比例。两地采用相同的年龄下限和估计方法。",
        "The rate is the share of each sex that is employed or unemployed. Both markets use the same age threshold and estimation method."),
      {key:legend(sexes.map((name,i)=>[name,[rose,purple][i]])),full:true});
    return `<section aria-labelledby="risk-heading"><header class="subhead"><h2 id="risk-heading">${t("年轻人找工作有多难？","How much pressure do younger job seekers face?")}</h2>
      ${hint("每张图各自呈现当地总体与青年失业率。两地年龄范围、在校生处理和统计时段不同，图表各用当地刻度。","Each chart shows local overall and youth unemployment. Age bands, treatment of students and reference periods differ, so each chart uses its own scale.")}</header>`
      + grid(unemployment("CN",t("全国城镇调查失业率","Urban China surveyed unemployment"),t("2025 年 12 月","December 2025"),
        t("总体包含符合劳动力定义的在校生。两个青年组都剔除在校生。","The overall rate can include students in the labour force. Both youth rates exclude students."),purple,20),
        unemployment("HK",t("香港失业率","Hong Kong unemployment"),t("2025 年第四季度","2025 Q4"),
          t("全港总体及分年龄失业率均未经季节性调整。年龄组沿用综合住户统计调查。","Overall and age-group rates are not seasonally adjusted. Age bands follow the General Household Survey."),rose,15))
      + appendix("risk-hk",t("查阅香港失业率历史、年龄及教育组","Explore Hong Kong unemployment history, age and education"),risk()) + `</section>
      <section aria-labelledby="pay-context-heading"><header class="subhead"><h2 id="pay-context-heading">${t("谁在参与劳动市场？行业收入怎么看？","Who participates in the labour market, and what do industries pay?")}</h2></header>`
      + grid(participation, shenzhenHongKongPay())
      + appendix("market-wages",t("查阅香港各行业男女月收入","Explore Hong Kong industry earnings by sex"),equity()) + `</section>`;
  }

  function shenzhenHongKongPay() {
    const data = d.payComparison ?? [];
    if (!data.length) return "";
    const rate = state.wageRate;
    const unitColumns = `<th scope="col">${t("人民币／月","CNY/month")}</th><th scope="col">${t("港元／月","HKD/month")}</th>`;
    const title = t("深圳与香港的行业月薪中位数","Median monthly wages in Shenzhen and Hong Kong");
    const fx = `<form class="control-bar wage-exchange" data-wage-exchange>
      <label class="field" for="wageRate">${t("汇率（1 人民币兑多少港元）","Exchange rate (HKD per CNY)")}
        <input id="wageRate" type="number" min="0.0001" max="100" step="any" required value="${rate}"></label>
      <button class="chip" type="submit" id="apply-wage-rate">${t("应用汇率","Apply rate")}</button>
      ${chip("resetWageRate","default",t("恢复默认","Reset to default"))}
      <p class="mode-note"><a class="secondary-link" href="${wageRateSource}">${t(`2024 年平均汇率（1 人民币 = ${defaultWageRate} 港元）`,`2024 average exchange rate (CNY 1 = HKD ${defaultWageRate})`)}</a></p>
      </form>`;
    const amountTable = `<div class="table-scroll" tabindex="0" aria-label="${title}">
      <table class="compact-table wage-table"><colgroup></colgroup><colgroup span="2"></colgroup><colgroup span="2"></colgroup>
        <thead><tr><th scope="col" rowspan="2">${t("行业","Industry")}</th><th scope="colgroup" colspan="2">${t("深圳","Shenzhen")}</th><th scope="colgroup" colspan="2">${t("香港","Hong Kong")}</th></tr>
        <tr>${unitColumns}${unitColumns}</tr></thead>
        <tbody>${data.map(row=>{
          const name = row.id==="all" ? t("全行业","All covered industries") : t(row.nameZh,row.nameEn);
          const szMonthly = row.sz/12;
          return `<tr><th scope="row">${esc(name)}${row.noteZh?`<span class="subcell">${esc(t(row.noteZh,row.noteEn))}</span>`:""}</th>${[szMonthly,szMonthly*rate,row.hk/rate,row.hk].map(value=>`<td>${number(Math.round(value))}</td>`).join("")}</tr>`;
        }).join("")}</tbody></table></div>`;
    return figure("pay-comparison",title,t("2024 年 · 男女合计 · 金额取整","2024 · Both sexes combined · Rounded to whole currency units"),
      fx + amountTable,
      t("深圳月度等值为调查年薪除以 12，香港采用 5–6 月调查期内的月薪。人民币乘汇率得港元，港元除以汇率得人民币。行业按工资调查可对应的分组列示。专业及商业服务、社会及个人服务缺少可对应的整体中位数。",
        "Shenzhen’s monthly equivalent is annual pay divided by 12. Hong Kong uses monthly wages from the May–June survey. Multiply CNY by the rate to get HKD, and divide HKD by the rate to get CNY. Rows follow comparable wage survey groups. Comparable broad medians are unavailable for professional and business services and for social and personal services."),{full:true});
  }

  function structure() {
    const year=state.overviewYear;
    const total=d.total.find(r=>r.year===year)?.value;
    const industries=d.structure.filter(r=>r.kind==="industry_share");
    const years=unique(industries.map(r=>r.year)).sort((a,b)=>a-b);
    const sets=[...by(industries,"name")].map(([name,rs],i)=>({
      name:label(name), color:colors[i], values:years.map(y=>rs.find(r=>r.year===y)?.share),
    }));
    const biggest = sets.slice().sort((a,b)=>b.values[years.indexOf(year)]-a.values[years.indexOf(year)])[0];
    const status=d.structure.filter(r=>r.kind==="status" && r.year===year);
    const work=d.structure.filter(r=>r.kind==="occupation" && r.year===year);
    const overview = stats([number(total)+t(" 千人","k"),t(`${year} 年香港就业总量`,`Total employment in ${year}`)],
      [percent(biggest.values[years.indexOf(year)]),t(label(biggest.name)+"的就业份额",label(biggest.name)+" share")],
      [percent(status.find(r=>r.name==="Employees").status/status.reduce((a,r)=>a+r.status,0)*100),t(`${year} 年雇员占比`,`Employee share in ${year}`)])
      + controls(select("overviewYear",t("联动年份","Linked year"),span(2016,2025).reverse()),hint("点两张趋势图的 2016 年后位置，或用年份菜单同步更新截面。","Select any year from 2016 onward on either trend chart, or use the year menu to update both breakdowns."))
      + grid(
        figure("employment",t("香港就业总量","Total employment"),t("2008–2025 年 · 千人","2008–2025 · Thousands of people"),
          series("employment-line",[lineSet(t("就业总量","Total employment"),d.total.map(r=>[r.year,r.value,`${yearLabel(r.year)} · ${number(r.value)}${t(" 千人"," thousand people")}`]))],
            {xTicks:[2008,2012,2016,2020,2025],y:[0,4200],yTicks:[0,1000,2000,3000,4000],refX:year,action:"overviewYear",canSelect:x=>x>=2016,label:t("香港就业总量年度折线图","Annual total employment in Hong Kong")}),
          t("线高表示全港就业人数，竖虚线是选中的年份。早期年份供趋势比较，雇佣身份和职业构成从 2016 年起联动。",
            "The line shows total employment. The dashed line marks the selected year. Employment status and occupation breakdowns are available from 2016.")),
        figure("industry",t("行业就业占比","Employment share by industry"),t("2008–2025 年 · 占全港就业的百分比","2008–2025 · Percentage of total employment"),
          viz("industry-area",w=>c.stack(w,sets,years,year,"overviewYear")),
          t("各色带厚度代表行业的就业份额。份额增长也可能发生在全港就业总量下滑时，适合与左侧折线一起读。",
            "Band thickness shows each industry’s employment share. A share can rise while citywide employment falls. Read the two charts together."),
          {key:legend(sets.map(s=>[s.name,s.color]))}),
        figure("employment-status",t("雇佣身份构成","Employment status"),yearLabel(year)+t(" · 就业人数"," · Employed population"),
          c.donut(status.map(r=>({name:label(r.name),value:r.status}))),
          t("比较受雇、自雇等身份的结构。刚毕业时可以从雇员岗位入手，再按具体工作形式扩展搜索。",
            "Compare employees, the self-employed and other groups. Jia Ning starts with employee roles and can broaden her search to other arrangements.")),
        figure("occupation",t("职业构成","Occupational mix"),yearLabel(year)+t(" · 方块面积为就业人数"," · Area represents employment"),
          c.treemap(work.map(r=>({name:label(r.name),value:r.work,
            occupation:pathway.occupationGroups.includes(r.name)?r.name:null}))),
          t("职业描述做什么，行业描述雇主经营什么。聚焦色块可查看就业人数和占比，点击共有职业组可查看招聘空缺。",
            "Occupations describe what people do. Focus a tile for employment count and share, or select a matching occupation group to explore current vacancies.")));
    const rules = pathway.suggestions(state.profile);
    const taskGroups = new Set(rules.map(rule=>state.taskOccupations[rule.id]).filter(Boolean));
    return heading(pages[1],1) + profilePanel(rules)
      + appendix("structure-data",t("查阅香港行业与职业结构","Explore Hong Kong’s industries and occupations"),overview)
      + vacancyPanel(taskGroups) + pairReview();
  }

  function risk() {
    const year=state.riskYear, age=state.age;
    const quarterly=d.risk.filter(r=>r.kind==="unemployment_quarterly_line");
    const ageData=d.risk.filter(r=>r.kind==="unemployment_age_heatmap");
    const ageYears=unique(ageData.map(r=>r.year)).sort((a,b)=>a-b);
    const ageNames=unique(ageData.map(r=>r.age)).sort((a,b)=>a.localeCompare(b,"zh-HK",{numeric:true}));
    const annual = mean(quarterly.filter(r=>r.year===year).map(r=>r.value));
    const ageValue=ageData.find(r=>r.year===year&&r.age===age)?.value;
    const eventSets = [...by(d.risk.filter(r=>r.kind==="crisis_recovery"),"event")].map(([n,rs],i)=>
      lineSet(label(n),rs.map(r=>[r.relative,r.value]).sort((a,b)=>a[0]-b[0]),[purple,rose,"#477b75"][i],i===1));
    const educationRows = [...by(d.risk.filter(r=>r.kind==="unemployment_education"),"education")];
    const eduSets = educationRows.map(([n,rs],i)=>({
      ...lineSet(label(n),rs.map(r=>[r.year,r.value]).sort((a,b)=>a[0]-b[0]),[purple,rose,"#477b75"][i],i===1), group:n,
    })).filter(set=>state.education==="all" || state.education===set.group);
    const displayYears=span(Math.max(ageYears[0],year-5),Math.min(ageYears.at(-1),year+5));
    const riskTable=heatTable(ageNames.map(a=>({name:ageLabel(a),key:a})),displayYears,
      (name,y)=>ageData.find(r=>r.year===y&&r.age===name)?.value,
      (value,a,y)=>({text:percent(value),opacity:.10+Math.min(value/18,1)*.62,action:"riskCell",key:y+"|"+a.key,selected:y===year&&a.key===age}),
      t("年龄组","Age group"),t("失业率年龄与年份热力图","Unemployment heatmap by age and year"));
    const riskStats = stats(
      [percent(annual),t(`${year} 年四个季度失业率的算术平均`,`${year} average of quarterly unemployment rates`)],
      [percent(ageValue),t(`${year} 年 · ${ageLabel(age)}失业率`,`${year} unemployment · ${ageLabel(age)}`)],
      [percent(quarterly.at(-1).value),quarter(q(quarterly.at(-1)))+t(" 全港失业率"," Hong Kong unemployment")])
      + controls(select("riskYear",t("观察年份","Year"),ageYears.slice().reverse()),
        select("age",t("观察年龄","Age group"),ageNames,ageLabel),
        hint("点季度折线、教育折线或热力图单元格，可以切换观察年份。","Select a point on the unemployment or education chart, or a heatmap cell, to change the observation year."));
    return riskStats + grid(
      figure("risk-age",t("哪些年龄段承压？","Which age groups face more pressure?"),t("年度失业率 · 通过年份切换显示窗口","Annual unemployment · Change the year to move the window"),
        riskTable,t("热力越深，失业率越高。点单元格同步选择年龄和年份。为避免同一人落入两组，只用互不重叠的年龄段。",
          "Darker cells show higher unemployment. Select a cell to update both age and year. Age groups are mutually exclusive."),{full:true}))
      + appendix("risk-data",t("继续看失业走势、经济冲击与教育程度","Explore unemployment trends, downturns and education"),
      grid(
        figure("quarters",t("全港季度失业率","Hong Kong unemployment by quarter"),"1985Q1–2026Q2 · %",
          series("quarter-line",[lineSet(t("失业率","Unemployment rate"),quarterly.map(r=>[q(r),r.value,quarter(q(r))+" · "+percent(r.value)]))],
            {xTicks:[1985,1995,2005,2015,2026],y:[0,10],yFormat:percent,refX:year,action:"riskYear",canSelect:x=>x<2026,label:t("全港季度失业率折线图","Line chart of Hong Kong’s quarterly unemployment rate")}),
          t("折线上的峰值定位市场承压阶段。年龄及教育的年度资料截至 2025 年，点 2026 年季度可读该点数据。",
            "Peaks show periods of labour market pressure. Annual age and education data end in 2025. Hover over the 2026 quarters to read their rates.")),
        figure("crises",t("危机后的恢复路径","Recovery after past downturns"),t("事件相对季度 · 失业率变化（百分点）","Quarters from event · Change in unemployment (percentage points)"),
          series("event-line",eventSets,{xTicks:[-8,-4,0,4,8,12,16],y:[-4,4],refX:0,refY:0,label:t("三次危机失业率变化对齐图","Unemployment changes aligned to three downturns"),xFormat:n=>n>0?"+"+n:String(n)}),
          t("第 0 季度为事件发生季。每条线减去该事件前一季的失业率，低于 0 表示低于该基准。适合比较恢复过程，无法分离单一冲击的因果影响。",
            "Quarter 0 is the event quarter. Each line subtracts the unemployment rate one quarter before its event. Values below zero are below that baseline. The chart shows timing and scale, while other influences may also explain the changes."),
          {key:legend(eventSets.map(s=>[s.name,s.color]))}),
        figure("risk-education",t("不同教育组的失业率","Unemployment by education level"),t("年度失业率 · 三个汇总教育组","Annual unemployment · Three broad education groups"),
          series("education-line",eduSets,{xTicks:[1985,1995,2005,2015,2025],y:[0,10],yFormat:percent,refX:year,action:"riskYear",label:t("不同教育组失业率折线图","Line chart of unemployment by education level")}),
          t("按最高教育程度比较三个总体序列。专上教育包括学位与非学位，也包括不同年龄与年资的人。",
            "Groups are based on highest education attained. Post-secondary includes degree and non-degree qualifications, with a wide range of ages and experience."),
          {key:legend(eduSets.map(s=>[s.name,s.color])),control:select("education",t("教育程度","Education"),
            ["all",...educationRows.map(([name])=>name)],v=>v==="all"?t("全部教育组","All education groups"):label(v)),full:true})));
  }

  function equity() {
    const year = state.equityYear;
    const snapshot = d.equity.filter(r=>r.year===year);
    const overall = d.equity.filter(r=>r.kind==="overall");
    const sexes = ["Female","Male"];
    const sexNames = [t("女性","Women"),t("男性","Men")], palette=[rose,purple], keys=legend(sexNames.map((n,i)=>[n,palette[i]]));
    const bands = snapshot.filter(r=>r.kind==="industry");
    const ages = snapshot.filter(r=>r.kind==="age_group");
    const getOverall = sex => snapshot.find(r=>r.kind==="overall"&&r.sex===sex)?.pay;
    const genderSets = (rows,field,x) => sexes.map((sex,i)=>
      lineSet(sexNames[i],rows.filter(r=>r.sex===sex).map(r=>[x(r),r[field],
        field==="participation"?`${sexNames[i]} · ${ageLabel(r.name)} · ${percent(r[field])}`: `${sexNames[i]} · ${yearLabel(r.year)} · ${money(r[field])}`
      ]).sort((a,b)=>a[0]-b[0]),palette[i],i===0));
    const female=getOverall("Female"), male=getOverall("Male");
    const industry=[...by(bands,"name")].map(([name,rs])=>({
      name:label(name), values:sexes.map(s=>rs.find(r=>r.sex===s)?.pay),
    }));
    const ageNames=unique(ages.map(r=>r.name)).sort((a,b)=>a.localeCompare(b,"zh-HK",{numeric:true}));
    const ageTicks=ageNames.map((_,i)=>i).filter(i=>i%2===0);
    const earningsStats = stats([money(female),t(`${year} 年女性月收入中位数`,`Women’s median monthly earnings, ${year}`)],
      [money(male),t(`${year} 年男性月收入中位数`,`Men’s median monthly earnings, ${year}`)],
      [percent((male-female)/male*100),t("总体差额 ÷ 男性中位数","Overall gap as a share of the men’s median")])
      + controls(select("equityYear",t("联动年份","Linked year"),span(2008,2025).reverse()),hint("点趋势图上的年份，同步更新行业收入和劳动参与截面。","Select a year on the trend chart to update the industry and participation views."));
    return earningsStats + grid(
        figure("income-industry",t("香港各行业男女月收入中位数","Hong Kong median monthly earnings by industry and sex"),yearLabel(year)+t(" · 港元／月"," · HKD per month"),
          c.bars(industry,{labels:sexNames,colors:palette,max:Math.max(35000,...industry.flatMap(r=>r.values).filter(Number.isFinite)),format:number,label:t("同年各行业男女月收入中位数对照","Grouped bars comparing women’s and men’s median earnings by industry")}),
          t("职业、年资、全职比例和工时都会影响群体中位数。目前可核实的内地公开数据缺少同口径的分行业、分性别月收入中位数，因此图中仅列香港数据。",
            "Occupation, seniority, full-time share and hours affect the group medians. The chart shows Hong Kong figures. The Mainland public sources reviewed lack comparable monthly medians by industry and sex."),
          {key:keys,full:true}))
      + appendix("equity-data",t("继续看总体月收入和劳动参与率","Explore overall earnings and labour force participation"),
      grid(
        figure("income-trend",t("男女总体月收入走势","Median monthly earnings by gender"),t("1985–2025 年 · 港元／月","1985–2025 · HKD per month"),
          series("income-line",genderSets(overall,"pay",r=>r.year),{xTicks:[1985,1995,2005,2015,2025],y:[0,30000],
            yTicks:[0,10000,20000,30000],yFormat:n=>number(n/1000)+"k",refX:year,action:"equityYear",canSelect:x=>x>=2008,label:t("男女总体月收入各年中位数折线图","Lines for women’s and men’s annual medians of monthly earnings")}),
          t("线条展示男女各自就业群体的名义月收入中位数。点击 2008–2025 年数据点可联动当年截面。",
            "Both lines show nominal monthly earnings for employed people. Select a point from 2008 to 2025 to update the other views."),
          {key:keys}),
        figure("participation",t("按年龄分组的劳动参与率","Labour force participation by age"),yearLabel(year)+t(" · 劳动力占同组人口的比例"," · Labour force as a share of each age group"),
          series("participation-points",genderSets(ages,"participation",r=>ageNames.indexOf(r.name)),
            {x:[0,ageNames.length-1],xTicks:ageTicks,xFormat:i=>ageNames[i].replace(" - ","–"),y:[0,100],
              yFormat:percent,pointsOnly:true,label:t("男女分年龄组劳动参与率散点图","Labour force participation by age and gender")}),
          t("劳动参与包括就业者和失业者。譬如仍在读书的人可能不在劳动力内，所以参与率与找到工作的概率是两个指标。",
            "The labour force includes employed and unemployed people. Students who are neither working nor looking for work may fall outside it."),
          {key:keys})));
  }

  function heatTable(rows, cols, read, format, corner, description) {
    return `<div class="table-scroll" tabindex="0" aria-label="${esc(description + t("，可横向滚动",", scrolls horizontally"))}"><table class="heat" aria-label="${esc(description)}">
      <thead><tr><th scope="col">${corner}</th>${cols.map(x=>`<th scope="col">${esc(x.name ?? x)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${cols.map(x=>{
        const value=read(r.key,x.id ?? x), f=format(value,r,x);
        if(!Number.isFinite(value)) return "<td>—</td>";
        const tip=r.name+" · "+(x.name ?? x)+" · "+f.text;
        return `<td><button type="button" data-action="${f.action}" data-value="${esc(f.key)}" data-focus="${esc(f.action+":"+f.key)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${f.selected}" style="background:rgba(117,63,133,${f.opacity});color:${f.opacity>.62?"white":"#27192c"}">${f.text}</button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function profilePanel(rules) {
    const profile = state.profile;
    const major = (key, title) => `<label class="field">${title}<select id="${key}" data-profile="${key}">
      <option value="">${t("请选择或跳过","Choose or skip")}</option>
      ${Object.keys(pathway.majors).map(id => `<option value="${id}"${profile[key]===id?" selected":""}>${esc(pathway.nameOf(pathway.majors,id))}</option>`).join("")}
      </select></label>`;
    const tags = (key, title, options) => `<fieldset class="profile-tags"><legend>${title}</legend>
      <div class="chip-row">${Object.keys(options).map(id => chip("profileTag",`${key}|${id}`,pathway.nameOf(options,id),profile[key].includes(id))).join("")}</div></fieldset>`;
    return `<section class="card profile-card" aria-labelledby="profile-heading">
      <div class="card-head"><div><h2 id="profile-heading">${t("我的求职背景","My search profile")}</h2>
        <p class="card-unit">${t("专业、工作兴趣与可展示的技能都可跳过。","You can skip any of the fields.")}</p></div>
        <div class="chip-row">${chip("profileExample","jia",t("载入嘉宁的背景","Load Jia Ning’s profile"))}
          ${chip("clearProfile","all",t("清空个人标签，浏览全部职业","Clear tags and browse all occupations"))}</div></div>
      <div class="profile-majors">${major("major",t("主专业","Main field of study"))}${major("minor",t("辅方向","Additional field"))}</div>
      ${tags("interests",t("我喜欢的工作任务（最多三项）","Tasks I enjoy (up to three)"),pathway.interests)}
      ${tags("skills",t("我能展示的技能（最多三项）","Skills I can demonstrate (up to three)"),pathway.skills)}
      <p id="profile-limit" class="mode-note" role="status"></p>
      <label class="field">${t("想带进工作的爱好或自定义搜索词","Hobbies I want to use at work or custom search terms")}
        <input type="text" id="keywords" data-profile="keywords" maxlength="100" value="${esc(profile.keywords)}"
          placeholder="${t("例如摄影、零售数据分析","For example, photography or retail analytics")}"></label>
      <p class="mode-note">${t("自定义词会带到最终页，供搜索招聘广告时参考。","Custom terms carry to the final page for searching job ads.")}</p>
      ${rules.length ? `<div class="pathway-rules"><h3>${t("按工作任务找职业组","Find occupation groups by the work they do")}</h3>
        <div class="pathway-rule-grid">${rules.map(rule=>`<article class="pathway-rule" data-rule="${esc(rule.id)}"><strong>${esc(rule.task)}</strong>
          <p>${esc(list(rule.match))}</p>
          <p>${t("岗位搜索词","Job-ad keywords")} · ${esc(rule.words)}</p>
          <div class="chip-row" role="group" aria-label="${esc(rule.task)}">
            ${rule.groups.map(group=>chip("taskOccupation",`${rule.id}|${group}`,label(group),state.taskOccupations[rule.id]===group)).join("")}</div>
        </article>`).join("")}</div>
        <p class="mode-note">${t("每项任务可独立选一个职业组，热力表会合并同名职业组。实际职业分类取决于岗位职责。",
          "Choose one occupation per task. The heatmap combines duplicate groups. Actual classification depends on job duties.")}</p>
        <a class="secondary-link" href="#hiring" data-scroll="hiring">${t("查看招聘热力表","Go to the vacancy heatmap")} ↓</a></div>` : ""}
      </section>`;
  }

  function vacancyPanel(taskGroups) {
    const picked = state.selected;
    const chosen = d.demand.filter(r=>!picked.length||picked.includes(r.id));
    const scope = state.occupations==="tasks" && !taskGroups.size ? "all" : state.occupations;
    const groups = pathway.occupationGroups.filter(name =>
      scope==="all" || scope===name || (scope==="tasks" && taskGroups.has(name)));
    const occupationScopes = taskGroups.size ? ["tasks","all",...pathway.occupationGroups] : ["all",...pathway.occupationGroups];
    const demandLabels = groups.map(name=>({name:label(name),key:name}));
    const maxCount = Math.max(1,...d.occupations.map(row=>row.count ?? 0));
    const isCount = state.vacancyMode==="count";
    const heat = heatTable(demandLabels,chosen.map(r=>({id:r.id,name:label(r.name)})),
      (occupation,id)=>pathway.findVacancy(id,occupation)?.[state.vacancyMode],
      (v,occupation,industry)=>{
        const key = pathway.pairKey(industry.id,occupation.key);
        return {text:isCount?number(v):percent(v*100),opacity:.12+.66*Math.sqrt(v/(isCount?maxCount:1)),
          action:"vacancyCell",key,selected:key===state.vacancyCell};
      },
      t("职业组","Occupation"),t("行业职业空缺热力图","Vacancy heatmap by industry and occupation"));
    const [activeId,activeGroup] = state.vacancyCell.split("|");
    const isVisible = chosen.some(row=>row.id===activeId) && groups.includes(activeGroup);
    const active = isVisible && pathway.findVacancy(activeId,activeGroup);
    const market = d.demand.find(row=>row.id===activeId);
    const alreadyAdded = state.pairs.some(pair=>keyOf(pair)===state.vacancyCell);
    return `<section aria-labelledby="find-heading" id="hiring">
      <header class="subhead"><h2 id="find-heading">${t("哪里在招聘？","Where are the vacancies?")}</h2></header>
      ${controls(`<label class="field">${t("单选行业","Select one industry")}<select id="industry" data-control="industry">
        <option value="all"${!picked.length?" selected":""}>${t("全部行业","All industries")}</option>
        ${picked.length>1?`<option value="multiple" selected disabled>${t("已多选行业","Multiple industries selected")}</option>`:""}
        ${d.demand.map(x=>`<option value="${x.id}"${picked.length===1&&picked[0]===x.id?" selected":""}>${esc(label(x.name))}</option>`).join("")}</select></label>`,
      select("occupations",t("职业组","Occupation group"),occupationScopes,v=>{
        if(v==="tasks") return t("任务卡所选职业组","Groups selected on task cards");
        return v==="all"?t("全部职业","All occupations"):label(v);
      },scope),
      `<div class="chip-row" role="group" aria-label="${t("多选行业","Select multiple industries")}">${d.demand.map(x=>chip("toggleIndustry",x.id,label(x.name),picked.includes(x.id))).join("")}</div>`)}
      ${grid(
        figure("map",t("招聘机会地图","Hiring opportunities"),t("2026Q2 · 横轴空缺率 · 纵轴用工同比","2026 Q2 · Vacancy rate (x) · Employment change year on year (y)"),
          viz("map-bubbles",w=>c.bubbles(w,d.demand.map(r=>({...r,name:label(r.name)})),picked)),
          t("圆面积表示空缺人数。横虚线表示用工同比 0%，竖虚线表示调查总体空缺率 1.7%。点气泡会筛选热力表，Ctrl／⌘ 可多选。",
            "Bubble area shows vacancy count. The horizontal line marks zero growth. The vertical line marks the survey-wide vacancy rate of 1.7%. Select a bubble to filter the heatmap. Ctrl/Cmd-click adds industries."),
          {key:legend([[t("用工增加","Employment up"),purple],[t("用工减少","Employment down"),rose]])}),
        figure("vacancies",t("行业 × 职业空缺","Vacancies by industry and occupation"),t("2026Q2 · 行业大类与九个职业组","2026 Q2 · Broad industries and nine occupation groups"),
          heat,t("点格子查看本职业组的空缺数和行业内占比，再把这个组合加入比较。",
            "Select a cell to see the occupation’s vacancy count and share within its industry. You can then add the pair to your comparison."),
          {control:select("vacancyMode",t("单元格显示","Show in cells"),["count","share"],v=>v==="count"?t("空缺人数","Vacancy count"):t("行业内占比","Share within industry"))}))}
      <div class="decision evidence" aria-live="polite">
        ${active && market ? `<strong>${esc(pairTitle({id:activeId,occupation:activeGroup}))}</strong>
          <p>${number(active.count)} ${t("个职业组空缺","vacancies in this occupation group")} · ${vacancyShare(active)}
            ${t("占该行业全部空缺","of all vacancies in this industry")} · ${t("行业空缺率","Industry vacancy rate")} ${percent(market.rate*100)} · ${market.period}</p>
          ${alreadyAdded ? `<p class="good">${t("已加入比较","In your comparison")}</p>` : `<div class="chip-row">
            ${chip("addPair",state.vacancyCell,t("加入比较","Add to comparison"))}</div>`}`
          : `<p>${t("点一个热力格查看招聘证据。","Select a heatmap cell to inspect the hiring evidence.")}</p>`}
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
    return `<div class="legend"><span><i style="background:#cdb5de"></i>P25–P75</span><span><i style="background:${rose}"></i>P50</span>
      <span>${t("虚线","Dashed line")} · ${targetName} ${shortTarget}</span>
      <span><i class="range-selection-key"></i>${t("已确认方向所属行业","Industry covering a confirmed option")}</span></div>
      ${orderedRows.map(r=>{
        const selected=selectedIndustries.has(r.id);
        const a=r[type+"25"], m=r[type+"50"], b=r[type+"75"];
        const tip=label(r.name)+" · "+[a,m,b].map(number).join(" / ")+" · "+(pay?t("港元／月","HKD/month"):t("小时／周","hours/week"));
        return `<div class="range-lane${selected?" range-highlight":""}"><span class="range-name">${esc(label(r.name))}
          ${selected?`<span class="visually-hidden">${t("已确认方向所属行业","Industry covering a confirmed option")}</span>`:""}</span><div class="range-track">
          <span class="range-ref" style="left:${position(target)}%"></span>
          ${[a,b].every(Number.isFinite)?`<span class="range-band" style="left:${position(a)}%;width:${position(b)-position(a)}%" data-tip="${esc(tip)}"></span>`:""}
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
    return `<div class="table-scroll" tabindex="0" aria-label="${t("候选方向对照，可横向滚动","Shortlist comparison, scrolls horizontally")}">
      <table class="compact-table"><thead><tr>
        <th scope="col">${t("行业 × 职业组","Industry × occupation")}</th>
        <th scope="col">${t("职业组空缺<br>数量／行业内占比","Occupation vacancies<br>Count / industry share")}</th>
        <th scope="col">${t("细分行业 P50<br>月薪／周工时","Industry-segment medians<br>Pay / weekly hours")}</th>
        <th scope="col">${t("估算月结余","Estimated monthly surplus")}</th>
        <th scope="col" class="status-cell">${t("生活条件与个人线索","Criteria and personal rationale")}</th></tr></thead>
      <tbody>${options.map(option=>{
        const {pair,vacancy,market,segments,match,missing} = option;
        const multiple = segments.length>1;
        return `<tr data-pair="${esc(keyOf(pair))}"><th scope="row">${esc(pairTitle(pair))}</th>
          <td>${number(vacancy.count)} / ${vacancyShare(vacancy)}
            <span class="subcell">${market.period}</span></td>
          <td>${segments.flatMap(segment=>[multiple ? `<span class="subcell">${esc(label(segment.name))}</span>` : "",
            `<div>${money(segment.pay50)} / ${number(segment.hours50)} ${t("小时","h")}</div>`]).join("") || "—"}</td>
          <td>${segments.map(segment=>`<div>${multiple ? `<span class="subcell">${esc(label(segment.name))}</span>` : ""}
            ${money(segment.surplus)}</div>`).join("") || "—"}</td>
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

  function fit() {
    const confirmed = state.pairs.filter(pair=>pair.kept);
    const editLink = `<a class="secondary-link" href="#structure">${t("返回调整行业与职业","Edit industries and occupations")}</a>`;
    if (!confirmed.length) return heading(pages[2],2) + `<section class="card empty-state">
      <h2>${t("先确认要比较的方向","Confirm the options you want to compare")}</h2>
      <p>${state.pairs.length ? t("你已经选了方向。回到 01 的清单，点试算按钮即可带入预算。","You have selected options. Return to the chapter 01 shortlist and use its button to start the calculation.")
        : t("可以从 01 页挑选方向，也可以直接载入嘉宁的完整示例。","Choose options in chapter 01, or load Jia Ning’s complete example.")}</p>
      <div class="chapter-actions">${editLink}
        ${state.pairs.length ? `<a class="secondary-link" href="#shortlist">${t("返回已选清单","Return to my shortlist")}</a>`
          : chip("case","jia",t("载入嘉宁的演示方案","Load Jia Ning’s example"))}</div></section>`;

    const selectedIndustries = new Set(confirmed.map(pair=>pair.id));
    const chosen = d.demand.filter(r=>selectedIndustries.has(r.id));
    const referenceRows = d.pay.filter(r=>r.year===state.payYear);
    const rows = referenceRows.filter(r=>selectedIndustries.has(r.id)).map(candidate);
    const options = confirmed.map(pair=>{
      const vacancy = pathway.findVacancy(pair.id,pair.occupation);
      const market = chosen.find(row=>row.id===pair.id);
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
      return lineSet(label(industry.name),data,colors[i%colors.length],i%3===1);
    });
    const hValues = history.flatMap(s=>s.points.map(p=>p[1])).filter(Number.isFinite);
    const histMin = Math.floor(Math.min(100,...hValues)/10)*10;
    const histMax = Math.ceil(Math.max(110,...hValues)/10)*10;
    const histYears = span(state.startYear,Math.floor(end)).filter((y,i,a)=>a.length<=6||i%2===0||i===a.length-1);
    const status = matched.length ? t("优先查证","Investigate first")+" · "+list(matched.map(option=>pairTitle(option.pair)))
      : t("目前没有同时满足三项条件的方向。","No options meet all three criteria.");
    const profile = state.profile;
    const tags = [profile.major,profile.minor].map(key=>pathway.nameOf(pathway.majors,key)).filter(Boolean)
      .concat(profile.interests.map(key=>pathway.nameOf(pathway.interests,key)),
        profile.skills.map(key=>pathway.nameOf(pathway.skills,key)));
    return heading(pages[2],2) + stats(
      [confirmed.length,t("已确认的行业与职业组合","Confirmed industry and occupation pairs")],
      [matched.length,t("至少一个细分行业满足三项条件","At least one segment meets all three criteria")],
      [money(budget),t("按当前 Offer 估算的月结余","Monthly surplus with the current offer")])
      + `<div class="decision" aria-live="polite"><strong>${esc(status)}</strong>
        ${state.pairs.length>confirmed.length ? `<p>${t("有新选方向待带入试算。可以回清单确认。","New options are ready to add. Confirm them from the shortlist.")}</p>` : ""}
        ${tags.length ? `<p>${t("个人线索","My profile")} · ${esc(list(tags))}</p>` : ""}
        ${profile.keywords ? `<p>${t("自定义求职搜索词","My job-ad keywords")} · ${esc(profile.keywords)}</p>` : ""}
        <div class="chapter-actions">${editLink}
          <a class="secondary-link" href="#shortlist">${t("返回已选清单","Return to my shortlist")}</a>
          <a class="secondary-link" href="#shortlist-heading" data-scroll="shortlist-heading">${t("跳至候选表","Jump to shortlist")}</a></div></div>`
      + `<section aria-labelledby="conditions-heading"><header class="subhead"><h2 id="conditions-heading">${t("待遇能否支撑留港？","Would the pay and hours work for me?")}</h2></header>`
      + `<form class="control-bar" data-budget-form>${select("payYear",t("工资参考年","Pay reference year"),span(2016,2025).reverse())}
        ${budgetField("targetPay",t("期望月薪（港元）","Target monthly pay (HKD)"),1)}${budgetField("maxHours",t("期望每周工时上限","Weekly hours limit"),.1)}
        ${budgetField("targetSurplus",t("期望月结余（港元）","Target monthly surplus (HKD)"),1)}
        <button class="chip apply-budget" type="submit" id="apply-targets">${t("更新目标","Apply criteria")}</button></form>`
      + hint(`两图展示全部 ${referenceRows.length} 个调查细分行业。清单涵盖 ${selectedIndustries.size} 个行业大类，对应 ${rows.length} 个高亮细分行业。`,
        `Both charts show all ${referenceRows.length} surveyed industry segments. Your shortlist covers ${selectedIndustries.size} broad industries, which map to ${rows.length} highlighted segments.`)
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
      + figure("history",t("行业用工走势","Employment trends by industry"),t("季度 · 以 2016Q1 为 100","Quarterly index · 2016 Q1 = 100"),
          series("history-line",history,{x:[state.startYear,end],xTicks:histYears,y:[histMin,histMax],refY:100,
            xFormat:String,label:t("所选行业季度用工指数折线图","Quarterly employment index for selected industries")}),
          t("指数是当季就业人数除以该行业 2016Q1 人数后乘 100。选择起始年只缩短展示范围，基期保持原值。线条描述行业规模，无法估计个人失业风险。",
            "The index divides employment in each quarter by that industry’s 2016 Q1 count and multiplies by 100. Changing the start year changes only the viewing window. The lines describe industry employment levels."),
          {control:select("startYear",t("历史起始年","History start year"),span(2016,2025)),key:legend(history.map(s=>[s.name,s.color]))})
      + `</div></section><section aria-labelledby="shortlist-heading"><header class="subhead"><h2 id="shortlist-heading">${t("哪些方向值得优先查证？","Which options should I investigate first?")}</h2></header>`
      + grid(
        figure("candidates",t("候选方向对照","Shortlist comparison"),t("三项门槛都达到的方向排在前面","Options that meet all three criteria appear first"),
          shortlistTable(ranked),
          t("招聘按行业和职业组统计。薪酬与工时按细分行业的全职雇员统计。表中按行业月薪 P50 估算结余，预算图使用输入的 Offer。",
            "Vacancies are reported by industry and occupation. Pay and hours cover full-time employees in each industry segment. The table estimates surplus from industry median pay. The budget uses your entered offer."),
          {control:select("sortBy",t("同组内排序","Sort within result"),["surplus","vacancies"],
            v=>v==="surplus"?t("按估算月结余","Estimated surplus"):t("按职业组空缺数","Occupation vacancy count")),full:true}))
      + "</section>";
  }

  function sources() {
    const census = (url,zh,en)=>`<a href="https://www.stats.gov.cn/sj/pcsj/rkpc/${url}">${t(zh,en)}</a>`;
    const hk = (code,zh,en)=>`<a href="https://www.censtatd.gov.hk/en/web_table.html?id=${code}">${code} · ${t(zh,en)}</a>`;
    return `<header class="chapter-header"><h1>${t("数据来源与统计口径","Data and methods")}</h1>
    <p>${t("图表来自整合工作簿中的原项目数据及新增官方数据。两地数据按各自调查范围和观察期展示。",
      "Charts use the original project extracts and new official figures in the consolidated workbook. Figures follow the coverage and period of their source surveys.")}</p></header>
    <section class="card source-card">
      <h3>${t("两地对照","Two markets")}</h3>
      <ul><li>${census("5rp/html/l0404.htm","内地 2010 年人口普查","Mainland China 2010 Census")} ·
      ${census("6rp/html/B0402a.htm","内地 2020 年人口普查","Mainland China 2020 Census")}${t("。各行业 35 岁及以上占比由原项目的 35 岁以下占比取补数，沿用原有行业分类、时点和估计。",
        ". Shares aged 35 and over are complements of the original under-35 shares. They use the original project’s industry groupings, reference years and estimates.")}</li>
      <li>${hk("210-06201","香港政府统计处劳动人口表","Hong Kong C&SD labour force table")}${t("提供劳动人口背景。两地行业、年龄定义及年份见整合 Excel 的「00_口径限制」。",
        " provides labour force context. See the consolidated workbook’s 00 methods sheet for definitions and reference years.")}</li>
      <li><a href="https://www.stats.gov.cn/sj/xwfbh/fbhwd/202601/t20260119_1962330.html">${t("国家统计局 · 2025 年就业形势","National Bureau of Statistics · 2025 employment conditions")}</a> ·
        <a href="https://data.stats.gov.cn/easyquery.htm?cn=A01">${t("国家数据 · 月度分年龄失业率","National Data · Monthly unemployment by age")}</a> ·
        ${hk("210-06401","香港分年龄失业率","Hong Kong unemployment by age")}${t("。内地为 2025 年 12 月，香港为第四季度、未经季调。",". Mainland figures refer to December 2025. Hong Kong figures refer to Q4, unadjusted.")}</li>
      <li><a href="https://genderdata.worldbank.org/en/economies/china">${t("世界银行 · 内地劳动参与率","World Bank · Mainland participation")}</a> ·
        <a href="https://genderdata.worldbank.org/en/economies/hong-kong-sar-china">${t("世界银行 · 香港劳动参与率","World Bank · Hong Kong participation")}</a>${t("。2025 年男女数据均为 ILO 15 岁及以上模型估计。",". The 2025 figures are ILO modelled estimates for ages 15 and above, by sex.")}</li>
      <li><a href="https://www.sz.gov.cn/attachment/1/1703/1703629/12735140.pdf">${t("深圳市人社局工资价位（第一部分，页 5、15–16）","Shenzhen wage benchmark report (Part I, pp. 5, 15–16)")}</a> ·
        <a href="https://www.censtatd.gov.hk/wbr/B1050014/B10500142024AN24/att/en/B10500142024AN24.pdf">${t("香港政府统计处 2024 年收入及工时调查（表 6.10）","Hong Kong C&SD 2024 Annual Earnings and Hours Survey (Table 6.10)")}</a> ·
        <a href="${wageRateSource}">${t("2024 年平均汇率","2024 average exchange rate")}</a>${t("。深圳是 2024 年全年工资除以 12，香港是 2024 年 5–6 月调查期月薪。两地均显示人民币和港元，原调查的工资构成和覆盖范围有差异。",
          ". Shenzhen is full-year 2024 pay divided by 12. Hong Kong is the monthly wage from the May–June survey. Both are displayed in CNY and HKD. The underlying surveys differ in wage components and coverage.")}</li>
      <li>${t("分性别行业收入的口径核对见","For the coverage check on industry earnings by sex, see")}
        <a href="https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260515_1963707.html">${t("国家统计局城镇单位年平均工资","NBS average annual wages in urban units")}</a> ·
        <a href="https://ilostat.ilo.org/topics/wages/">ILOSTAT</a> ·
        <a href="https://sle.ajcass.com/Admin/UploadFile/Issue/201911110002/2024/4/20240423101905WU_FILE_0.pdf">${t("中国城市劳动力调查（表 12）","China Urban Labour Survey (Table 12)")}</a>${t("。国家统计局表 2、5 按单位类型分组，ILOSTAT 的内地行业月平均收入只有男女合计，八城市调查发布的是税后平均月工资。香港收入图采用中位数。",
          ". NBS tables 2 and 5 group workers by type of employer. ILOSTAT has combined-sex Mainland industry means. The eight-city survey publishes average take-home monthly wages. Hong Kong’s chart uses medians.")}</li></ul>
      <h3>${t("香港就业、失业与收入","Hong Kong employment, unemployment and earnings")}</h3>
      <ul><li>${t("就业规模和构成来自整合 Excel 的 <code>01_01</code>、<code>01_02</code> 工作表。失业率、年龄和教育数据来自 <code>04_05</code>。",
        "Employment levels and breakdowns come from sheets <code>01_01</code> and <code>01_02</code>. Unemployment, age and education data come from <code>04_05</code>.")}</li>
      <li>${t("香港分性别收入和参与率来自 <code>03_04</code>。参考统计处","Hong Kong earnings and participation by sex use sheet <code>03_04</code>. Reference tables")}
        ${hk("210-06201","劳动参与","Participation")} · ${hk("210-06316","行业月入","Monthly earnings by industry")}${t("。网站保留名义收入及各数据集的调查定义。",
        ". Earnings are nominal. The source survey definitions apply.")}</li></ul>
      <h3>${t("求职方向探索","Job options")}</h3>
      <ul><li>${hk("215-16001","机构就业及空缺","Establishment employment and vacancies")} · ${hk("215-16007","行业 × 职业空缺","Vacancies by industry and occupation")}${t("。需求截面为 2026Q2，只涵盖调查行业，不含公务员。",
        ". The demand snapshot is 2026 Q2 and covers surveyed industries, excluding civil servants.")}</li>
      <li>${hk("220-23015","全职月薪分布","Full-time monthly pay distribution")} · ${hk("220-23034","全职工时分布","Full-time working hours distribution")}${t("。采用 2016–2025 年各年 5–6 月数据。大类和细分行业对应关系见项目数据说明。",
        ". These use May–June observations for 2016–2025. The project notes explain the mappings between broad industries and detailed segments.")}</li>
      <li>${t("行业空缺率以就业人数加空缺人数为分母。热力表的职业组占比以所在行业的全部空缺为分母。",
        "The industry vacancy rate divides vacancies by employment plus vacancies. The heatmap divides each occupation’s vacancies by all vacancies in its industry.")}</li>
      <li>${t("考察细分行业时使用 P50。同一个组合有多个细分行业，可以逐项查看。达标项优先，同组内可按估算结余或职业组空缺数排序，缺资料项排后。",
        "Each segment is assessed at P50. Expand a pair to inspect its segments. Options meeting the criteria appear first. Sort within each outcome by estimated surplus or vacancy count. Options with missing evidence appear last.")}</li>
      <li>${t("专业、兴趣和技能通过项目整理的工作任务规则提供探索线索。候选组合由用户确认，信息保存在当前浏览器标签页的会话内。",
        "Project-curated task rules suggest occupations from your studies, interests and skills. You choose the options, and your inputs stay in this tab’s browser session.")}</li></ul>
      <h3>${t("项目参考","Project reference")}</h3><p>${t("图表卡片和市场探索的呈现参考组员的","Chart cards and the market exploration layout draw on the team’s")}
        <a href="https://github.com/ketianli082-stack/hong-kong-job-market-explorer">Hong Kong Job Market Explorer</a>${t("。嘉宁是演示用的虚构人物，封面为生成图像。",
        ". Jia Ning is fictional. The cover image is generated.")}</p>
    </section>`;
  }

  function heading(page,index,tag="h1",id="") {
    return `<header class="chapter-header"${id?` id="${id}"`:""}><div class="eyebrow">${mk(index)} / ${page.title}</div>
      <${tag}>${page.question}</${tag}><p>${page.summary}</p></header>`;
  }

  const renderPage = {markets,structure,fit,sources};

  function renderInterface() {
    const title = t("香港就业市场探索器","Hong Kong Graduate Career Explorer");
    document.documentElement.lang = language.code();
    document.title = t("毕业后，留在香港？","After graduation, stay in Hong Kong?") + " | " + title;
    document.querySelector('meta[name="description"]').content = t(
      "跟着嘉宁探索两地就业结构、香港行业、失业风险和薪酬，并试出适合自己的求职方向。",
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
  }

  function render(focusKey) {
    pathway.save(state);
    for(const details of main.querySelectorAll("details.appendix")) {
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
    for(const details of main.querySelectorAll("details.appendix")) {
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
  }

  function route() {
    const id=location.hash.slice(1);
    if(id==="content") { main.focus(); return; }
    const anchors = new Map([
      ["shortlist",["structure","pairs-heading"]], ["review",["structure","pairs-heading"]],
      ["risk",["markets","risk-heading"]], ["equity",["markets","pay-context-heading"]],
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

  function choose(id,multiple) {
    const selected=state.selected;
    state.selected=multiple
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
    if(key==="marketPeriod") state.marketPeriod=value;
    if(key==="resetWageRate") state.wageRate=defaultWageRate;
    if(key==="overviewYear") {
      if (+value<2016) return;
      state.overviewYear=+value;
    }
    if(key==="equityYear") {
      if (+value<2008) return;
      state.equityYear=+value;
    }
    if(key==="riskYear") {
      if (Math.floor(+value)>2025) return;
      state.riskYear=Math.floor(+value);
    }
    if(key==="riskCell") {
      const [year,age]=value.split("|");
      state.riskYear=+year;
      state.age=age;
    }
    if(key==="bubble") choose(value,e.ctrlKey||e.metaKey);
    if(key==="toggleIndustry") choose(value,true);
    if(key==="offerMedian") state.offer=+value;
    if(key==="profileExample") loadExampleProfile();
    if(key==="clearProfile") {
      state.profile=pathway.emptyProfile();
      state.taskOccupations={};
      state.occupations="all";
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
    if(key==="occupationGroup") state.occupations=value;
    if(key==="taskOccupation") {
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
      pathway.save(state);
      location.hash="fit";
      return;
    }
    if(key==="case") {
      loadExampleProfile();
      Object.assign(state,{
        pairs:pathway.examplePairs(true),selected:[],payYear:2025,startYear:2016,vacancyMode:"count",
        targetPay:25000,maxHours:42,targetSurplus:6000,offer:25000,rent:10000,living:6500,deduct:2000,
      });
    }
    const focusKey = key==="addPair" ? "vacancyCell:"+value : el.dataset.focus;
    render(focusKey);
    if(key==="occupationGroup") $("hiring").scrollIntoView({block:"start"});
  }

  main.addEventListener("click",e=>{
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
    if(e.key==="Escape") tooltip.hidden=true;
  });
  main.addEventListener("change",e=>{
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
    if(key==="industry") state.selected=e.target.value==="all"?[]:[e.target.value];
    else if(typeof state[key]==="number") {
      if(e.target.value==="") { e.target.value=state[key]; return; }
      const want=Number(e.target.value);
      if(!Number.isFinite(want)) { e.target.value=state[key]; return; }
      state[key]=want;
    } else state[key]=e.target.value;
    render(e.target.id);
  });
  main.addEventListener("input",e=>{
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
  function showTip(el,event) {
    if(!el) return;
    const rect=el.getBoundingClientRect();
    const x=event?.clientX ?? rect.left+rect.width/2;
    const y=event?.clientY ?? rect.bottom;
    tooltip.textContent=el.dataset.tip;
    tooltip.hidden=false;
    const padding=8;
    tooltip.style.left=Math.max(padding,Math.min(x+12,innerWidth-tooltip.offsetWidth-padding))+"px";
    tooltip.style.top=(y+tooltip.offsetHeight+14>innerHeight?Math.max(padding,y-tooltip.offsetHeight-10):y+12)+"px";
  }
  main.addEventListener("pointermove",e=>{
    const hit=e.target.closest("[data-tip]");
    if(hit) showTip(hit,e); else tooltip.hidden=true;
  });
  main.addEventListener("pointerleave",()=>{ tooltip.hidden=true; });
  main.addEventListener("focusin",e=>showTip(e.target.closest("[data-tip]")));
  main.addEventListener("focusout",()=>{ tooltip.hidden=true; });
  $("language").addEventListener("change",e=>{
    const drafts=[...main.querySelectorAll('input[type="number"]')].map(input=>[input.id,input.value]);
    language.set(e.target.value);
    renderInterface();
    render("language");
    for(const [id,value] of drafts) $(id).value=value;
  });
  window.addEventListener("scroll",()=>{ tooltip.hidden=true; },{passive:true});
  window.addEventListener("hashchange",route);
  renderInterface();
  route();
})();
