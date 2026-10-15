"""Australian capital gains tax on a simulated account.

An approximation for comparing plans, not a tax return. Modelled on the ATO
rules for an individual holding crypto as an investment:

* Every disposal is a CGT event, valued in AUD on the day: selling a coin for
  USDT, spending USDT on a coin (USDT is a crypto asset too, so its AUD value
  moves with the exchange rate) and taking USDT out of the account.
* Parcels are matched first in, first out.
* Capital losses are applied to non-discountable gains first; the 50% discount
  then applies to what is left of gains on parcels held at least 12 months.
  A net capital loss is carried forward and never reduces other income.
* The net capital gain is taxed at the marginal rate on top of
  ``other_income``: 2026-27 resident rates plus the 2% Medicare levy, used
  for every year.

Not modelled: fees in cost bases (they still reduce the account), tax
offsets, the low-income Medicare phase-in and historical rate changes.
"""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# 2026-27 resident rates: (top of bracket, marginal rate)
BRACKETS = [(18_200, 0.0), (45_000, 0.15), (135_000, 0.30), (190_000, 0.37), (np.inf, 0.45)]
MEDICARE = 0.02


def income_tax(x):
    """Tax on a taxable income (scalar or array), Medicare levy included."""
    x = np.asarray(x, dtype=float)
    tax = np.zeros_like(x)
    lo = 0.0
    for hi, rate in BRACKETS:
        tax = tax + np.clip(x - lo, 0.0, hi - lo) * rate
        lo = hi
    return tax + MEDICARE * np.maximum(x, 0.0)


def tax_on_gain(gain, other_income: float):
    """Extra tax caused by a net capital gain on top of other income."""
    g = np.maximum(np.asarray(gain, dtype=float), 0.0)
    return income_tax(other_income + g) - income_tax(other_income)


def fin_year(ts: pd.Timestamp) -> int:
    """Australian financial year (1 July - 30 June), named by the year it ends."""
    return ts.year + (1 if ts.month >= 7 else 0)


def due_date(fy: int) -> pd.Timestamp:
    """When a financial year's tax is paid: 31 October after it ends."""
    return pd.Timestamp(f"{fy}-10-31", tz="UTC")


@dataclass
class Ledger:
    """FIFO parcels per asset with AUD cost bases; records every disposal as
    (date, asset, proceeds, cost, gain, discount-eligible)."""
    lots: dict = field(default_factory=lambda: defaultdict(deque))
    total: dict = field(default_factory=lambda: defaultdict(float))
    events: list = field(default_factory=list)
    _cutoff: dict = field(default_factory=dict)

    def buy(self, date: pd.Timestamp, asset: str, units: float, cost_aud: float) -> None:
        if units > 0:
            self.lots[asset].append([date, float(units), float(cost_aud)])
            self.total[asset] += float(units)

    def sell(self, date: pd.Timestamp, asset: str, units: float | None, proceeds_aud: float) -> None:
        """Dispose of ``units`` (None = all) for ``proceeds_aud`` in total."""
        q, held = self.lots[asset], self.total[asset]
        if held <= 0 or not q:
            return
        units = held if units is None else min(float(units), held)
        if units <= 0:
            return
        cutoff = self._cutoff.get(date)
        if cutoff is None:                          # parcels bought before this are >= 12 months old
            cutoff = self._cutoff[date] = date - pd.DateOffset(years=1)
        left = units
        while left > 0 and q:
            lot = q[0]
            take = min(lot[1], left)
            whole = take >= lot[1] * (1 - 1e-12)
            cost = lot[2] if whole else lot[2] * take / lot[1]
            proceeds = proceeds_aud * take / units
            self.events.append((date, asset, proceeds, cost, proceeds - cost, lot[0] < cutoff))
            if whole:
                q.popleft()
                left -= lot[1]
            else:
                lot[1] -= take
                lot[2] -= cost
                left -= take
        self.total[asset] = max(held - units, 0.0) if q else 0.0


def annual_tax(events: list, other_income: float) -> pd.DataFrame:
    """Per financial year: gains, losses, net capital gain, tax and the loss
    carried forward."""
    cols = ["gains", "discountable_gains", "losses", "net_capital_gain", "tax", "loss_carried"]
    if not events:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(events, columns=["date", "asset", "proceeds", "cost", "gain", "discount"])
    df["fy"] = [fin_year(d) for d in df["date"]]
    rows, carry = {}, 0.0
    for fy in range(int(df.fy.min()), int(df.fy.max()) + 1):
        e = df[df.fy == fy]
        g, disc_ok = e["gain"].values, e["discount"].values.astype(bool)
        disc = float(g[(g > 0) & disc_ok].sum())
        nond = float(g[(g > 0) & ~disc_ok].sum())
        loss = float(-g[g < 0].sum()) + carry
        gains, disc0, losses = disc + nond, disc, float(-g[g < 0].sum())
        use = min(loss, nond)
        nond, loss = nond - use, loss - use
        use = min(loss, disc)
        disc, loss = disc - use, loss - use
        net = nond + 0.5 * disc
        rows[fy] = {"gains": gains, "discountable_gains": disc0, "losses": losses,
                    "net_capital_gain": net, "tax": float(tax_on_gain(net, other_income)),
                    "loss_carried": loss}
        carry = loss
    return pd.DataFrame.from_dict(rows, orient="index")[cols]


def account_ledger(res, close: pd.DataFrame, usd_per_aud: pd.Series,
                   initial_usd: float, initial_aud: float,
                   flows_usd: pd.Series | None = None, flows_aud: pd.Series | None = None,
                   liquidate: bool = False, quote: str = "USDT") -> Ledger:
    """CGT parcels and events of a simulated account
    (``simulate(..., record_trades=True)``). Deposits buy USDT at their AUD
    cost; each day sells go first (coin -> USDT), then withdrawals (USDT out),
    then buys (USDT -> coin). ``liquidate`` sells everything into AUD on the
    last day."""
    TU = res.trades_usd
    idx, cols = TU.index, TU.columns
    aud = 1.0 / usd_per_aud.reindex(idx).ffill().bfill().values   # AUD per USD
    px = close.reindex(index=idx, columns=cols).values
    W, tu = res.weights.values, TU.values
    zero = pd.Series(0.0, idx)
    fu = (zero if flows_usd is None else flows_usd.reindex(idx).fillna(0.0)).values
    fa = (zero if flows_aud is None else flows_aud.reindex(idx).fillna(0.0)).values
    led = Ledger()
    led.buy(idx[0], quote, initial_usd, initial_aud)
    for t in range(len(idx)):
        d = idx[t]
        if fu[t] > 0:
            led.buy(d, quote, fu[t], fa[t])
        row = tu[t]
        nz = np.flatnonzero(row)
        for j in nz[row[nz] < 0]:
            usd = -row[j]
            led.sell(d, cols[j], None if W[t, j] <= 0 else usd / px[t, j], usd * aud[t])
            led.buy(d, quote, usd, usd * aud[t])
        if fu[t] < 0:
            led.sell(d, quote, -fu[t], -fu[t] * aud[t])
        for j in nz[row[nz] > 0]:
            usd = row[j]
            led.sell(d, quote, usd, usd * aud[t])
            led.buy(d, cols[j], usd / px[t, j], usd * aud[t])
    if liquidate:
        d, t = idx[-1], len(idx) - 1
        nav = float(res.nav_usd.iloc[-1])
        for j in np.flatnonzero(W[-1] > 0):
            led.sell(d, cols[j], None, W[-1, j] * nav * aud[t])
            led.buy(d, quote, W[-1, j] * nav, W[-1, j] * nav * aud[t])
        led.sell(d, quote, nav, nav * aud[t])
    return led
