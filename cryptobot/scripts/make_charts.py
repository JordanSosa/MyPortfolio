#!/usr/bin/env python3
"""Render the README charts from the saved return records.

reports/equity.png        v3 out-of-sample (walk-forward 2019-24 + holdout), as originally published
reports/drawdown.png      v3 drawdowns
reports/v4_equity.png     v4: development (Binance 2019-24) and holdout (2025-26, contaminated)
reports/v4_fresh.png      v4 and v3 on the untouched Bitfinex 2014-2018 data
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "reports"
BLUE, ORANGE, AQUA, YELLOW = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
INK, INK2, GRID, SURF = "#0b0b0b", "#52514e", "#e6e5e0", "#fcfcfb"


def style(ax):
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    for s in ["left", "bottom"]:
        ax.spines[s].set_color("#bbbbb5")
    ax.tick_params(colors=INK2, labelsize=9)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_facecolor(SURF)


def line_chart(df: pd.DataFrame, series, title: str, path: Path, log=True, marker=None,
               ylabel="Growth of $1 (log scale)", end_labels=True):
    fig, ax = plt.subplots(figsize=(10, 4.8), dpi=150, facecolor=SURF)
    style(ax)
    ends = []
    for col, label, c, lw in series:
        if col not in df:
            continue
        ax.plot(df.index, df[col], color=c, lw=lw, label=label, zorder=3 if lw > 1.5 else 2)
        ends.append((float(df[col].dropna().iloc[-1]), df[col].dropna().index[-1]))
    if log:
        ax.set_yscale("log")
    if end_labels and ends:
        # nudge labels apart so values that end close together stay readable
        ends.sort()
        ys = [np.log10(v) if log else v for v, _ in ends]
        lo, hi = ax.get_ylim()
        span = (np.log10(hi) - np.log10(lo)) if log else (hi - lo)
        gap = span * 0.045
        for i in range(1, len(ys)):
            ys[i] = max(ys[i], ys[i - 1] + gap)
        for (v, x), y in zip(ends, ys):
            ax.annotate(f"{v:.1f}×" if log else f"{v:.0f}%", (x, 10 ** y if log else y),
                        xytext=(6, 0), textcoords="offset points", va="center", fontsize=9,
                        color=INK, annotation_clip=False)
    if marker is not None:
        ax.axvline(marker[0], color="#8a8984", lw=1, ls="--")
        ax.text(marker[0], ax.get_ylim()[1], "  " + marker[1], va="top", fontsize=9, color=INK2)
    ax.set_ylabel(ylabel, color=INK2, fontsize=10)
    if log:
        ax.legend(frameon=False, fontsize=9, loc="upper left", labelcolor=INK)
    else:  # drawdown charts: lines fill the lower area, so put the legend below the axes
        ax.legend(frameon=False, fontsize=9, loc="upper center", bbox_to_anchor=(0.5, -0.08),
                  ncol=len(series), labelcolor=INK)
    ax.set_title(title, loc="left", fontsize=12, color=INK)
    fig.tight_layout()
    fig.savefig(path, facecolor=SURF)
    plt.close(fig)


def v3_charts():
    wf = pd.read_csv(R / "walk_forward_returns.csv", index_col=0, parse_dates=True)
    ho = pd.read_csv(R / "holdout_returns.csv", index_col=0, parse_dates=True)
    df = pd.concat([wf.rename(columns={"strategy_oos": "strategy", "btc_buy_hold": "btc",
                                       "ew_top10": "ew"}),
                    ho.rename(columns={"btc_buy_hold": "btc", "ew_top10": "ew"})])
    df = df[["strategy", "btc", "ew"]].fillna(0)
    eq = (1 + df).cumprod()
    ser = [("strategy", "v3 (walk-forward OOS → holdout)", BLUE, 2.0),
           ("btc", "BTC buy & hold", ORANGE, 1.4), ("ew", "Equal-weight top-10", AQUA, 1.4)]
    line_chart(eq, ser, "v3 out-of-sample equity, 2019 → 2026 (net of fees & slippage)",
               R / "equity.png", marker=(ho.index[0], "locked holdout →"))
    line_chart((eq / eq.cummax() - 1) * 100, ser, "v3 out-of-sample drawdowns", R / "drawdown.png",
               log=False, marker=(ho.index[0], "locked holdout →"), ylabel="Drawdown from peak (%)",
               end_labels=False)


def v4_charts():
    dev = pd.read_csv(R / "v4_dev_returns.csv", index_col=0, parse_dates=True)
    parts = [dev[["v4", "v3", "btc_buy_hold", "btc_trend_same_engine"]]]
    marker = None
    if (R / "v4_holdout_returns.csv").exists():
        ho = pd.read_csv(R / "v4_holdout_returns.csv", index_col=0, parse_dates=True)
        hr = pd.read_csv(R / "holdout_returns.csv", index_col=0, parse_dates=True)
        parts.append(pd.DataFrame({"v4": ho["v4"], "v3": hr["strategy"], "btc_buy_hold": hr["btc_buy_hold"]}))
        marker = (ho.index[0], "holdout (contaminated) →")
    df = pd.concat(parts).fillna(0)
    eq = (1 + df).cumprod()
    ser = [("v4", "v4 ensemble", BLUE, 2.0), ("v3", "v3 (fixed code, in-sample config)", YELLOW, 1.2),
           ("btc_buy_hold", "BTC buy & hold", ORANGE, 1.4)]
    line_chart(eq, ser, "v4 on Binance: development 2019-24 and holdout 2025-26 (net of costs)",
               R / "v4_equity.png", marker=marker)
    if (R / "v4_fresh_returns.csv").exists():
        fr = pd.read_csv(R / "v4_fresh_returns.csv", index_col=0, parse_dates=True).fillna(0)
        eqf = (1 + fr).cumprod()
        ser = [("v4", "v4 ensemble (frozen)", BLUE, 2.0), ("v3", "v3 (frozen)", YELLOW, 1.2),
               ("btc_buy_hold", "BTC buy & hold", ORANGE, 1.4), ("ew_top10", "Equal-weight top-10", AQUA, 1.4)]
        line_chart(eqf, ser, "Untouched data: Bitfinex 2014-2018, incl. delisted coins (net of 0.2% fees)",
                   R / "v4_fresh.png")
        line_chart((eqf / eqf.cummax() - 1) * 100, ser, "Untouched data: drawdowns",
                   R / "v4_fresh_drawdown.png", log=False, ylabel="Drawdown from peak (%)",
                   end_labels=False)


if __name__ == "__main__":
    v3_charts()
    v4_charts()
