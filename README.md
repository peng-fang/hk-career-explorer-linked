# 香港就业市场探索器

跟着香港毕业生嘉宁探索两地市场。她提出问题、点选图表，再调整工资、工时和预算假设，观察哪些求职方向值得进一步查证。

**[简体中文](https://peng-fang.github.io/hk-graduate-job-guide/?lang=zh-Hans)** · **[English](https://peng-fang.github.io/hk-graduate-job-guide/?lang=en)** · **[15 分钟展示走台方案（审核稿）](docs/15分钟展示走台方案.md)** · **[五章逐图说明](docs/故事线与图表说明.md)** · **[原中文详稿](docs/15分钟演讲稿.md)**

## 浏览与演示

1. 打开 `index.html` 即可浏览，网页为纯静态文件。
2. 在「香港就业版图」「失业与恢复」「性别与收入」试用联动年份。
3. 到「求职方向探索」，点击「载入嘉宁的演示方案」。改行业、薪酬参考年和个人门槛，观察候选表。点月薪中位数可带入预算估算。
4. 点右下角「数据来源与使用说明」核对调查、年份和口径。

## 数据与可复现性

网页数据由《香港劳动力_整合数据集.xlsx》中的六张数据表投影生成。本仓库包含图表所需字段、来源说明和导出脚本。统计口径详见网页的「数据来源与统计口径」。香港需求数据截至 2026Q2，工资与工时采用 2016–2025 年的全职雇员统计。原项目两地行业对比含估计与分类合并。

有原整合数据集时，可用 Python 与 openpyxl 重新生成 `data/guide-data.js`。

```sh
python scripts/export_data.py "/path/to/香港劳动力_整合数据集.xlsx"
```

页面布局与就地筛选参考组员的项目，章节、图表代码和筛选流程在本仓库独立实现。嘉宁为虚构人物，港景封面由图像生成工具制作。 [Hong Kong Job Market Explorer](https://github.com/ketianli082-stack/hong-kong-job-market-explorer)
