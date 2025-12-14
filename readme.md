# Short-Term Engine (STE) — Step 1: Data Collection
This document summarizes the goals and implementation guidance for Step 1 (Data Collection) of the Indian-market-focused STE MVP. It covers required inputs, outputs, constraints, recommended data sources, storage formats, and an execution checklist.

## Table of contents
- [Objective](#objective)
- [Inputs to collect](#inputs-to-collect)
- [Output schema](#output-schema)
- [What Step 1 should NOT do](#what-step-1-should-not-do)
- [Constraints required by Step 2](#constraints-required-by-step-2)
- [Recommended APIs](#recommended-apis)
- [Storage recommendations](#storage-recommendations)
- [Storage cost estimate](#storage-cost-estimate)
- [Common failure modes](#common-failure-modes)
- [Execution plan (MVP)](#execution-plan-mvp)
- [Final notes](#final-notes)

## Objective
Collect minimal, essential market and sentiment data every 30–60 minutes for Indian stocks, in a way that is:
Cheap to store


Fast to query


Legally compliant


Sufficient for the next step (feature generation)


Step 1 should ONLY gather raw snapshots. No feature computation.

## Inputs to collect
### Market data (per ticker)
Current price (LTP)


OHLC (optional for MVP)


Volume


Delivery % (daily)


VWAP (optional)


### F&O / derivatives data (where available)
Open Interest (OI)


Change in OI


Option chain (if available)


IV (if API supports it)


### News & sentiment
Ticker-level news articles


Sentiment score (provided by API)


Published timestamp


Source


### Corporate events (optional for MVP)
Earnings date


Board meeting announcements


Major regulatory filings



## Output schema

Store one compact snapshot per ticker per interval. Example JSON schema:

```json
{
  "timestamp": "2025-12-10T10:30:00Z",
  "ticker": "RELIANCE",
  "price": 2563.50,
  "volume": 1234567,
  "oi": 345678,
  "iv": 0.22,
  "sentiment_score": 0.15,
  "news_count": 2,
  "news_sentiment_avg": 0.12
}
```

Recommended storage targets (MVP vs scale):

- SQLite (recommended MVP)
- Parquet files (recommended for scaling & analytics)



## What Step 1 should NOT do

- No scoring or signal generation
- No model training or linear model application
- No extensive aggregation (except minimal news sentiment average)
- No trend calculation (belongs to Step 2)
- No buy/sell logic or alerts

Step 1 is pure ingestion and snapshot storage.

## Constraints required by Step 2

Step 2 (feature generation) needs:

- Continuous timestamps (no gaps)
- A uniform interval (30 or 60 minutes)
- Consistent schema
- Enough history for rolling features (e.g., 30 snapshots = 15 hours)
- Easy queryability (SQLite / Parquet)
- Stable ticker mapping




## Recommended APIs (MVP candidates)

Market price & volume

- Breeze API (ICICI Direct) — reliable, cost-effective
- Dhan API — good Indian market data access
- Kite Connect (Zerodha) — robust but paid

F&O (OI, IV, option chain)

- Dhan option chain API — good low-cost option
- Public EOD datasets for NSE OI (useful for backfills)

News & sentiment

- StockNewsAPI — supports Indian tickers
- MarketAux — includes sentiment analytics

Corporate events

- NSE announcements
- Moneycontrol RSS feeds



## Storage recommendations

SQLite (best for MVP)

- Fast, local, simple
- Handles incremental inserts
- No server required
- Easy querying in Step 2

Parquet (for scaling)

- Highly compressed (5–10× smaller than JSON)
- Columnar format ideal for numeric time-series
- Great for backtesting & analytics

Notes: keep raw API JSON only as transient payloads. Persist normalized snapshots.

## Storage cost estimate (example)

- Snapshot record size: ~400 bytes (estimate)
- 500 stocks × 48 snapshots/day = 24,000 rows/day
- Storage/day ≈ 10 MB → month ≈ 300 MB → year ≈ 3.5 GB

Parquet compression typically reduces storage by 70–90%.


## Common failure modes

- Missing data due to API rate limits or throttling
- Broken ticker mapping (corporate actions / renames)
- Inconsistent timestamps (skipped intervals)
- API downtime or partial responses
- Storing raw JSON blobs causing large uncompressed files
- Uncompressed historical data leading to cost explosion
- Improper licensing of market data

## Execution plan (MVP)

1. Choose APIs

- Select one market data API (Breeze or Dhan)
- Select one derivatives/OI source
- Select one news sentiment provider

2. Define snapshot schema

- Finalize the compact schema above and required fields

3. Build fetcher

- Scheduler: run every 30 or 60 minutes
- Fetch price & volume, OI, and recent news
- Compute minimal derived value: average news sentiment for interval

4. Store snapshot

- Insert into SQLite (MVP) or append to Parquet (scaling)

5. Validate

- Monitor missing intervals and schema drift
- Run lightweight quality checks (timestamp continuity, null rates)

After this is stable → move to Step 2 (feature generation).

## Final notes

- Step 1 is the foundation: if the data is consistent and clean, the STE will work.
- Start small: 20–50 stocks before scaling to 500.
- SQLite is your friend — don’t over-engineer.
- API choice should balance cost, rate limits and licensing.

This document now acts as the master reference for Step 1 of your Short-Term Engine MVP.

