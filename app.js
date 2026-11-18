(() => {
  "use strict";
  const d = globalThis.guideData;
  const c = globalThis.guideCharts;
  const {esc, number, percent, money, colors, purple, rose, legend, empty} = c;
  const $ = id => document.getElementById(id);
  const main = $("content");
  const tooltip = $("chart-tooltip");
  const charts = new Map();
  let chapter, observers = [];
  const item = (id, title, subtitle, question, summary) => ({id,title,subtitle,question,summary});
  const pages = [
    item("markets","两地对照","从哪里开始找？","两地的就业结构，有什么不同？","先把香港放进内地与香港的对照中。年龄结构和行业分布提供探索方向，也提醒嘉宁进一步查看当下的职位需求。"),
    item("structure","香港就业版图","把行业变成岗位方向","香港的工作主要在哪里？","把全港就业规模、行业占比和职业构成放在一起。选一个年份，看行业规模如何变化，再辨认可以搜索的职业方向。"),
    item("risk","失业与恢复","为求职留多少时间？","市场转弱时，谁更容易承压？","嘉宁准备第一份全职工作，因此关心和自己年龄相近的人，以及不同教育组在过去几轮冲击中的走势。"),
    item("equity","性别与收入","如何理解行业月薪？","行业薪酬数字，代表了谁？","从劳动参与到收入，把全港中位数和行业分布分开读。嘉宁会把观察到的差异转成核查岗位职级、工时和薪酬带的问题。"),
    item("fit","生成求职清单","决定优先投什么","把市场机会变成投递清单","先看哪些行业和职业有空缺，再用工资、工时和每月预算做个人筛选。清单按实际门槛排序，并列出每个方向还需核查的条件。"),
  ];
  const state = {
    marketPeriod:"latest", overviewYear:2025, riskYear:2025, age:"20 - 24", equityYear:2025,
    selected:[], vacancyMode:"count", payYear:2025, startYear:2016,
    targetPay:25000, maxHours:42, targetSurplus:6000, offer:25000, rent:10000, living:6500, deduct:2000,
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
  const label = x => aliases[x] ?? x;
  const span = (a,b) => Array.from({length:b-a+1},(_,i)=>i+a);
  const q = row => row.year + (row.quarter-1)/4;
  const quarter = n => Math.floor(n) + "Q" + (Math.round((n % 1)*4)+1);
  const historyX = p => Number(p.slice(0,4)) + (Number(p.slice(-1))-1)/4;
  const ageLabel = key => key.replace(" - ","–") + " 岁";
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
  const select = (key,title,choices,render=String) => `<label class="field">${title}<select id="${key}" data-control="${key}">
    ${choices.map(v=>`<option value="${esc(v)}"${state[key]===v?" selected":""}>${esc(render(v))}</option>`).join("")}</select></label>`;
  const budgetField = (key,title,step) => `<label class="field">${title}<input id="${key}" type="number" min="0" max="${key==="maxHours"?168:10000000}" step="${step}" value="${state[key]}" data-control="${key}"></label>`;
  const controls = (...items) => `<div class="control-bar">${items.join("")}</div>`;
  const stats = (...items) => `<div class="stats">${items.map(([value,caption])=>`<div class="stat"><strong>${value}</strong><span>${caption}</span></div>`).join("")}</div>`;
  const chip = (action,value,title,pressed) => `<button type="button" class="chip" data-action="${action}" data-value="${esc(value)}" data-focus="${esc(action+":"+value)}"${pressed===undefined?"":` aria-pressed="${pressed}"`}>${esc(title)}</button>`;
  const series = (id,sets,options) => viz(id,w=>c.series(w,sets,options));
  const lineSet = (name,points,color=purple,dash=false) => ({name,points,color,dash});
  const mk = i => String(i).padStart(2,"0");
  const next = i => `<a href="#${pages[i+1].id}" class="next"><span><small>下一章 · ${mk(i+1)}</small><strong>${pages[i+1].subtitle}</strong></span><span aria-hidden="true">→</span></a>`;

  function markets() {
    const snapshot = d.markets.filter(r=>r.kind==="A_2010年龄对照");
    const current = d.markets.filter(r=>r.kind===(state.marketPeriod==="early"?"F_行业35_早期":"G_行业35_最新"));
    const paired = rows => [...by(rows,"order")].sort(([a],[b])=>a-b).map(([,rs])=>({
      name:label(rs[0].label), values:["内地","香港"].map(region=>rs.find(r=>r.region===region)?.value),
    }));
    const palette = [purple,rose], keys = legend([["内地",purple],["香港",rose]]);
    const era = state.marketPeriod==="early"?"内地 2010 年 · 香港 2011 年":"内地 2020 年 · 香港 2021 年";
    const hero = `<section class="hero"><div class="hero-copy"><p class="eyebrow">毕业求职 · 两地市场</p><h1>毕业后，<br>留在香港？</h1>
      <p>嘉宁在香港读完硕士，正在考虑第一份全职工作。跟着她比较两地市场、评估留港风险，最后列出值得优先投递的方向。</p>
      <a class="hero-button" href="#market-compare" data-scroll="market-compare">开始比较 <span aria-hidden="true">↓</span></a></div>
      <img class="hero-image" src="assets/harbour.webp" alt="维多利亚港傍晚的香港岛天际线，生成示意图"></section>`;
    return hero + heading(pages[0],0,"h2","market-compare")
      + grid(
        figure("ages","就业人口年龄结构","2010 年 · 各年龄段占比",
          c.bars(paired(snapshot),{colors:palette,labels:["内地","香港"],mirror:true,max:18,format:percent,label:"2010年两地就业人口年龄结构镜像图"}),
          "每行比较同一年龄段，左为内地、右为香港。沿用原表对齐分组，仅显示列出的年龄段，各列未重归一；两地就业统计定义有差异。",
          {key:keys}),
        figure("youth","各行业 35 岁以下就业占比",era,
          c.bars(paired(current),{colors:palette,labels:["内地","香港"],max:70,format:percent,label:"两地各行业35岁以下就业占比"}),
          "分母是各地各行业的就业人数。时点相差一年，行业为原项目合并分类。内地行业细分属于原项目估计，用于观察结构，不宜用于精确排名。",
          {key:keys,control:`<div class="chip-row">${chip("marketPeriod","early","早期",state.marketPeriod==="early")}${chip("marketPeriod","latest","较新",state.marketPeriod==="latest")}</div>`}))
      + next(0);
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
    return heading(pages[1],1) + stats([number(total)+" 千人",year+" 年香港就业总量"],
      [percent(biggest.values[years.indexOf(year)]),label(biggest.name)+"的就业份额"],
      [percent(status.find(r=>r.name==="Employees").status/status.reduce((a,r)=>a+r.status,0)*100),year+" 年雇员占比"])
      + controls(select("overviewYear","联动年份",span(2016,2025).reverse()),'<p class="mode-note">点两张趋势图的 2016 年后位置，或用年份菜单同步更新截面。</p>')
      + grid(
        figure("employment","香港就业总量","2008–2025 年 · 千人",
          series("employment-line",[lineSet("就业总量",d.total.map(r=>[r.year,r.value,r.year+" 年 · "+number(r.value)+" 千人"]))],
            {xTicks:[2008,2012,2016,2020,2025],y:[0,4200],yTicks:[0,1000,2000,3000,4000],refX:year,action:"overviewYear",canSelect:x=>x>=2016,label:"香港就业总量年度折线图"}),
          "线高表示全港就业人数，竖虚线是选中的年份。早期年份供趋势比较，雇佣身份和职业构成从 2016 年起联动。"),
        figure("industry","行业就业占比","2008–2025 年 · 占全港就业的百分比",
          viz("industry-area",w=>c.stack(w,sets,years,year,"overviewYear")),
          "各色带厚度代表行业的就业份额。份额增长也可能发生在全港就业总量下滑时，适合与左侧折线一起读。",
          {key:legend(sets.map(s=>[s.name,s.color]))}),
        figure("employment-status","雇佣身份构成",year+" 年 · 就业人数",
          c.donut(status.map(r=>({name:label(r.name),value:r.status}))),
          "比较受雇、自雇等身份的结构。刚毕业时可以从雇员岗位入手，再按具体工作形式扩展搜索。"),
        figure("occupation","职业构成",year+" 年 · 方块面积为就业人数",
          c.treemap(work.map(r=>({name:label(r.name),value:r.work}))),
          "职业描述做什么，行业描述雇主经营什么。同一职业可以出现在多个行业。聚焦色块可读出完整名称、人数和占比。"))
      + next(1);
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
    const eduSets = [...by(d.risk.filter(r=>r.kind==="unemployment_education"),"education")].map(([n,rs],i)=>
      lineSet(label(n),rs.map(r=>[r.year,r.value]).sort((a,b)=>a[0]-b[0]),[purple,rose,"#477b75"][i],i===1));
    const displayYears=span(Math.max(ageYears[0],year-5),Math.min(ageYears.at(-1),year+5));
    const riskTable=heatTable(ageNames.map(a=>({name:ageLabel(a),key:a})),displayYears,
      (name,y)=>ageData.find(r=>r.year===y&&r.age===name)?.value,
      (value,a,y)=>({text:percent(value),opacity:.10+Math.min(value/18,1)*.62,action:"riskCell",key:y+"|"+a.key,selected:y===year&&a.key===age}),
      "年龄组", "失业率年龄与年份热力图");
    return heading(pages[2],2) + stats(
      [percent(annual),year+" 年四个季度失业率的算术平均"],
      [percent(ageValue),year+" 年 · "+ageLabel(age)+"失业率"],
      [percent(quarterly.at(-1).value),quarter(q(quarterly.at(-1)))+" 全港失业率"])
      + controls(select("riskYear","观察年份",ageYears.slice().reverse()),
        select("age","观察年龄",ageNames,ageLabel),
        '<p class="mode-note">点季度折线、教育折线或热力图单元格，可以切换观察年份。</p>')
      + grid(
        figure("quarters","全港季度失业率","1985Q1–2026Q2 · %",
          series("quarter-line",[lineSet("失业率",quarterly.map(r=>[q(r),r.value,quarter(q(r))+" · "+percent(r.value)]))],
            {xTicks:[1985,1995,2005,2015,2026],y:[0,10],yFormat:percent,refX:year,action:"riskYear",canSelect:x=>x<2026,label:"全港季度失业率折线图"}),
          "折线上的峰值定位市场承压阶段。年龄及教育的年度资料截至 2025 年，点 2026 年季度可读该点数据。"),
        figure("crises","危机后的恢复路径","事件相对季度 · 失业率变化（百分点）",
          series("event-line",eventSets,{xTicks:[-8,-4,0,4,8,12,16],y:[-4,4],refX:0,refY:0,label:"三次危机失业率变化对齐图",xFormat:n=>n>0?"+"+n:String(n)}),
          "第 0 季度为事件发生季。每条线减去该事件前一季的失业率，低于 0 表示低于该基准。适合比较恢复过程，无法分离单一冲击的因果影响。",
          {key:legend(eventSets.map(s=>[s.name,s.color]))}),
        figure("risk-age","哪些年龄段承压？","年度失业率 · 通过年份切换显示窗口",
          riskTable,"热力越深，失业率越高。点单元格同步选择年龄和年份。为避免同一人落入两组，只用互不重叠的年龄段。",{full:true}),
        figure("risk-education","不同教育组的失业率","年度失业率 · 三个汇总教育组",
          series("education-line",eduSets,{xTicks:[1985,1995,2005,2015,2025],y:[0,10],yFormat:percent,refX:year,action:"riskYear",label:"不同教育组失业率折线图"}),
          "按最高教育程度比较三个总体序列。专上教育包括学位与非学位，也包括不同年龄与年资的人。",
          {key:legend(eduSets.map(s=>[s.name,s.color])),full:true}))
      + next(2);
  }

  function equity() {
    const year = state.equityYear;
    const snapshot = d.equity.filter(r=>r.year===year);
    const overall = d.equity.filter(r=>r.kind==="overall");
    const sexes = ["Female","Male"];
    const sexNames = ["女性","男性"], palette=[rose,purple], keys=legend(sexNames.map((n,i)=>[n,palette[i]]));
    const bands = snapshot.filter(r=>r.kind==="industry");
    const ages = snapshot.filter(r=>r.kind==="age_group");
    const getOverall = sex => snapshot.find(r=>r.kind==="overall"&&r.sex===sex)?.pay;
    const genderSets = (rows,field,x) => sexes.map((sex,i)=>
      lineSet(sexNames[i],rows.filter(r=>r.sex===sex).map(r=>[x(r),r[field],
        field==="participation"?`${sexNames[i]} · ${ageLabel(r.name)} · ${percent(r[field])}`: `${sexNames[i]} · ${r.year} 年 · ${money(r[field])}`
      ]).sort((a,b)=>a[0]-b[0]),palette[i],i===0));
    const female=getOverall("Female"), male=getOverall("Male");
    const industry=[...by(bands,"name")].map(([name,rs])=>({name:label(name),values:sexes.map(s=>rs.find(r=>r.sex===s)?.pay)}));
    const ageNames=unique(ages.map(r=>r.name)).sort((a,b)=>a.localeCompare(b,"zh-HK",{numeric:true}));
    const ageTicks=ageNames.map((_,i)=>i).filter(i=>i%2===0);
    return heading(pages[3],3) + stats([money(female),year+" 年女性月收入中位数"],
      [money(male),year+" 年男性月收入中位数"],[percent((male-female)/male*100),"总体差额 ÷ 男性中位数"])
      + controls(select("equityYear","联动年份",span(2008,2025).reverse()),'<p class="mode-note">点趋势图上的年份，同步更新行业收入和劳动参与截面。</p>')
      + grid(
        figure("income-trend","男女总体月收入走势","1985–2025 年 · 港元／月",
          series("income-line",genderSets(overall,"pay",r=>r.year),{xTicks:[1985,1995,2005,2015,2025],y:[0,30000],
            yTicks:[0,10000,20000,30000],yFormat:n=>number(n/1000)+"k",refX:year,action:"equityYear",canSelect:x=>x>=2008,label:"男女总体月收入各年中位数折线图"}),
          "线条展示男女各自就业群体的名义月收入中位数。点击 2008–2025 年数据点可联动当年截面。",
          {key:keys}),
        figure("income-industry","行业月收入中位数",year+" 年 · 港元／月",
          c.bars(industry,{labels:sexNames,colors:palette,max:Math.max(35000,...industry.flatMap(r=>r.values).filter(Number.isFinite)),format:number,label:"同年各行业男女月收入中位数对照"}),
          "每行比较同一行业的两组就业人口。职业、年资、全职比例与工时可能不同，行业差额不能用来推断同岗薪酬差额。",
          {key:keys}),
        figure("participation","按年龄分组的劳动参与率",year+" 年 · 劳动力占同组人口的比例",
          series("participation-points",genderSets(ages,"participation",r=>ageNames.indexOf(r.name)),
            {x:[0,ageNames.length-1],xTicks:ageTicks,xFormat:i=>ageNames[i].replace(" - ","–"),y:[0,100],
              yFormat:percent,pointsOnly:true,label:"男女分年龄组劳动参与率散点图"}),
          "劳动参与包括就业者和失业者。譬如仍在读书的人可能不在劳动力内，所以参与率与找到工作的概率是两个指标。",
          {key:keys,full:true}))
      + next(3);
  }

  function heatTable(rows, cols, read, format, corner, description) {
    return `<div class="table-scroll" tabindex="0" aria-label="${esc(description)}，可横向滚动"><table class="heat" aria-label="${esc(description)}">
      <thead><tr><th scope="col">${corner}</th>${cols.map(x=>`<th scope="col">${esc(x.name ?? x)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${cols.map(x=>{
        const value=read(r.key,x.id ?? x), f=format(value,r,x);
        if(!Number.isFinite(value)) return "<td>—</td>";
        const tip=r.name+" · "+(x.name ?? x)+" · "+f.text;
        return `<td><button type="button" data-action="${f.action}" data-value="${esc(f.key)}" data-focus="${esc(f.action+":"+f.key)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${f.selected}" style="background:rgba(117,63,133,${f.opacity});color:${f.opacity>.62?"white":"#27192c"}">${f.text}</button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function candidate(row) {
    const outgoings = state.rent+state.living+state.deduct;
    const surplus=Number.isFinite(row.pay50)?row.pay50-outgoings:null;
    const missing=![row.pay50,row.hours50,surplus].every(Number.isFinite);
    const issues = [
      Number.isFinite(row.pay50)&&row.pay50<state.targetPay?"月薪低于目标":null,
      Number.isFinite(row.hours50)&&row.hours50>state.maxHours?"工时高于上限":null,
      Number.isFinite(surplus)&&surplus<state.targetSurplus?"月结余低于目标":null,
      missing?"缺少工资或工时数据":null,
    ].filter(Boolean);
    return {...row,surplus,issues,match:!issues.length,missing,demand:d.demand.find(x=>x.id===row.id)};
  }

  function intervals(rows, type) {
    const pay=type==="pay", target=pay?state.targetPay:state.maxHours;
    const step=pay?10000:10;
    const upper=Math.max(pay?50000:60,target, ...rows.map(r=>r[type+"75"] ?? 0));
    const upperTick=Math.ceil(upper/step)*step;
    const low=pay?0:Math.min(30,target,...rows.map(r=>r.hours25 ?? 30));
    const high = upperTick===low ? upperTick+step : upperTick;
    const position=v=>((v-low)/(high-low)*100);
    const shortTarget=pay?money(target):number(target)+" 小时";
    return `<div class="legend"><span><i style="background:#cdb5de"></i>P25–P75</span><span><i style="background:${rose}"></i>P50</span><span>虚线 · ${pay?"期望月薪":"期望每周工时上限"} ${shortTarget}</span></div>
      ${rows.map(r=>{
        const a=r[type+"25"], m=r[type+"50"], b=r[type+"75"];
        const tip=r.name+" · "+[a,m,b].map(number).join(" / ")+" · "+(pay?"港元／月":"小时／周");
        return `<div class="range-lane"><span class="range-name">${esc(r.name)}</span><div class="range-track">
          <span class="range-ref" style="left:${position(target)}%"></span>
          ${[a,b].every(Number.isFinite)?`<span class="range-band" style="left:${position(a)}%;width:${position(b)-position(a)}%" data-tip="${esc(tip)}"></span>`:""}
          ${Number.isFinite(m) ? `<button type="button" class="range-point" style="left:${position(m)}%" data-tip="${esc(tip)}" aria-label="${esc(tip+(pay?" · 带入预算":""))}"
              ${pay?` data-action="offerMedian" data-value="${m}" data-focus="${esc("offerMedian:"+m+":"+r.name)}"`:""}></button>
            <span class="range-value${position(m)>68?" left":""}" style="left:${position(m)}%">${number(m)}</span>` : '<span class="range-value">缺测</span>'}
          </div></div>`;
      }).join("")}
      <div class="range-axis">${span(0,4).map(i=>`<span>${number(low+(high-low)*i/4)}</span>`).join("")}</div>`;
  }

  function fit() {
    const picked=state.selected;
    const chosen=d.demand.filter(r=>!picked.length||picked.includes(r.id));
    const active=new Set(chosen.map(x=>x.id));
    const rows=d.pay.filter(r=>r.year===state.payYear&&active.has(r.id)).map(candidate);
    const ranked=rows.slice().sort((a,b)=>Number(b.match)-Number(a.match)||Number(a.missing)-Number(b.missing)
      ||a.issues.length-b.issues.length||(b.surplus ?? -Infinity)-(a.surplus ?? -Infinity)||a.name.localeCompare(b.name,"zh-Hans"));
    const matched=ranked.filter(r=>r.match);
    const budget=state.offer-state.rent-state.living-state.deduct;
    const demandLabels=unique(d.occupations.map(r=>r.name)).map(n=>({name:label(n),key:n}));
    const max = Math.max(1,...d.occupations.map(r=>r.count ?? 0));
    const isCount=state.vacancyMode==="count";
    const heat=heatTable(demandLabels,chosen,
      (occupation,id)=>d.occupations.find(r=>r.id===id&&r.name===occupation)?.[state.vacancyMode],
      (v,_,r)=>({text:isCount?number(v):percent(v*100),opacity:.12+.66*Math.sqrt(v/(isCount?max:1)),
        action:"selectIndustry",key:r.id,selected:picked.includes(r.id)}),
      "职业组","行业职业空缺热力图");
    const end=Math.max(...d.history.map(r=>historyX(r.period)));
    const history=chosen.map((item,i)=>{
      const data=d.history.filter(r=>r.id===item.id&&historyX(r.period)>=state.startYear)
        .map(r=>[historyX(r.period),r.value,`${item.name} · ${r.period} · 指数 ${number(r.value)}`]).sort((a,b)=>a[0]-b[0]);
      return lineSet(item.name,data,colors[i%colors.length],i%3===1);
    });
    const hValues=history.flatMap(s=>s.points.map(p=>p[1])).filter(Number.isFinite);
    const histMin=Math.floor(Math.min(100,...hValues)/10)*10;
    const histMax=Math.ceil(Math.max(110,...hValues)/10)*10;
    const histYears=span(state.startYear,Math.floor(end)).filter((y,i,a)=>a.length<=6||i%2===0||i===a.length-1);
    const status = matched.length ? "优先查证："+matched.map(r=>r.name).join("、")
      : "目前没有同时满足三项条件的方向。";
    const selectionDescription = picked.length ? chosen.map(r=>r.name).join("、") : "全部纳入（10 个行业大类）";
    const table = `<div class="table-scroll" tabindex="0" aria-label="候选方向对照，可横向滚动"><table class="compact-table"><thead><tr><th scope="col">细分行业</th><th scope="col">月薪 P50<br>港元</th><th scope="col">周工时 P50<br>小时</th><th scope="col">月结余<br>港元</th><th scope="col">空缺率<br>行业大类</th><th scope="col">用工同比<br>行业大类</th><th scope="col" class="status-cell">期望匹配</th></tr></thead>
      <tbody>${ranked.map(r=>`<tr data-industry="${esc(r.id)}"><th scope="row">${esc(r.name)}<span class="subcell" data-tip="${esc(r.mapping || r.demand.name)}">${esc(r.demand.name)}</span></th>
        <td>${number(r.pay50)}</td><td>${number(r.hours50)}</td><td>${number(r.surplus)}</td>
        <td>${percent(r.demand.rate*100)}</td><td>${percent(r.demand.yoy*100)}</td>
        <td class="status-cell"><strong class="${r.match?"good":"check"}">${r.match?"符合期望":r.missing?"待补资料":"未达期望"}</strong>
          <span class="subcell">${r.match?"核对职位报价及实际工时":r.issues.join(" · ")}</span></td></tr>`).join("")}</tbody></table></div>`;
    return heading(pages[4],4) + stats([rows.length+" 个","当前筛选的薪酬细分行业"],[matched.length+" 个","同时满足月薪、工时和结余"],
      [money(budget),"按当前 Offer 假设计算的月结余"])
      + `<div class="decision" aria-live="polite"><strong>${esc(status)}</strong>
          <p>当前行业范围：${esc(selectionDescription)}。表内结余按行业月薪 P50 估算，预算图按个人 Offer 假设计算。</p>
          <div class="chip-row">${chip("case","jia","载入嘉宁的演示方案")}${chip("resetIndustries","all","看全部行业")}</div></div>`
      + `<section aria-labelledby="find-heading"><header class="subhead"><h2 id="find-heading">哪里有空缺？</h2></header>`
      + controls(`<label class="field">单选行业<select id="industry" data-control="industry">
          <option value="all"${!picked.length?" selected":""}>全部行业</option>
          ${picked.length>1?'<option value="multiple" selected disabled>已多选行业</option>':""}
          ${d.demand.map(x=>`<option value="${x.id}"${picked.length===1&&picked[0]===x.id?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label>`,
          `<div class="chip-row" role="group" aria-label="多选行业">${d.demand.map(x=>chip("toggleIndustry",x.id,x.name,picked.includes(x.id))).join("")}</div>`)
      + grid(
        figure("map","招聘机会地图","2026Q2 · 横轴空缺率 · 纵轴用工同比",
          viz("map-bubbles",w=>c.bubbles(w,d.demand,picked)),
          "圆面积表示空缺人数。横虚线表示同比 0%，竖虚线表示调查总体空缺率 1.7%。点气泡单选，Ctrl／⌘ 点按或用行业按钮多选，更新空缺表、薪酬、工时、历史和候选清单。",
          {key:legend([["用工增加",purple],["用工减少",rose]])}),
        figure("vacancies","行业 × 职业空缺","2026Q2 · 行业大类与九个职业组",
          heat,"空缺人数回答「有多少」，行业内占比回答「主要招什么」。点格子以所属行业重新筛选，职业口径保留为调查职业组。",
          {control:select("vacancyMode","单元格显示",["count","share"],v=>v==="count"?"空缺人数":"行业内占比")}))
      + `</section><section aria-labelledby="conditions-heading"><header class="subhead"><h2 id="conditions-heading">待遇能否支撑留港？</h2></header>`
      + `<form class="control-bar" data-budget-form>${select("payYear","工资参考年",span(2016,2025).reverse())}
        ${budgetField("targetPay","期望月薪（港元）",1)}${budgetField("maxHours","期望每周工时上限",.1)}${budgetField("targetSurplus","期望月结余（港元）",1)}
        <button class="chip apply-budget" type="submit" id="apply-targets">更新目标</button></form>`
      + grid(
        figure("pay-range","月薪分位区间",state.payYear+" 年 5–6 月 · 全职雇员 · 港元／月",
          intervals(rows,"pay"),"浅紫线段是第 25 至 75 百分位，保留行业中间一半的范围；圆点是中位数。点圆点可将该行业月薪带入预算。"),
        figure("hours-range","每周工时区间",state.payYear+" 年 5–6 月 · 全职雇员 · 小时／周",
          intervals(rows,"hours"),"虚线是你设定的每周工时上限。即使中位数达标，仍可用整个区间判断是否要在面试中先问加班。"),
        figure("budget","个人生活预算","可编辑示例 · 港元／月",
          `<form class="control-bar" data-budget-form>${budgetField("offer","Offer 月薪",1)}${budgetField("rent","每月房租",1)}${budgetField("living","生活交通",1)}${budgetField("deduct","预留扣款",1)}
          <button class="chip apply-budget" type="submit" id="apply-budget">更新预算</button></form>`
          +viz("budget-waterfall",w=>c.waterfall(w,state)),
          "从 Offer 月薪扣去三项开支。预留扣款由你填写；可把预计税款和强积金统一填入，实际金额以适用规定和合约为准。",
          {full:true}))
      + `</section><section aria-labelledby="shortlist-heading"><header class="subhead"><h2 id="shortlist-heading">哪些方向值得优先投？</h2></header>`
      + grid(
        figure("history","行业用工走势","季度 · 以 2016Q1 为 100",
          series("history-line",history,{x:[state.startYear,end],xTicks:histYears,y:[histMin,histMax],refY:100,
            xFormat:String,label:"所选行业季度用工指数折线图"}),
          "指数是当季就业人数除以该行业 2016Q1 人数后乘 100。选择起始年只缩短展示范围，基期保持原值。线条描述行业规模，无法估计个人失业风险。",
          {control:select("startYear","历史起始年",span(2016,2025)),key:legend(history.map(s=>[s.name,s.color])),full:true}),
        figure("candidates","候选方向对照","三项门槛都达到的方向排在前面",
          ranked.length?table:empty("所选行业没有该参考年的工资、工时记录。"),
          "公司面试时还需核对实际薪酬、工时、签证及工作安排。空缺率为「空缺人数 ÷（就业人数＋空缺人数）」，用工同比为「本季就业人数 ÷ 上年同季就业人数 − 1」，换算为百分比后展示。",
          {full:true}))
      + "</section>";
  }

  function sources() {
    return `<header class="chapter-header"><h1>数据来源与统计口径</h1>
    <p>图表由项目整合 Excel 中的 Tableau 提取数据生成。各章按其调查范围和观察期展示。</p></header>
    <section class="card source-card">
      <h3>两地对照</h3>
      <ul><li><a href="https://www.stats.gov.cn/sj/pcsj/rkpc/5rp/html/l0404.htm">内地 2010 年人口普查</a>、<a href="https://www.stats.gov.cn/sj/pcsj/rkpc/6rp/html/B0402a.htm">内地 2020 年人口普查</a>。行业 35 岁以下占比沿用项目的对齐和估计，分类与时点见图注。</li>
      <li><a href="https://www.censtatd.gov.hk/en/web_table.html?id=210-06201">香港政府统计处 210-06201</a>提供劳动人口背景。两地行业、年龄定义及年份见整合 Excel 的「00_口径限制」。</li></ul>
      <h3>香港就业、失业与收入</h3>
      <ul><li>就业规模和构成来自整合 Excel 的 <code>01_01</code>、<code>01_02</code> 工作表。失业率、年龄和教育数据来自 <code>04_05</code>。</li>
      <li>性别页来自 <code>03_04</code>。参考统计处 <a href="https://www.censtatd.gov.hk/en/web_table.html?id=210-06201">210-06201（劳动参与）</a> 与 <a href="https://www.censtatd.gov.hk/en/web_table.html?id=210-06316">210-06316（行业月入）</a>。网站保留名义收入及各数据集的调查定义。</li></ul>
      <h3>求职清单</h3>
      <ul><li><a href="https://www.censtatd.gov.hk/en/web_table.html?id=215-16001">215-16001（机构就业及空缺）</a>、<a href="https://www.censtatd.gov.hk/en/web_table.html?id=215-16007">215-16007（行业 × 职业空缺）</a>，需求截面为 2026Q2，只涵盖调查行业，不含公务员。</li>
      <li><a href="https://www.censtatd.gov.hk/en/web_table.html?id=220-23015">220-23015（全职月薪分布）</a>、<a href="https://www.censtatd.gov.hk/en/web_table.html?id=220-23034">220-23034（全职工时分布）</a>，采用 2016–2025 年各年 5–6 月数据。大类和细分行业对应关系见项目数据说明。</li>
      <li>匹配采用 P50。月薪须达到下限，工时须不高于上限，月结余须达到下限。匹配项优先，随后按未达项数、估算结余排序，缺资料项排后。数据缺失显示为破折号或「待补资料」。</li></ul>
      <h3>项目参考</h3><p>图表卡片和市场探索的呈现参考组员的 <a href="https://github.com/ketianli082-stack/hong-kong-job-market-explorer">Hong Kong Job Market Explorer</a>。嘉宁是演示用的虚构人物，封面为生成图像。</p>
    </section>`;
  }

  function heading(page,index,tag="h1",id="") {
    return `<header class="chapter-header"${id?` id="${id}"`:""}><div class="eyebrow">${mk(index)} / ${page.title}</div>
      <${tag}>${page.question}</${tag}><p>${page.summary}</p></header>`;
  }

  const renderPage = {markets,structure,risk,equity,fit,sources};

  function render(focusKey) {
    observers.forEach(ob => ob.disconnect());
    observers = [];
    charts.clear();
    tooltip.hidden=true;
    const activePage=pages.find(p=>p.id===chapter);
    const title=activePage?.title ?? "数据与统计口径";
    $("breadcrumb").innerHTML = `研究路径 <span aria-hidden="true">/</span> ${title}`;
    $("chapters").className="chapter-nav";
    $("chapters").innerHTML=pages.map((p,i)=>`<a href="#${p.id}"${p.id===chapter?' aria-current="page"':""}>
      <span class="nav-number">${mk(i)}</span><span><strong>${p.title}</strong><small>${p.subtitle}</small></span></a>`).join("");
    main.innerHTML=renderPage[chapter]();
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
    const match=Object.hasOwn(renderPage,id) ? id : "markets";
    if(match===chapter) return;
    chapter=match;
    render();
    window.scrollTo(0,0);
    main.focus({preventScroll:true});
  }

  function choose(id,multiple) {
    const selected=state.selected;
    state.selected=multiple
      ? selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]
      : selected.length===1&&selected[0]===id?[]:[id];
  }
  function action(e,el) {
    const key=el.dataset.action, value=el.dataset.value;
    if(key==="marketPeriod") state.marketPeriod=value;
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
    if(key==="bubble"||key==="selectIndustry") choose(value,e.ctrlKey||e.metaKey);
    if(key==="toggleIndustry") choose(value,true);
    if(key==="resetIndustries") state.selected=[];
    if(key==="offerMedian") state.offer=+value;
    if(key==="case") Object.assign(state,{
      selected:["ind_K","ind_M_N","ind_I","ind_L"],payYear:2025,startYear:2016,vacancyMode:"count",
      targetPay:25000,maxHours:42,targetSurplus:6000,offer:25000,rent:10000,living:6500,deduct:2000,
    });
    render(el.dataset.focus);
  }

  main.addEventListener("click",e=>{
    const scroll=e.target.closest("[data-scroll]");
    if(scroll) {
      e.preventDefault();
      $(scroll.dataset.scroll).scrollIntoView({block:"start"});
      return;
    }
    const target=e.target.closest("[data-action]");
    if(target) action(e,target);
  });
  main.addEventListener("keydown",e=>{
    const target=e.target.closest("svg [data-action]");
    if(target&&(e.key==="Enter"||e.key===" ")) { e.preventDefault(); action(e,target); }
    if(e.key==="Escape") tooltip.hidden=true;
  });
  main.addEventListener("change",e=>{
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
  main.addEventListener("submit",e=>{
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
  window.addEventListener("scroll",()=>{ tooltip.hidden=true; },{passive:true});
  window.addEventListener("hashchange",route);
  route();
})();
