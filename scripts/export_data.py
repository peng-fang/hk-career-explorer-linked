"""Export the data used by the guide from the integrated workbook."""

import argparse
import csv
import json
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
EARNINGS_INDUSTRIES = {
    "1": "Manufacturing",
    "2": "Construction",
    "3": "Import/export trade and wholesale",
    "4.1": "Retail",
    "4.2": "Accommodation and food services",
    "5": "Transportation, storage, postal and courier services, information and communications",
    "6.1": "Financing and insurance",
    "6.2": "Real estate and professional and business services",
    "7": "Public administration, social and personal services",
    "8": "Other industries",
}
OVERVIEW_INDUSTRIES = {
    "Manufacturing": "Manufacturing",
    "Construction": "Construction",
    "Import/export trade and wholesale": "Import/export & wholesale",
    "Retail, accommodation and food services": "Retail & accommodation",
    "Transportation, storage, postal and courier services, information and communications": "Transportation & information",
    "Financing, insurance, real estate, professional and business services": "Finance & professional",
    "Public administration, social and personal services": "Public & social services",
    "Other industries": "Other industries",
}


def records(workbook, prefix):
    sheet, = (sheet for sheet in workbook if sheet.title.startswith(prefix))
    rows = sheet.values
    headings = next(rows)
    return [dict(zip(headings, row)) for row in rows if any(v is not None for v in row)]


def as_number(value):
    return float(value) if value not in ("", None) else None


def project(rows, fields, *, numeric=()):
    return [
        {
            key: as_number(row.get(field)) if key in numeric else row.get(field)
            for key, field in fields.items()
        }
        for row in rows
    ]


def industry_earnings():
    # Annual observations from C&SD Table 210-06316. Each median is published separately.
    with (ROOT / "data" / "hk-industry-earnings.csv").open(encoding="utf-8", newline="") as file:
        rows = [
            {"year": int(row["year"]), "name": EARNINGS_INDUSTRIES[row["industry_code"]],
             "female": int(row["female_hkd"]), "male": int(row["male_hkd"]),
             "both": int(row["both_sexes_hkd"])}
            for row in csv.DictReader(file)
        ]
    expected = {(year, name) for year in range(2008, 2026) for name in EARNINGS_INDUSTRIES.values()}
    assert len(rows) == len(expected) and {(row["year"], row["name"]) for row in rows} == expected
    return rows


def annual_unemployment():
    # Hong Kong C&SD Table 210-06101, both sexes, published annual estimates.
    with (ROOT / "data" / "hk-annual-unemployment.csv").open(encoding="utf-8", newline="") as file:
        rows = [{"year": int(row["year"]), "rate": float(row["rate"])} for row in csv.DictReader(file)]
    assert [row["year"] for row in rows] == list(range(1985, 2026))
    return rows


def use_workbook(workbook):
    compare = records(workbook, "00_00")
    all_jobs = records(workbook, "01_01")
    overview = records(workbook, "01_02")
    quality = records(workbook, "02_03")
    equity = records(workbook, "03_04")
    risk = records(workbook, "04_05")
    market_context = records(workbook, "00_新增官方数据")
    pay_comparison = records(workbook, "00_深港行业工资") if "00_深港行业工资" in workbook.sheetnames else []

    def domain(name):
        return (row for row in quality if row["图表域"] == name)

    group = {"id": "市场行业代码"}
    period = {"period": "需求期"}
    demand_fields = {
        **group, **period, "name": "市场行业", "openings": "空缺人数", "rate": "空缺率",
        "yoy": "用工同比", "jobs": "就业人数",
    }
    bounds = {
        "pay25": "月薪P25", "pay50": "月薪P50", "pay75": "月薪P75",
        "hours25": "工时P25", "hours50": "工时P50", "hours75": "工时P75",
    }
    clean_ages = {
        "15 - 19", "20 - 24", "25 - 29", "30 - 34", "35 - 39", "40 - 44",
        "45 - 49", "50 - 54", "55 - 59", "60 - 64", "≥65",
    }
    result = {
        "markets": project(
            (r for r in compare if r["view"] in {
                "A_2010年龄对照", "F_行业35_早期", "G_行业35_最新", "H_中年组两地趋势",
            }),
            {"kind": "view", "region": "series", "label": "Age", "order": "x_order", "value": "value"},
            numeric=("order", "value"),
        ),
        "marketContext": project(
            market_context,
            {"indicator": "指标代码", "area": "地区代码", "period": "观察期", "nameZh": "分组",
             "nameEn": "英文分组", "value": "原值"},
            numeric=("value",),
        ),
        "total": project(
            (r for r in all_jobs if r["source_table"] == "employment_by_industry_annual"
             and all(r[key] == "Total" for key in ("industry", "sex", "age_group"))),
            {"year": "year", "value": "value"}, numeric=("year", "value"),
        ),
        "industryEmployment": [
            {"year": int(r["year"]), "name": OVERVIEW_INDUSTRIES[r["industry"]], "value": as_number(r["value"])}
            for r in all_jobs if r["source_table"] == "employment_by_industry_annual"
            and all(r[key] == "Total" for key in ("sex", "age_group")) and r["industry"] != "Total"
        ],
        "structure": project(
            (r for r in overview if r["chart"] in {"status", "occupation", "industry_share"}),
            {"kind": "chart", "year": "year", "name": "category", "share": "employment_share_pct",
             "status": "employment_status_thousand", "work": "occupation_employment_thousand"},
            numeric=("year", "share", "status", "work"),
        ),
        "industryEmploymentBySex": project(
            (r for r in all_jobs if r["source_table"] == "employment_by_industry_annual"
             and r["age_group"] == "Total" and r["industry"] != "Total" and r["sex"] in {"Female", "Male"}),
            {"year": "year", "name": "industry", "sex": "sex", "people": "value"},
            numeric=("year", "people"),
        ),
        "risk": project(
            (r for r in risk if r["Chart"] in {"unemployment_quarterly_line", "crisis_recovery"}
             or r["Chart"] == "unemployment_age_heatmap" and r["AgeGroup"] in clean_ages
             or r["Chart"] == "unemployment_education"),
            {"kind": "Chart", "year": "Year", "quarter": "Quarter", "event": "Crisis",
             "age": "AgeGroup", "education": "Education", "relative": "RelativeQuarter", "value": "Value"},
            numeric=("year", "quarter", "relative", "value"),
        ),
        "annualUnemployment": annual_unemployment(),
        "equity": project(
            (r for r in equity if r["sex"] in {"Female", "Male"} and (
                r["group_type"] == "overall" and r["median_monthly_earnings_hkd"] is not None
                or r["group_type"] == "age_group" and r["age_group"] in clean_ages
                and r["labour_force_participation_pct"] is not None
            )),
            {"kind": "group_type", "year": "year", "sex": "sex", "name": "group_name",
             "participation": "labour_force_participation_pct", "pay": "median_monthly_earnings_hkd"},
            numeric=("year", "participation", "pay"),
        ),
        "industryEarnings": industry_earnings(),
        "demand": project(domain("市场"), demand_fields, numeric=("openings", "rate", "yoy", "jobs")),
        "occupations": project(
            domain("职业"),
            {**group, "name": "职业组原文", "count": "职业空缺", "share": "职业占比"},
            numeric=("count", "share"),
        ),
        "pay": project(
            domain("薪酬"),
            {**group, "name": "工资细分", "year": "工资年", "mapping": "分类对应说明", **bounds},
            numeric=("year", *bounds),
        ),
        "history": project(
            domain("趋势"), {**group, **period, "value": "用工指数"}, numeric=("value",),
        ),
    }
    assert len(result["demand"]) == 10 and len(result["occupations"]) == 90
    assert len(result["pay"]) == 180 and len(result["history"]) == 420
    assert len(result["industryEmploymentBySex"]) == 288
    industry_keys = {(r["year"], r["name"]) for r in result["industryEmployment"]}
    assert len(industry_keys) == len(result["industryEmployment"]) == 144
    assert industry_keys == {(r["year"], r["name"]) for r in result["structure"] if r["kind"] == "industry_share"}
    assert all(result[key] for key in result)
    assert len({(r["id"], r["name"], r["year"]) for r in result["pay"]}) == len(result["pay"])
    if pay_comparison:
        result["payComparison"] = project(
            (row for row in pay_comparison if row.get("行业")),
            {"id": "代码", "nameZh": "行业", "nameEn": "英文行业", "sz": "深圳工资P50（人民币／年）",
             "hk": "香港工资P50（港元／月）", "noteZh": "对应说明", "noteEn": "英文对应说明"},
            numeric=("sz", "hk"),
        )
        assert result["payComparison"][0]["id"] == "all"
        assert all(row["sz"] > 0 and row["hk"] > 0 for row in result["payComparison"])
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    args = parser.parse_args()
    workbook = load_workbook(args.workbook, read_only=True, data_only=True)
    try:
        dataset = use_workbook(workbook)
    finally:
        workbook.close()
    payload = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (ROOT / "data" / "guide-data.js").write_text(
        "globalThis.guideData = " + payload + ";\n", encoding="utf-8", newline="\n"
    )
    print({key: len(rows) for key, rows in dataset.items()})
