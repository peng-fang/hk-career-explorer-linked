/* Small, dependency-free chart renderers. Data and interactions live in app.js. */
(() => {
  "use strict";

  const {t,year:yearLabel} = globalThis.guideLanguage;
  const purple = "#8b86e8";
  const rose = "#cf8fb0";
  const colors = [purple, "#74b0d4", "#cf8fb0", "#93b88a", "#d4a87e", "#6fc0b4", "#b094d6", "#a8aec6", "#84a0d6"];
  const numberFormat = new Intl.NumberFormat("zh-HK", { maximumFractionDigits: 1 });
  const fixedFormat = new Intl.NumberFormat("zh-HK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number = n => Number.isFinite(n) ? numberFormat.format(n) : "—";
  const percent = n => Number.isFinite(n) ? fixedFormat.format(n) + "%" : "—";
  const money = n => Number.isFinite(n) ? "HK$" + number(n) : "—";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  const mark = (tip, kind, value, pressed, focusKey = kind + ":" + value) => {
    if (!kind) return `data-tip="${esc(tip)}"`;
    const selected = pressed === undefined ? "" : ` aria-pressed="${pressed}"`;
    return `class="mark" role="button" tabindex="0" aria-label="${esc(tip)}"${selected} data-tip="${esc(tip)}" data-action="${esc(kind)}" data-value="${esc(value)}" data-focus="${esc(focusKey)}"`;
  };
  const svg = (w, h, label, content) => `<svg viewBox="0 0 ${w} ${h}" aria-label="${esc(label)}">${content}</svg>`;
  const line = (x, y, x2, y2, cls) => `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const text = (x, y, label, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}">${esc(label)}</text>`;
  const scale = (a,b,c,d) => n => c + (n-a) / (b-a || 1) * (d-c);
  const empty = message => `<p class="empty">${esc(message)}</p>`;
  let gradSeq = 0;
  const tickList = (min,max,count = 4) => Array.from({length:count+1}, (_,i) => min+(max-min)*i/count);
  const legend = entries => `<div class="legend">${entries.map(([label, color]) =>
    `<span><i style="background:${color}"></i>${esc(label)}</span>`).join("")}</div>`;

  function axes(w, h, opt) {
    const left = opt.left ?? 47, right = w - (opt.right ?? 18);
    const top = opt.top ?? 16, bottom = h - (opt.bottom ?? 31);
    const x = scale(...opt.x, left, right), y = scale(...opt.y, bottom, top);
    const grid = (opt.yTicks ?? tickList(...opt.y)).map(t =>
      line(left,y(t),right,y(t),"gridline") + text(left-7,y(t)+4,(opt.yFormat ?? number)(t),"end")).join("");
    const time = (opt.xTicks ?? tickList(...opt.x)).map(t =>
      text(x(t),bottom+19,(opt.xFormat ?? number)(t))).join("");
    return {left,right,top,bottom,x,y,grid:grid+time};
  }

  function series(w, sets, opt) {
    const h = opt.height ?? 238;
    const visible = sets.flatMap(s => s.points.filter(p => Number.isFinite(p[1])));
    if (!visible.length) return empty(t("该条件下没有数据。","No data for this selection."));
    const xs = visible.map(p=>p[0]), ys = visible.map(p=>p[1]);
    const d = {
      ...opt, x: opt.x ?? [Math.min(...xs), Math.max(...xs)],
      y: opt.y ?? [Math.min(0,...ys), Math.ceil(Math.max(...ys) / 5)*5],
    };
    const a = axes(w,h,d);
    let out = "";
    out += a.grid;
    if (Number.isFinite(opt.refY)) out += line(a.left,a.y(opt.refY),a.right,a.y(opt.refY),"refline");
    if (Number.isFinite(opt.refX) && opt.refX >= d.x[0] && opt.refX <= d.x[1]) {
      out += line(a.x(opt.refX),a.top,a.x(opt.refX),a.bottom,"refline");
    }
    let defs = "";
    for (const s of sets) {
      let areaPath = "";
      if (opt.area || s.area) {
        const gid = "sa" + (++gradSeq);
        defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${s.color}" stop-opacity="${s.area ? ".26" : ".32"}"/>
          <stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
        const coords = [];
        for (const [x,y] of s.points) if (Number.isFinite(y)) coords.push([a.x(x), a.y(y)]);
        if (coords.length) {
          const top = coords.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ");
          areaPath = `<path d="M${coords[0][0]},${a.bottom} ${top} L${coords.at(-1)[0]},${a.bottom} Z" fill="url(#${gid})" stroke="none"/>`;
        }
      }
      out += areaPath + `<g class="series-g" data-ind="${s.key ?? ""}" opacity="${s.opacity ?? 1}">`;
      let draw = "", pen = false;
      for (const [x,y] of s.points) {
        if (!Number.isFinite(y)) { pen = false; continue; }
        draw += `${pen ? "L" : "M"}${a.x(x)},${a.y(y)} `;
        pen = true;
      }
      out += `<path d="${draw}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth ?? 2.4}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 3"' : ""}/>`;
      for (const [x,y,extra] of s.points) {
        if (!Number.isFinite(y)) continue;
        const tip = extra ?? `${s.name} · ${(opt.xFormat ?? number)(x)} · ${(opt.yFormat ?? number)(y)}`;
        const selected = x === opt.refX;
        const r = selected ? 4.7 : s.points.length > 55 ? 2.1 : 3.1;
        const action = !opt.canSelect || opt.canSelect(x) ? opt.action : null;
        out += `<circle cx="${a.x(x)}" cy="${a.y(y)}" r="${r}" fill="${s.color}" ${mark(tip,action,s.pointValue?.(x) ?? x,undefined,`${action}:${s.key ?? s.name}:${x}`)}/>`;
      }
      out += "</g>";
    }
    let cross = "";
    if (opt.hoverCross !== false) {
      const xVals = [...new Set(sets.flatMap(s => s.points.map(p => p[0])))].sort((a, b) => a - b);
      const fmtY = opt.yFormat ?? number, fmtX = opt.xFormat ?? number;
      cross += `<line class="hover-cross" x1="${a.left}" y1="${a.top}" x2="${a.left}" y2="${a.bottom}"/>`;
      xVals.forEach((xv, i) => {
        const cx = a.x(xv);
        const colLeft = i === 0 ? a.left : (a.x(xVals[i - 1]) + cx) / 2;
        const colRight = i === xVals.length - 1 ? a.right : (cx + a.x(xVals[i + 1])) / 2;
        const rows = sets.map(s => {
          const p = s.points.find(q => q[0] === xv);
          return p && Number.isFinite(p[1]) ? `${s.name}  ${fmtY(p[1])}` : null;
        }).filter(Boolean);
        const tip = `${fmtX(xv)}\n${rows.join("\n")}`;
        cross += `<rect class="x-capture" x="${colLeft}" y="${a.top}" width="${Math.max(1, colRight - colLeft)}" height="${a.bottom - a.top}"`
          + ` data-cross-x="${cx}" data-cross-tip="${esc(tip)}"/>`;
      });
    }
    return svg(w,h,opt.label,`<defs>${defs}</defs>`+out+cross);
  }

  function stack(w, sets, years, year) {
    const h = 246;
    const a = axes(w,h,{x:[years[0],years.at(-1)], y:[0,100], yFormat: percent,
      xFormat: String, xTicks: years.filter((_,i)=>i===years.length-1 || (i%4===0 && i<years.length-2))});
    let base = years.map(()=>0);
    let content = a.grid, defs = "";
    let targets = "";
    const midpoint = (a,b) => (a+b)/2;
    for (const [seriesIndex,s] of sets.entries()) {
      const high = years.map((_,i)=>base[i]+(s.values[i] ?? 0));
      const top = years.map((y,i)=>`${a.x(y)},${a.y(high[i])}`);
      const bottom = years.map((y,i)=>`${a.x(y)},${a.y(base[i])}`).reverse();
      const gid = "st" + (++gradSeq);
      defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${s.color}" stop-opacity=".96"/>
        <stop offset="1" stop-color="${s.color}" stop-opacity=".72"/></linearGradient>`;
      content += `<polygon class="stack-band" data-ind="${seriesIndex}" points="${[...top,...bottom].join(" ")}" fill="url(#${gid})"/>`;
      content += `<polyline class="stack-line" data-ind="${seriesIndex}" points="${top.join(" ")}" fill="none" stroke="${s.color}" stroke-width="1.1" opacity=".55" stroke-linejoin="round" stroke-linecap="round"/>`;
      // Follow both edges of the band to the midpoints between adjacent years.
      for (const [i,y] of years.entries()) {
        if (!Number.isFinite(s.values[i]) || s.values[i]<=0) continue;
        const prev = Math.max(0,i-1), next = Math.min(years.length-1,i+1);
        const left = a.x(midpoint(years[prev],y)), center = a.x(y), right = a.x(midpoint(y,years[next]));
        const edge = values => [
          `${left},${a.y(midpoint(values[prev],values[i]))}`,
          `${center},${a.y(values[i])}`,
          `${right},${a.y(midpoint(values[i],values[next]))}`,
        ];
        const tip = yearLabel(y) + "\n" + s.name + " " + percent(s.values[i]);
        const points = [...edge(high),...edge(base).reverse()].join(" ");
        targets += `<polygon points="${points}" fill="transparent" ${mark(tip,"overviewBand",`${seriesIndex}|${y}`)}/>`;
      }
      base = high;
    }
    content += line(a.x(year),a.top,a.x(year),a.bottom,"refline");
    return svg(w,h,t("各行业占全部香港就业的百分比堆叠面积图","Stacked area chart of industry shares in Hong Kong employment"),`<defs>${defs}</defs>`+content+targets);
  }

  function bars(rows, opt = {}) {
    const max = opt.max ?? Math.max(1, ...rows.flatMap(r=>r.values.filter(Number.isFinite)));
    const cap = opt.ticks ? 100 : opt.mirror ? 64 : 73;
    const format = opt.format ?? number;
    const draw = (row,i) => {
      const v = row.values[i];
      if (!Number.isFinite(v)) return "<span>—</span>";
      const value = format(v);
      const key = opt.keys?.[i] ?? row.key;
      const pressed = opt.active===key;
      const tip = [row.name,opt.labels?.[i],value].filter(Boolean).join(" · ");
      const dimmed = opt.active && !pressed ? " is-muted" : "";
      const style = `width:${Math.max(0,v/max)*cap}%;background:${opt.colors?.[i] ?? colors[i]}`;
      return opt.action
        ? `<button type="button" class="bar chart-bar${dimmed}" style="${style}" aria-label="${esc(tip)}" aria-pressed="${pressed}" data-tip="${esc(tip)}" data-action="${opt.action}" data-value="${esc(key)}" data-focus="${esc(`${opt.action}:${opt.label}:${row.name}:${i}`)}"><b>${esc(value)}</b></button>`
        : `<span class="bar" style="${style}" data-tip="${esc(tip)}"><b>${esc(value)}</b></span>`;
    };
    const axis = opt.ticks ? `<div class="bar-row" aria-hidden="true"><div class="bar-scale">${opt.ticks.map(v=>{
      const position = opt.mirror ? (v/max+1)*50 : v/max*100;
      return `<span style="left:${position}%">${esc(format(Math.abs(v)))}</span>`;
    }).join("")}</div></div>` : "";
    return `<div class="bars" role="group" aria-label="${esc(opt.label ?? t("条形图","Bar chart"))}">${rows.map(r=>{
      const tracks = opt.mirror
        ? `<div class="mirror">${r.values.map((_,i)=>`<span class="half">${draw(r,i)}</span>`).join("")}</div>`
        : `<div class="bars-track${r.values.length===1 ? " bar-single" : ""}">${r.values.map((_,i)=>draw(r,i)).join("")}</div>`;
      return `<div class="bar-row${r.highlighted?' bar-highlight':''}"><span class="name">${esc(r.name)}${r.highlighted ? `<span class="highlight-label">${t("所选方向所属大类","Category covering a pick")}</span>` : ""}</span>${tracks}</div>`;
    }).join("")}${axis}</div>`;
  }

  function donut(rows) {
    const total = rows.reduce((n,r)=>n+r.value,0);
    const size=190, cx=size/2, cy=size/2, r=size/2-16, sw=24, C=2*Math.PI*r;
    let offset=0, defs="", arcs="";
    rows.forEach((row,i)=>{
      const frac=row.value/total, len=frac*C, color=colors[i], gid="dn"+(++gradSeq);
      defs+=`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="1"/>
        <stop offset="1" stop-color="${color}" stop-opacity=".72"/></linearGradient>`;
      const tip=`${row.name} · ${percent(frac*100)}`;
      const raw=row.raw ?? row.name;
      arcs+=`<circle class="donut-slice" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${sw}"
        stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-offset}" data-tip="${esc(tip)}" data-status="${esc(raw)}"
        data-action="crossStatus" data-value="${esc(raw)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset+=len;
    });
    const svgDonut=`<svg viewBox="0 0 ${size} ${size}" class="donut-svg" role="img">
      <defs>${defs}</defs>${arcs}
      <text x="${cx}" y="${cy-1}" text-anchor="middle" class="donut-total">${number(total)}</text>
      <text x="${cx}" y="${cy+17}" text-anchor="middle" class="donut-sub">${esc(t("千人","thousand"))}</text></svg>`;
    return `<div class="donut-wrap">${svgDonut}
      <ul class="donut-legend">${rows.map((r,i)=>{const raw=r.raw??r.name;return `<li role="button" tabindex="0" data-action="crossStatus" data-value="${esc(raw)}" data-status="${esc(raw)}"><i style="background:${colors[i]}"></i><span>${esc(r.name)}</span><strong>${percent(r.value/total*100)}</strong></li>`;}).join("")}</ul></div>`;
  }

  function treemap(rows) {
    const ranked = rows.slice().sort((a,b)=>b.value-a.value);
    const total = ranked.reduce((a,b)=>a+b.value,0);
    function layout(group,x,y,w,h) {
      if (group.length===1) return [{...group[0],x,y,w,h}];
      const sum = group.reduce((a,b)=>a+b.value,0);
      let breakpoint=1, acc=group[0].value;
      while (breakpoint<group.length-1 && acc<sum/2) { acc+=group[breakpoint].value; breakpoint++; }
      const a=group.slice(0,breakpoint), b=group.slice(breakpoint), f=acc/sum;
      return w>=h*1.5
        ? [...layout(a,x,y,w*f,h),...layout(b,x+w*f,y,w*(1-f),h)]
        : [...layout(a,x,y,w,h*f),...layout(b,x,y+h*f,w,h*(1-f))];
    }
    return `<div class="treemap" aria-label="${t("职业人数矩形树图","Treemap of employment by occupation")}">${layout(ranked,0,0,100,100).map((r,i)=>{
      const tip = `${r.name} · ${number(r.value)}${t(" 千人"," thousand people")} · ${percent(r.value/total*100)}`;
      const occ = r.occ ?? r.occupation ?? r.name;
      return `<button type="button" class="tree-tile" data-occ="${esc(occ)}" aria-label="${esc(tip)}" data-tip="${esc(tip)}" data-action="crossOcc" data-value="${esc(occ)}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;background:linear-gradient(155deg,rgba(255,255,255,.09),rgba(255,255,255,0) 55%),${["#2e2a4d","#4a2f45","#332e4d","#2f3548","#453340","#2c403d","#43362e","#352f47","#3e2f3d"][i]};color:#e9e7f2"><span class="tile-label">${r.w*r.h>220 ? esc(r.name) : ""}</span></button>`;
    }).join("")}</div>`;
  }

  function bubbles(w, values, picked) {
    const h=254;
    const a=axes(w,h,{x:[.5,2.8],y:[-3,4],xTicks:[.5,1,1.5,2,2.5],yTicks:[-2,0,2,4],
      xFormat:percent,yFormat:percent,right:21,bottom:44});
    let content=a.grid+line(a.left,a.y(0),a.right,a.y(0),"refline")
      +line(a.x(1.7),a.top,a.x(1.7),a.bottom,"refline")
      +text(a.right,250,t("职位空缺率","Vacancy rate"),"end")+text(a.x(1.7)+5,a.top+7,t("总体 1.7%","Overall 1.7%"),"start");
    const max = Math.max(...values.map(r=>r.openings));
    for(const r of values.slice().sort((a,b)=>b.openings-a.openings)) {
      const selected = picked.includes(r.id);
      const tip = `${r.name}\n${t("空缺率","Vacancy rate")} ${percent(r.rate*100)} · ${number(r.openings)}${t(" 个"," vacancies")}\n${t("用工同比","Employment YoY")} ${percent(r.yoy*100)}`;
      content += `<circle cx="${a.x(r.rate*100)}" cy="${a.y(r.yoy*100)}" r="${Math.sqrt(r.openings/max)*22}" fill="${r.yoy>=0 ? purple : rose}" opacity="${picked.length && !selected ? .31 : .86}" ${mark(tip,"bubble",r.id,selected)}/>`;
    }
    return svg(w,h,t("招聘机会地图，横轴职位空缺率，纵轴机构用工同比","Hiring opportunities. X: vacancy rate. Y: year-on-year employment change."),content);
  }

  function waterfall(w, amounts) {
    const data = [amounts.offer,-amounts.rent,-amounts.living,-amounts.deduct];
    const steps = t(["Offer 月薪","每月房租","生活交通","预留扣款"],["Offer","Rent","Living","Set-aside"]);
    let acc=0;
    const rows = data.map((v,i)=>{
      const s = {label:steps[i],value:v,from:acc,to:acc+v};
      acc += v;
      return s;
    });
    rows.push({label:t("每月结余","Surplus"),value:acc,from:0,to:acc});
    const vals = rows.flatMap(r=>[r.from,r.to]), h=234;
    const min = Math.min(...vals), max=Math.max(...vals, 1);
    const delta = Math.max(max-min, 1000);
    const a=axes(w,h,{x:[-.6,4.6],y:[Math.min(0,min)-delta*.12,max+delta*.17],
      xTicks:[],yTicks:[min,(min+max)/2,max].filter((v,i,vs)=>!i || v!==vs[i-1]),
      yFormat:n=>number(n/1000)+"k",bottom:36,left:40});
    let content=a.grid + line(a.left,a.y(0),a.right,a.y(0),"refline");
    const width=Math.min(47,(a.right-a.left)/8);
    rows.forEach((r,i)=>{
      const x=a.x(i), high=Math.min(a.y(r.from),a.y(r.to)), low=Math.max(a.y(r.from),a.y(r.to));
      const tip = r.label + " " + money(r.value);
      content += `<rect x="${x-width/2}" y="${high}" width="${width}" height="${Math.max(low-high,1)}" fill="${i===0 || i===4 ? purple : "#6f68b0"}" rx="3" ${mark(tip)}/>`;
      if(i<3) content+=line(x+width/2,a.y(r.to),a.x(i+1)-width/2,a.y(r.to),"gridline");
      content+=text(x,high-5,number(r.value/1000)+"k")+text(x,a.bottom+23,r.label);
    });
    return svg(w,h,t("个人生活预算瀑布图","Monthly budget waterfall chart"),content);
  }

  function opportunity(w, sets) {
    const rows = sets.map(s=>{
      const pts = s.points.filter(p=>Number.isFinite(p[1]));
      const first = pts[0]?.[1], last = pts.at(-1)?.[1];
      return { name:s.name, color:s.color, pts, first, last, pct:(last/first - 1)*100 };
    }).sort((a,b)=>b.pct-a.pct);
    const allVals = rows.flatMap(r=>r.pts.map(p=>p[1]));
    const gmin=Math.min(...allVals), gmax=Math.max(...allVals);
    const maxAbs=Math.max(...rows.map(r=>Math.abs(r.pct)),1);
    const W=100,H=28,pad=2;
    const spark = r=>{
      const xs=r.pts.map(p=>p[0]),xmin=Math.min(...xs),xmax=Math.max(...xs);
      const d=r.pts.map((p,i)=>{
        const x=pad+(p[0]-xmin)/Math.max(1e-9,xmax-xmin)*(W-2*pad);
        const y=H-pad-(p[1]-gmin)/Math.max(1e-9,gmax-gmin)*(H-2*pad);
        return `${i?"L":"M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      return `<svg class="opp-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${r.color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    };
    const tagOf = pct => pct>2 ? ["up",t("扩张","Growing")] : pct<-2 ? ["down",t("收缩","Shrinking")] : ["flat",t("平稳","Stable")];
    const up=rows.filter(r=>r.pct>2).length, down=rows.filter(r=>r.pct<-2).length, top=rows[0];
    const summary=t(`${rows.length} 个行业中 ${up} 个用工扩张、${down} 个收缩；${top.name} 累计变化最大。`,
      `${up} of ${rows.length} industries grew, ${down} shrank; ${top.name} changed most.`);
    const body = rows.map(r=>{
      const [cls,tag]=tagOf(r.pct);
      const half=Math.abs(r.pct)/maxAbs*50;
      const bar = r.pct>=0
        ? `<span class="opp-bar up" style="left:50%;width:${half}%"></span>`
        : `<span class="opp-bar down" style="right:50%;width:${half}%"></span>`;
      const signed=(r.pct>=0?"+":"")+r.pct.toFixed(1)+"%";
      return `<div class="opp-row">
        <span class="opp-name">${esc(r.name)}</span>${spark(r)}
        <span class="opp-track"><span class="opp-zero"></span>${bar}</span>
        <span class="opp-val ${cls}">${signed}</span><span class="opp-tag ${cls}">${tag}</span></div>`;
    }).join("");
    return `<div class="opp-box"><p class="opp-summary">${esc(summary)}</p>
      <div class="opp-list" role="table" aria-label="${esc(t("行业用工机会","Industry employment opportunities"))}">${body}</div></div>`;
  }

  globalThis.guideCharts = {purple,rose,colors,number,percent,money,esc,mark,empty,legend,series,stack,bars,donut,treemap,bubbles,waterfall,opportunity};
})();
