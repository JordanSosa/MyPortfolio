#!/usr/bin/env python3
"""Render reports/equity.png and reports/drawdown.png from the OOS records."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "reports"
SERIES = [("strategy", "Strategy (walk-forward OOS → holdout)", "#2a78d6"),
          ("btc", "BTC buy & hold", "#eb6834"),
          ("ew", "Equal-weight top-10", "#1baf7a")]


def load():
    wf = pd.read_csv(R / "walk_forward_returns.csv", index_col=0, parse_dates=True)
    ho = pd.read_csv(R / "holdout_returns.csv", index_col=0, parse_dates=True)
    df = pd.concat([wf.rename(columns={"strategy_oos": "strategy", "btc_buy_hold": "btc",
                                       "ew_top10": "ew"}),
                    ho.rename(columns={"btc_buy_hold": "btc", "ew_top10": "ew"})])
    return df[["strategy", "btc", "ew"]].fillna(0), ho.index[0]


def style(ax):
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color("#bbbbb5")
    ax.spines["bottom"].set_color("#bbbbb5")
    ax.tick_params(colors="#52514e", labelsize=9)
    ax.grid(axis="y", color="#e6e5e0", linewidth=0.8)
    ax.set_facecolor("#fcfcfb")


def main():
    df, ho_start = load()
    eq = (1 + df).cumprod()
    dd = eq / eq.cummax() - 1
    for name, data, ylab, log in [("equity", eq, "Growth of $1 (log scale)", True),
                                  ("drawdown", dd * 100, "Drawdown from peak (%)", False)]:
        fig, ax = plt.subplots(figsize=(10, 4.8), dpi=150, facecolor="#fcfcfb")
        style(ax)
        for col, label, c in SERIES:
            ax.plot(data.index, data[col], color=c, lw=2 if col == "strategy" else 1.4,
                    label=label, zorder=3 if col == "strategy" else 2)
            if name == "equity":
                v = data[col].iloc[-1]
                ax.annotate(f"{v:.1f}×", (data.index[-1], v), xytext=(6, 0),
                            textcoords="offset points", va="center", fontsize=9, color="#0b0b0b")
        if log:
            ax.set_yscale("log")
        ax.axvline(ho_start, color="#8a8984", lw=1, ls="--")
        ax.text(ho_start, ax.get_ylim()[1], "  locked holdout →", va="top", fontsize=9,
                color="#52514e")
        ax.set_ylabel(ylab, color="#52514e", fontsize=10)
        ax.legend(frameon=False, fontsize=9, loc="upper left" if name == "equity" else "lower left",
                  labelcolor="#0b0b0b")
        title = ("Out-of-sample equity, 2019 → 2026 (net of fees & slippage)" if name == "equity"
                 else "Out-of-sample drawdowns")
        ax.set_title(title, loc="left", fontsize=12, color="#0b0b0b")
        fig.tight_layout()
        fig.savefig(R / f"{name}.png", facecolor="#fcfcfb")
        plt.close(fig)


if __name__ == "__main__":
    main()
