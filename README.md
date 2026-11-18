# 香港就业市场探索器 · 四章版

嘉宁先用专业、工作兴趣和技能探索职业组，再根据招聘证据选定「行业 × 职业组」。她核查风险与收入之后，在预算页检验自己的工资、工时和结余条件。

**[简体中文](https://peng-fang.github.io/hk-career-explorer-v2/?lang=zh-Hans)** · **[English](https://peng-fang.github.io/hk-career-explorer-v2/?lang=en)** · **[四章版 15 分钟演示](docs/四章版_15分钟演示.md)** · **[五章第一版](https://peng-fang.github.io/hk-graduate-job-guide/)**

## 浏览与演示

1. 打开 `index.html` 即可浏览，网页为纯静态文件。
2. 在 01 页载入嘉宁的背景或自行选择。点招聘热力格并加入比较。
3. 在 02 页查看失业率、行业收入参照并确认组合，可以写下待核查问题。
4. 在 03 页改工资、工时或预算，查看对照结果。点月薪中位数可以带入预算。
5. 右上角可切换语言。选择、备注及预算保存在当前浏览器标签页的会话内。点「数据来源与使用说明」可核对调查时期和口径。

## 数据与可复现性

网页数据由《香港劳动力_整合数据集.xlsx》中的六张数据表投影生成。本仓库包含图表所需字段、来源说明和导出脚本。统计口径详见网页的「数据来源与统计口径」。香港需求数据截至 2026Q2，工资与工时采用 2016–2025 年的全职雇员统计。原项目两地行业对比含估计与分类合并。

有原整合数据集时，可用 Python 与 openpyxl 重新生成 `data/guide-data.js`。

```sh
python scripts/export_data.py "/path/to/香港劳动力_整合数据集.xlsx"
```

页面布局与就地筛选参考组员的项目，章节、图表代码和筛选流程在本仓库独立实现。嘉宁为虚构人物，港景封面由图像生成工具制作。 [Hong Kong Job Market Explorer](https://github.com/ketianli082-stack/hong-kong-job-market-explorer)
