---
description: Repository Information Overview
alwaysApply: true
---

# DataCollection Repository Information

## Summary

The DataCollection repository is a specification and implementation guide for **Step 1 (Data Collection) of the Short-Term Engine (STE) MVP**, an Indian-market-focused algorithmic trading system. It provides technical specifications, API comparisons, Python code examples, and best practices for collecting real-time market data, derivatives data, news, and sentiment information from Indian stock markets.

## Repository Structure

The repository is a documentation-focused project with minimal files:

- **readme.md** — Master specification document outlining Step 1 objectives, required data inputs, output schema, constraints, API recommendations, storage strategies, and execution checklist
- **ingestion-guide.md** — Comprehensive technical guide with Python code examples for multiple data collection approaches, API comparisons, and implementation details

## Project Type & Purpose

**Type**: Non-traditional documentation + reference implementation guide  
**Purpose**: Specification and implementation guidance for Indian stock market data ingestion system  
**Scope**: Data collection layer only (no feature generation, modeling, or trading logic)

## Key Objectives

- Collect minimal, essential market and sentiment data every 30–60 minutes for Indian stocks
- Design for cheap storage, fast querying, and legal compliance
- Provide foundation for Step 2 (feature generation)
- Minimize operational complexity (SQLite MVP, Parquet at scale)

## Data Collection Scope

**Market Data**:
- Last Traded Price (LTP) / Current price
- OHLC (Open, High, Low, Close)
- Volume and Delivery %
- VWAP (optional)

**Derivatives (F&O)**:
- Open Interest (OI) and change in OI
- Option chains (where available)
- Implied Volatility (IV)

**News & Sentiment**:
- Ticker-level news articles
- Sentiment scores
- Published timestamps and sources

**Corporate Events** (optional for MVP):
- Earnings dates
- Board meeting announcements
- Regulatory filings

## Recommended APIs & Data Sources

### Market Price & Volume
- **Breeze API (ICICI Direct)** — Real-time, <1 sec latency, 5000 calls/day free, requires free ICICI Direct account
- **Dhan API** — Completely free, unlimited calls, no rate limits, real-time
- **yfinance** — 100% free, 2000+ requests/day, but 15-30 min delayed
- **Kite Connect (Zerodha)** — ₹2000/month, professional-grade, unlimited calls

### F&O & Options Data
- **Dhan Option Chain API** — Free, low-cost option
- **NSE public EOD datasets** — Free, useful for historical backtills
- **Breeze API options chain** — Free with Breeze account

### News & Sentiment
- **MarketAux** — Good Indian coverage with sentiment analytics, 100/day free
- **StockNewsAPI** — Global with limited Indian coverage, 100/day free
- **Finnhub** — 60/min rate limit, limited Indian tickers
- **NSE RSS feeds** — Free, real-time announcements
- **Moneycontrol RSS** — Free, real-time market news

## Output Schema

Recommended compact snapshot JSON format (per ticker per interval):

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

## Storage Recommendations

**SQLite** (recommended for MVP):
- Fast, local, simple deployment
- Handles incremental inserts efficiently
- No server infrastructure required
- Excellent for querying in Step 2

**Parquet** (recommended for scaling):
- Highly compressed (5–10× smaller than JSON)
- Columnar format ideal for time-series analytics
- ~400 bytes per record; 500 stocks × 48 snapshots/day = ~10 MB/day (~3.5 GB/year)
- Parquet compression reduces storage 70–90%

## Implementation Reference

The `ingestion-guide.md` provides working Python code examples for:

1. **yfinance Collector** — Basic implementation with batch fetching (lines 25-87)
2. **Breeze Data Collector** — Real-time quotes and WebSocket streaming (lines 104-195)
3. **Dhan Data Collector** — Free real-time API with security ID mapping (lines 217-290)
4. **Kite Data Collector** — Professional-grade Zerodha integration (lines 307-390)
5. **MarketAux News Ingestion** — News and sentiment collection (starting line 397)

## Execution Plan for MVP

1. **Choose APIs** — Select one market data source (Breeze or Dhan recommended), one derivatives source, one news provider
2. **Define Schema** — Finalize compact snapshot schema with required fields
3. **Build Fetcher** — Implement scheduler (30–60 minute intervals), fetch price/volume/OI/news, compute minimal aggregations
4. **Store Data** — Insert into SQLite (MVP) or append to Parquet (scaling)
5. **Validate** — Monitor missing intervals, schema consistency, null rates

## Key Constraints for Step 2

- Continuous timestamps with no gaps
- Uniform 30 or 60-minute intervals
- Consistent schema across all records
- Sufficient history for rolling features (minimum 30 snapshots = 15 hours)
- Easy queryability (SQLite or Parquet format)
- Stable ticker mapping across time

## Common Failure Modes to Avoid

- Missing data due to API rate limits or throttling
- Broken ticker mapping from corporate actions/renames
- Inconsistent timestamps with skipped intervals
- Storing raw JSON blobs instead of normalized snapshots
- Uncompressed historical data causing cost explosion
- Improper market data licensing compliance

## Technology Stack

**Language**: Python 3.x  
**Primary Libraries** (as referenced in examples):
- `yfinance` — Free market data
- `breeze-connect` — ICICI Direct API client
- `requests` — HTTP requests for REST APIs
- `pandas` — Data manipulation
- `sqlite3` — Local database (built-in)

**No Build System**: Pure specification repository with code examples for reference

## Next Steps

After Step 1 stabilizes → **Step 2 (Feature Generation)**:
- Rolling statistics (SMA, momentum, volatility)
- Technical indicators (RSI, MACD, Bollinger Bands)
- Derived features (price-volume correlation, sentiment trends)
