(() => {
  "use strict";

  const { t } = globalThis.guideLanguage;
  const majors = {
    analytics: ["商业分析","Business analytics"],
    business: ["商科与经济","Business and economics"],
    statistics: ["数据与统计","Data and statistics"],
    computing: ["计算机与信息","Computing and information"],
    engineering: ["工程","Engineering"],
    science: ["理科","Science"],
    education: ["教育与社科","Education and social sciences"],
    health: ["医疗与健康","Health"],
    design: ["设计与传播","Design and communications"],
    other: ["其他／跨学科","Other or interdisciplinary"],
  };
  const interests = {
    analyse: ["分析商业问题","Analyse business problems"],
    build: ["开发技术产品","Build technical products"],
    create: ["设计与内容制作","Design and create content"],
    research: ["研究与教学","Research and teaching"],
    serve: ["服务与沟通","Service and communication"],
    organise: ["运营与组织","Operations and organisation"],
    handsOn: ["现场与设备","Field and equipment work"],
    care: ["健康与照护","Health and care"],
  };
  const skills = {
    sql: ["SQL 与统计","SQL and statistics"],
    code: ["编程","Programming"],
    viz: ["数据可视化","Data visualisation"],
    writing: ["写作表达","Writing and communication"],
    production: ["设计制作","Design and production"],
    customers: ["客户沟通","Customer communication"],
    project: ["项目协调","Project coordination"],
    labs: ["实验与设备操作","Lab and equipment work"],
  };
  const professional = "Professionals";
  const associate = "Associate professionals";
  const rules = [
    { id:"data-analysis", majors:["analytics","business","statistics"], interests:["analyse"], skills:["sql","viz"],
      groups:[professional,associate], task:["分析数据、制作报表、解释结果","Analyse data, build reports and explain findings"],
      words:["商业分析、BI、报告分析","business analysis, BI, reporting analyst"] },
    { id:"information-systems", majors:["computing"], interests:["build"], skills:["code"],
      groups:[professional,associate], task:["开发、测试和维护信息系统","Develop, test and maintain information systems"],
      words:["软件开发、系统分析、技术支援","software development, systems analysis, technical support"] },
    { id:"design-content", majors:["design"], interests:["create"], skills:["production","writing"],
      groups:[professional,associate], task:["视觉设计、内容制作、传播执行","Visual design, content production and communications"],
      words:["视觉设计、内容制作、品牌传播","visual design, content production, brand communications"] },
    { id:"engineering", majors:["engineering"], interests:["handsOn"], skills:["labs"],
      groups:[professional,associate,"Craft and related trades workers"],
      task:["工程设计、技术检查、现场维护","Engineering design, technical inspections and maintenance"],
      words:["助理工程师、测试技术员、设备维护","assistant engineer, test technician, equipment maintenance"] },
    { id:"research-teaching", majors:["science","education"], interests:["research"], skills:["labs","writing"],
      groups:[professional,associate], task:["收集证据、开展研究和教学","Collect evidence, conduct research and teach"],
      words:["研究助理、科学技术员、教学","research assistant, scientific technician, teaching"] },
    { id:"health-care", majors:["health"], interests:["care"], skills:[],
      groups:[professional,associate,"Services and sales workers"], task:["提供医疗技术支持和照护","Provide clinical support and care"],
      words:["健康技术员、照护服务、康复支援","health technician, care services, rehabilitation support"] },
    { id:"customer-service", majors:["business"], interests:["serve"], skills:["customers"],
      groups:["Services and sales workers",associate], task:["了解客户需求、处理服务和销售","Understand customer needs, provide service and support sales"],
      words:["客户服务、销售顾问、客户支援","customer service, sales adviser, client support"] },
    { id:"operations", majors:[], interests:["organise"], skills:["project"],
      groups:[associate,"Clerical support workers"], task:["协调项目、处理记录和流程","Coordinate projects, records and workflows"],
      words:["项目助理、运营协调、行政支援","project assistant, operations coordinator, administrative support"] },
  ];
  const occupationGroups = [...new Set(globalThis.guideData.occupations.map(row => row.name))];
  const nameOf = (catalog, key) => catalog[key] ? t(...catalog[key]) : "";
  const emptyProfile = () => ({major:"",minor:"",interests:[],skills:[],keywords:""});
  const exampleProfile = () => ({major:"analytics",minor:"",interests:["analyse"],skills:["sql","viz"],keywords:""});
  const exampleTaskOccupations = () => ({"data-analysis":professional});
  const pairKey = (id, occupation) => `${id}|${occupation}`;
  const findVacancy = (id, occupation) => globalThis.guideData.occupations.find(row => row.id === id && row.name === occupation);
  const equityIndustry = {
    ind_C:"Manufacturing",
    ind_G45_46:"Import/export trade and wholesale",
    ind_G47:"Retail, accommodation and food services",
    ind_I:"Retail, accommodation and food services",
    ind_H:"Transportation, storage, postal and courier services, information and communications",
    ind_J:"Transportation, storage, postal and courier services, information and communications",
    ind_K:"Financing, insurance, real estate, professional and business services",
    ind_L:"Financing, insurance, real estate, professional and business services",
    ind_M_N:"Financing, insurance, real estate, professional and business services",
    ind_P_S:"Public administration, social and personal services",
  };

  function suggestions(profile) {
    return rules.map(rule => {
      const match = [
        ...[profile.major,profile.minor].filter(key => rule.majors.includes(key)).map(key => nameOf(majors,key)),
        ...profile.interests.filter(key => rule.interests.includes(key)).map(key => nameOf(interests,key)),
        ...profile.skills.filter(key => rule.skills.includes(key)).map(key => nameOf(skills,key)),
      ];
      return { id:rule.id, groups:rule.groups, task:t(...rule.task), words:t(...rule.words), match };
    }).filter(rule => rule.match.length).sort((a,b) => b.match.length-a.match.length);
  }

  function examplePairs(keep = false) {
    return ["ind_K","ind_J","ind_L"].map(id => ({
      id, occupation:professional, kept:keep, note:"",
    }));
  }

  const storageKey = "hk-career-explorer-v2";
  function load() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      return saved && Array.isArray(saved.pairs) && saved.profile ? saved : {};
    } catch { return {}; }
  }

  function save(state) {
    try { sessionStorage.setItem(storageKey,JSON.stringify(state)); }
    catch { /* Continue with the current tab’s in-memory selection. */ }
  }

  globalThis.guidePathway = {
    majors, interests, skills, occupationGroups, nameOf, emptyProfile, exampleProfile, exampleTaskOccupations,
    pairKey, findVacancy, equityIndustry, suggestions, examplePairs, load, save,
  };
})();
