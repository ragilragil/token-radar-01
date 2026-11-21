# Token Launch Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ragilragil/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ragilragil/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for make.fun's ["Build the best token launch radar"](https://make.fun/bounty/token-radar-01) bounty ($1,325 in USDC).

It reads a sealed DefiLlama snapshot of 758 protocols, finds the ones that still record no token, and ranks 200 of them by an implied value built only from the snapshot's own figures:

**implied = TVL x category ratio x growth x maturity x breadth**

- **Category ratio** — the median market-cap-to-TVL ratio of protocols in the same category that already trade, shrunk toward the global median (prior: 5 protocols) and capped at 2.0.
- **Growth** — 1 + (7-day TVL change, clamped to -60%..+120%) x 0.5.
- **Maturity** — 0.6 + (days listed, capped at 1,095) / 1,095 x 0.4.
- **Breadth** — 1 + 0.02 per extra chain, up to 4 extra chains.

No protocol name is ever special-cased. The board covers all 40 watchlist protocols plus the 160 pre-token protocols below the $50M floor with the most TVL. Every row carries a six-step farm plan with costs and times, derived from the protocol's category, chains, TVL and age. Live-token protocols are shown apart, at the market's own value.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`, and copies `dashboard/` and `screenshots/` into the output directory, then writes `dossier.json`.

## The dashboard

`dashboard/` is a static page with no network: a searchable, sortable, filterable board, a detail view for every protocol (with the model's own breakdown and farm plan), the model explained, and the live-token comparators.
