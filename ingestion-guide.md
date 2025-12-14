# Indian Stock Market Data Ingestion - Complete Guide

## Quick Comparison Matrix

| Source | Type | Cost | Rate Limit | Latency | Indian Coverage | Quality | Best For |
|--------|------|------|-----------|---------|-----------------|---------|----------|
| **yfinance** | Price/OHLCV | FREE | ~2000/day | 15-30 min | ✅ NSE/BSE | ⭐⭐⭐ | Baseline data |
| **Breeze API (ICICI)** | Real-time quotes, Options | FREE* | 75/min, 5000/day | <1 sec | ✅ NSE/BSE/F&O | ⭐⭐⭐⭐⭐ | Live trading data |
| **Dhan API** | Real-time, algo trading | FREE | Unlimited | <1 sec | ✅ NSE/BSE/F&O | ⭐⭐⭐⭐ | Live + algo |
| **Kite Connect (Zerodha)** | Real-time + historical | ₹2000/mo | Unlimited | <1 sec | ✅ NSE/BSE/F&O | ⭐⭐⭐⭐⭐ | Professional use |
| **StockNewsAPI** | News headlines | FREE | 100/day | Real-time | ⚠️ Limited Indian | ⭐⭐ | Global news |
| **MarketAux** | News + sentiment | FREE | 100/day | Real-time | ⚠️ Limited Indian | ⭐⭐⭐ | Sentiment tracking |
| **Finnhub** | News + analysis | FREE | 60/min | Real-time | ⚠️ Limited Indian | ⭐⭐⭐ | Fundamentals |
| **NSE RSS** | Announcements | FREE | Real-time | Real-time | ✅ Full | ⭐⭐⭐⭐ | Corporate events |
| **Moneycontrol RSS** | News/updates | FREE | Real-time | Real-time | ✅ Full | ⭐⭐⭐ | Market news |

*Breeze FREE = ICICI Direct account required (free trading account available)

---

## 1. MARKET DATA INGESTION

### Option 1A: yfinance (Best for Quick Start)

```python
import yfinance as yf
import pandas as pd
from datetime import datetime
import json

# Configuration
SYMBOLS = [
    'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFC.NS', 'WIPRO.NS',
    'BAJAJ-AUTO.NS', 'MARUTI.NS', 'AXIS.NS', 'ICICIBANK.NS', 'SBIN.NS',
    'HCLTECH.NS', 'TECHM.NS', 'ITC.NS', 'BHARTIARTL.NS', 'SUNPHARMA.NS',
    'NESTLEIND.NS', 'TITAN.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'ULTRACEMCO.NS'
]

class YFinanceCollector:
    def __init__(self):
        self.failed_symbols = []
    
    def fetch_batch(self, symbols):
        """Fetch market data for multiple symbols efficiently"""
        data = {}
        timestamp = datetime.utcnow().isoformat()
        
        # Use Ticker.history() which is more efficient for batch
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                
                # Fetch last 5 days for trend calculation
                hist = ticker.history(period="5d", interval="1d")
                
                if hist.empty:
                    print(f"⚠️  No data for {symbol}")
                    continue
                
                latest = hist.iloc[-1]
                prev_close = hist.iloc[-2]['Close'] if len(hist) > 1 else latest['Close']
                
                # Extract minimal essential data
                data[symbol] = {
                    'timestamp': timestamp,
                    'symbol': symbol.replace('.NS', '').replace('.BO', ''),
                    'price': round(float(latest['Close']), 2),
                    'high': round(float(latest['High']), 2),
                    'low': round(float(latest['Low']), 2),
                    'volume': int(latest['Volume']),
                    'change_pct': round(((latest['Close'] - prev_close) / prev_close) * 100, 2) if prev_close != 0 else 0,
                    'volume_trend': 'up' if latest['Volume'] > hist.iloc[-2]['Volume'] else 'down',
                    'avg_volume_5d': int(hist['Volume'].mean()),
                    'source': 'yfinance'
                }
                
            except Exception as e:
                print(f"❌ Error fetching {symbol}: {str(e)[:50]}")
                self.failed_symbols.append(symbol)
        
        return data, timestamp

# Usage
if __name__ == "__main__":
    collector = YFinanceCollector()
    data, ts = collector.fetch_batch(SYMBOLS[:5])  # Test with 5
    print(json.dumps(data, indent=2))
```

**Pros:**
- ✅ 100% free
- ✅ No authentication
- ✅ ~2 sec for 20 stocks
- ✅ 2000+ free requests/day

**Cons:**
- ⚠️ 15-30 min delayed
- ⚠️ Limited to OHLCV
- ⚠️ Yahoo owns your data source

---

### Option 1B: Breeze API (ICICI Direct) - RECOMMENDED FOR LIVE DATA

```python
from breeze_connect import BreezeConnect
import time
from datetime import datetime
import json

class BreezeDataCollector:
    def __init__(self, api_key, api_secret, session_token):
        """
        Initialize Breeze API
        
        Get credentials from: https://api.icicidirect.com/apiuser/home
        
        Requirements:
        - Free ICICI Direct demat account
        - Static IP (required after Oct 1, 2025)
        - API Key + Secret Key (generate from portal)
        - Session Token (generate fresh daily)
        """
        self.breeze = BreezeConnect(api_key=api_key)
        self.breeze.generate_session(api_secret=api_secret, session_token=session_token)
        self.ws_data = {}
    
    def on_ticks(self, ticks):
        """Callback for real-time ticks"""
        for tick in ticks:
            symbol = tick['stock_code']
            self.ws_data[symbol] = {
                'timestamp': datetime.utcnow().isoformat(),
                'symbol': symbol,
                'price': float(tick['ltp']),  # Last Traded Price
                'bid': float(tick['bid']),
                'ask': float(tick['ask']),
                'volume': int(tick['volume']),
                'bid_quantity': int(tick['bid_quantity']),
                'ask_quantity': int(tick['ask_quantity']),
                'open': float(tick['open']),
                'high': float(tick['high']),
                'low': float(tick['low']),
                'close': float(tick['close']),
                'source': 'breeze'
            }
    
    def fetch_live_snapshot(self, symbols):
        """Fetch snapshot of top-of-book"""
        data = {}
        
        # NSE format: exchange_code='NSE', stock_code='RELIANCE'
        for symbol in symbols:
            try:
                # Get Quote API call (non-streaming)
                quote = self.breeze.get_quote(
                    exchange_code='NSE',
                    stock_code=symbol,
                    product_type='cash'
                )
                
                data[symbol] = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'symbol': symbol,
                    'price': float(quote['ltp']),
                    'bid': float(quote['bid']),
                    'ask': float(quote['ask']),
                    'volume': int(quote['volume']),
                    'high': float(quote['high']),
                    'low': float(quote['low']),
                    'open': float(quote['open']),
                    'close': float(quote['close']),
                    'bid_quantity': int(quote.get('bid_quantity', 0)),
                    'ask_quantity': int(quote.get('ask_quantity', 0)),
                    'source': 'breeze'
                }
                
            except Exception as e:
                print(f"❌ Breeze error {symbol}: {e}")
        
        return data

# Usage
if __name__ == "__main__":
    # Generate session token: https://api.icicidirect.com/apiuser/home
    collector = BreezeDataCollector(
        api_key='YOUR_API_KEY',
        api_secret='YOUR_API_SECRET',
        session_token='YOUR_SESSION_TOKEN'  # Generate fresh daily
    )
    
    # Fetch snapshot
    symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'WIPRO']
    data = collector.fetch_live_snapshot(symbols)
    print(json.dumps(data, indent=2))
```

**Breeze Advantages:**
- ✅ **Real-time (<1 sec)** vs yfinance 15-30 min
- ✅ **Bid-ask spreads** (essential for feature generation)
- ✅ **WebSocket streaming** (live ticks optional)
- ✅ **5000 calls/day free** (75/min)
- ✅ **3 years historical data free**
- ✅ **Options chain data** (free!)
- ✅ SEBI compliant

**Breeze Setup (One-time):**
1. Open free ICICI Direct demat account
2. Go to https://api.icicidirect.com/apiuser/home
3. Generate API Key + Secret Key
4. Generate Session Token (valid 24h, regenerate daily)
5. Configure static IP (mandatory from Oct 1, 2025)

---

### Option 1C: Dhan API (Free Real-time + Best For Algo)

```python
import requests
import json
from datetime import datetime

class DhanDataCollector:
    def __init__(self, client_id, access_token):
        """
        Initialize Dhan API
        
        Get credentials:
        1. Create free Dhan account: https://dhanhq.co
        2. Login to https://broker.dhan.co
        3. Generate Access Token from API settings
        """
        self.client_id = client_id
        self.access_token = access_token
        self.base_url = "https://api.dhan.co"
    
    def get_live_price(self, symbols):
        """Fetch live quotes for symbols"""
        data = {}
        
        for symbol in symbols:
            try:
                # Dhan uses security_id instead of symbol name
                # Need to map NSE symbols to security IDs
                response = requests.get(
                    f"{self.base_url}/v2/quotes",
                    params={
                        'security_id': self.symbol_to_security_id(symbol),
                        'exchange_segment': 'NSE',
                        'source': 'API'
                    },
                    headers={
                        'Authorization': f'Bearer {self.access_token}',
                        'Client-ID': self.client_id
                    }
                )
                
                if response.status_code == 200:
                    quote = response.json()['data']
                    data[symbol] = {
                        'timestamp': datetime.utcnow().isoformat(),
                        'symbol': symbol,
                        'price': float(quote['ltp']),
                        'bid': float(quote.get('bid', 0)),
                        'ask': float(quote.get('ask', 0)),
                        'volume': int(quote.get('volume', 0)),
                        'open': float(quote.get('open', 0)),
                        'high': float(quote.get('high', 0)),
                        'low': float(quote.get('low', 0)),
                        'source': 'dhan'
                    }
                    
            except Exception as e:
                print(f"❌ Dhan error {symbol}: {e}")
        
        return data
    
    @staticmethod
    def symbol_to_security_id(symbol):
        """Map NSE symbols to Dhan security IDs"""
        # Common mapping - Dhan requires security_id lookup
        symbol_map = {
            'RELIANCE': '1333',
            'TCS': '3829',
            'INFY': '1211',
            'HDFC': '3967',
            'WIPRO': '1480',
            # Add more as needed
        }
        return symbol_map.get(symbol, symbol)
```

**Dhan Advantages:**
- ✅ **Completely free**
- ✅ **Real-time data**
- ✅ **Perfect for algorithmic trading** (free API)
- ✅ **No call limits mentioned**
- ✅ WebSocket support

**Dhan Setup:**
1. Create free account: https://dhanhq.co
2. Generate API credentials from broker.dhan.co
3. No special IP requirements

---

### Option 1D: Kite Connect (Zerodha) - For Serious Use

```python
from kiteconnect import KiteConnect
import json
from datetime import datetime

class KiteDataCollector:
    def __init__(self, api_key, access_token):
        """
        Kite Connect from Zerodha
        
        Pricing:
        - Personal API: FREE (no market data)
        - Connect API: ₹2000/month (includes live + historical data)
        
        Access token generation:
        1. Login to Zerodha console
        2. Generate API key from settings
        3. Get access_token programmatically
        """
        self.kite = KiteConnect(api_key=api_key)
        self.kite.set_access_token(access_token)
    
    def fetch_quotes(self, instruments):
        """
        Fetch quotes for instruments
        
        Format: ['NSE:RELIANCE', 'NSE:TCS', 'NSE:INFY']
        """
        data = {}
        
        try:
            quotes = self.kite.quote(instruments)
            
            for instrument in instruments:
                if instrument in quotes:
                    q = quotes[instrument]
                    symbol = instrument.split(':')[1]
                    
                    data[symbol] = {
                        'timestamp': datetime.utcnow().isoformat(),
                        'symbol': symbol,
                        'price': float(q['last_price']),
                        'bid': float(q['bid']),
                        'ask': float(q['ask']),
                        'volume': int(q['volume']),
                        'open': float(q['ohlc']['open']),
                        'high': float(q['ohlc']['high']),
                        'low': float(q['ohlc']['low']),
                        'close': float(q['ohlc']['close']),
                        'bid_quantity': int(q['bid_quantity']),
                        'ask_quantity': int(q['ask_quantity']),
                        'open_interest': q.get('oi', 0),
                        'source': 'kite'
                    }
        
        except Exception as e:
            print(f"❌ Kite error: {e}")
        
        return data
    
    def fetch_ohlc(self, symbols, timeframe='5minute'):
        """Fetch OHLC historical data"""
        data = {}
        
        try:
            ohlc = self.kite.historical_data(
                instrument_token=None,  # Need instrument token
                from_date='2024-01-01',
                to_date='2024-01-31',
                interval=timeframe  # minute, 5minute, 15minute, 30minute, 60minute, day
            )
        except Exception as e:
            print(f"❌ Kite historical error: {e}")
        
        return data

# Usage
if __name__ == "__main__":
    # Create Kite instance (requires access token)
    # collector = KiteDataCollector(api_key='YOUR_KEY', access_token='YOUR_TOKEN')
    # data = collector.fetch_quotes(['NSE:RELIANCE', 'NSE:TCS'])
    pass
```

---

## 2. NEWS & SENTIMENT INGESTION

### Option 2A: MarketAux (Best Indian Coverage + Sentiment)

```python
import requests
import json
from datetime import datetime, timedelta

class MarketAuxCollector:
    def __init__(self, api_key):
        """
        Free API from MarketAux
        
        Signup: https://www.marketaux.com
        - 100 requests/day on free tier
        - Includes sentiment analysis
        - Good for Indian stocks
        
        Price: FREE tier available
        """
        self.api_key = api_key
        self.base_url = "https://api.marketaux.com/v1"
    
    def get_news_for_symbols(self, symbols, hours=24):
        """Fetch news + sentiment for symbols"""
        
        all_news = {}
        
        for symbol in symbols:
            try:
                response = requests.get(
                    f"{self.base_url}/news/all",
                    params={
                        'symbols': symbol,  # e.g., 'RELIANCE'
                        'filter_entities': 'all',
                        'limit': 10,
                        'language': 'en',
                        'api_token': self.api_key
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    news_data = response.json().get('data', [])
                    
                    all_news[symbol] = {
                        'timestamp': datetime.utcnow().isoformat(),
                        'symbol': symbol,
                        'articles': [
                            {
                                'title': article.get('title'),
                                'summary': article.get('description'),
                                'published_at': article.get('published_at'),
                                'source': article.get('source'),
                                'url': article.get('url'),
                                'sentiment': article.get('sentiment'),  # bullish, bearish, neutral
                                'tags': article.get('entities', [])
                            }
                            for article in news_data[:5]  # Top 5 articles
                        ],
                        'sentiment_score': self._calculate_sentiment(news_data)
                    }
                    
            except Exception as e:
                print(f"❌ MarketAux error {symbol}: {e}")
        
        return all_news
    
    @staticmethod
    def _calculate_sentiment(articles):
        """Calculate aggregate sentiment (simple version)"""
        if not articles:
            return 'neutral'
        
        sentiments = [a.get('sentiment', 'neutral') for a in articles]
        bullish = sentiments.count('bullish')
        bearish = sentiments.count('bearish')
        
        if bullish > bearish:
            return 'bullish'
        elif bearish > bullish:
            return 'bearish'
        else:
            return 'neutral'

# Usage
if __name__ == "__main__":
    collector = MarketAuxCollector(api_key='YOUR_API_KEY')
    news = collector.get_news_for_symbols(['RELIANCE', 'TCS', 'INFY'])
    print(json.dumps(news, indent=2))
```

---

### Option 2B: NSE Corporate Announcements (RSS)

```python
import feedparser
import json
from datetime import datetime
from urllib.parse import parse_qs, urlparse

class NSERSSCollector:
    def __init__(self):
        """
        NSE RSS feeds - free, real-time announcements
        https://www.nseindia.com/rss-feed
        """
        self.feeds = {
            'corporate_announcements': 'https://www.nseindia.com/rss/corporateannouncements.xml',
            'stock_splits': 'https://www.nseindia.com/rss/corporateannouncements.xml?type=split',
            'dividends': 'https://www.nseindia.com/rss/corporateannouncements.xml?type=dividend',
            'rights': 'https://www.nseindia.com/rss/corporateannouncements.xml?type=rights'
        }
    
    def fetch_announcements(self, symbols=None):
        """
        Fetch NSE announcements
        
        Args:
            symbols: List of symbols to filter (optional)
        
        Returns:
            Dict of announcements per symbol
        """
        announcements = {}
        
        for feed_name, feed_url in self.feeds.items():
            try:
                feed = feedparser.parse(feed_url)
                
                for entry in feed.entries[:20]:  # Last 20 entries
                    try:
                        title = entry.get('title', '')
                        symbol = self._extract_symbol_from_title(title)
                        
                        if symbols and symbol not in symbols:
                            continue
                        
                        if symbol not in announcements:
                            announcements[symbol] = []
                        
                        announcements[symbol].append({
                            'timestamp': datetime.utcnow().isoformat(),
                            'title': title,
                            'published_at': entry.get('published'),
                            'type': feed_name,
                            'url': entry.get('link'),
                            'description': entry.get('summary', '')[:500]
                        })
                    
                    except Exception as e:
                        print(f"⚠️  Parse error in entry: {e}")
            
            except Exception as e:
                print(f"❌ NSE RSS error: {e}")
        
        return announcements
    
    @staticmethod
    def _extract_symbol_from_title(title):
        """Extract symbol from NSE announcement title"""
        # Typical format: "RELIANCE - Stock Split"
        parts = title.split('-')
        if parts:
            return parts[0].strip()
        return None

# Usage
if __name__ == "__main__":
    collector = NSERSSCollector()
    announcements = collector.fetch_announcements()
    print(json.dumps(announcements, indent=2, default=str))
```

---

### Option 2C: Moneycontrol RSS (News Feed)

```python
import feedparser
from datetime import datetime
import json

class MoneycontrolRSSCollector:
    def __init__(self):
        """
        Moneycontrol RSS feeds
        https://www.moneycontrol.com/rss
        """
        self.feeds = {
            'market_news': 'https://www.moneycontrol.com/rss/latestnews.xml',
            'market_updates': 'https://www.moneycontrol.com/rss/markets.xml',
            'business': 'https://www.moneycontrol.com/rss/business.xml',
        }
    
    def fetch_news(self, limit=20):
        """Fetch latest news from Moneycontrol"""
        all_news = []
        
        for feed_name, feed_url in self.feeds.items():
            try:
                feed = feedparser.parse(feed_url)
                
                for entry in feed.entries[:limit]:
                    all_news.append({
                        'timestamp': datetime.utcnow().isoformat(),
                        'title': entry.get('title'),
                        'published_at': entry.get('published'),
                        'source': 'moneycontrol',
                        'feed_type': feed_name,
                        'summary': entry.get('summary', '')[:300],
                        'url': entry.get('link')
                    })
            
            except Exception as e:
                print(f"❌ Moneycontrol RSS error: {e}")
        
        # Sort by date
        all_news.sort(
            key=lambda x: x['published_at'],
            reverse=True
        )
        
        return all_news[:limit]

# Usage
if __name__ == "__main__":
    collector = MoneycontrolRSSCollector()
    news = collector.fetch_news(limit=20)
    print(json.dumps(news, indent=2, default=str))
```

---

## 3. UNIFIED COLLECTOR (All Sources)

```python
import asyncio
import json
from datetime import datetime
from typing import Dict, List

class UnifiedMarketDataCollector:
    """
    Combines all sources for minimal, efficient collection
    """
    
    def __init__(self):
        self.price_source = YFinanceCollector()  # or BreezeDataCollector
        self.news_source = MarketAuxCollector(api_key='YOUR_KEY')
        self.announcements_source = NSERSSCollector()
    
    def collect_all(self, symbols: List[str]) -> Dict:
        """
        Collect prices + news + announcements in one call
        """
        collection_time = datetime.utcnow().isoformat()
        
        result = {
            'timestamp': collection_time,
            'prices': {},
            'news': {},
            'announcements': {},
            'status': {}
        }
        
        # Collect market data
        try:
            result['prices'], _ = self.price_source.fetch_batch(symbols)
            result['status']['prices'] = 'success'
        except Exception as e:
            result['status']['prices'] = f'error: {str(e)[:50]}'
        
        # Collect news
        try:
            result['news'] = self.news_source.get_news_for_symbols(symbols)
            result['status']['news'] = 'success'
        except Exception as e:
            result['status']['news'] = f'error: {str(e)[:50]}'
        
        # Collect announcements
        try:
            result['announcements'] = self.announcements_source.fetch_announcements(symbols)
            result['status']['announcements'] = 'success'
        except Exception as e:
            result['status']['announcements'] = f'error: {str(e)[:50]}'
        
        return result

# Usage
if __name__ == "__main__":
    collector = UnifiedMarketDataCollector()
    data = collector.collect_all(['RELIANCE', 'TCS', 'INFY'])
    print(json.dumps(data, indent=2, default=str))
```

---

## 4. INTEGRATION WITH SCHEDULER

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ScheduledDataCollection:
    def __init__(self, symbols, store):
        self.symbols = symbols
        self.store = store
        self.collector = UnifiedMarketDataCollector()
        self.scheduler = BackgroundScheduler()
    
    def start_collection(self, interval_minutes=30):
        """
        Start scheduled collection every N minutes
        
        interval_minutes: 30 or 60
        """
        
        @self.scheduler.scheduled_job(
            'interval',
            minutes=interval_minutes,
            next_run_time=datetime.now()  # Run immediately
        )
        def collect_and_store():
            try:
                logger.info(f"📊 Starting collection at {datetime.now()}")
                
                # Collect data
                data = self.collector.collect_all(self.symbols)
                
                # Store prices
                if data['prices']:
                    self.store.insert_batch(data['prices'])
                    logger.info(f"✓ Stored {len(data['prices'])} prices")
                
                # Store news (if applicable)
                if data['news']:
                    self.store.insert_news(data['news'])
                    logger.info(f"✓ Stored news for {len(data['news'])} symbols")
                
                logger.info("✓ Collection completed")
                
            except Exception as e:
                logger.error(f"✗ Collection error: {e}", exc_info=True)
        
        self.scheduler.start()
        logger.info(f"🚀 Collection scheduler started (interval: {interval_minutes} min)")
    
    def stop_collection(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("🛑 Collection scheduler stopped")

# Usage
if __name__ == "__main__":
    SYMBOLS = [
        'RELIANCE', 'TCS', 'INFY', 'HDFC', 'WIPRO',
        'BAJAJ-AUTO', 'MARUTI', 'AXIS', 'ICICIBANK', 'SBIN',
        'HCLTECH', 'TECHM', 'ITC', 'BHARTIARTL', 'SUNPHARMA',
        'NESTLEIND', 'TITAN', 'JSWSTEEL', 'HINDALCO', 'ULTRACEMCO'
    ]
    
    from storage import StockDataStore
    store = StockDataStore()
    
    scheduler = ScheduledDataCollection(SYMBOLS, store)
    scheduler.start_collection(interval_minutes=30)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        scheduler.stop_collection()
```

---

## 5. COMPLIANCE CHECKLIST

✅ **All Compliant Options:**

| Source | Compliance | Notes |
|--------|-----------|-------|
| yfinance | ✅ Legal for personal use | Public data from Yahoo |
| Breeze API | ✅ SEBI-compliant | Licensed broker data |
| Dhan API | ✅ SEBI-compliant | Licensed broker data |
| Kite Connect | ✅ SEBI-compliant | Licensed broker data |
| MarketAux | ✅ Public news aggregation | Licensed news sources |
| NSE RSS | ✅ Official announcements | Direct from NSE |
| Moneycontrol RSS | ✅ Public feed | Licensed news |

❌ **Don't:**
- Redistribute data commercially (broker data)
- Claim real-time accuracy (yfinance is delayed)
- Scrape NSE/BSE directly (use official APIs)

✅ **OK for:**
- Personal analysis
- Non-commercial trading
- Research and backtesting

---

## 6. IMPLEMENTATION DECISION TREE

```
Need Market Data?
├─ Live (<1 sec required)
│  ├─ Have account? → Use Breeze/Dhan API (FREE)
│  └─ No account? → Create ICICI/Dhan account (free)
│
├─ Near-live (15-30 min OK)
│  └─ Use yfinance (FREE, no setup)
│
└─ Professional use (Serious algo trading)
   └─ Use Kite Connect (₹2000/mo, most robust)

Need News/Sentiment?
├─ Indian stocks + sentiment → MarketAux (FREE)
├─ Corporate events → NSE RSS (FREE)
├─ General market news → Moneycontrol RSS (FREE)
└─ Global + detailed → StockNewsAPI (limited)

Storage?
├─ Single machine, <100GB/year → SQLite (FREE)
├─ Scalable, compression needed → TimescaleDB (FREE)
└─ Analytics focus → Parquet files (FREE)
```

---

## 7. MINIMAL MONTHLY COST

| Scenario | Cost | Components |
|----------|------|-----------|
| Hobbyist (yfinance) | ₹0 | yfinance + SQLite + free news |
| Active trader (real-time) | ₹0 | Breeze API + SQLite + NSE RSS |
| Professional (full featured) | ₹2000 | Kite Connect + TimescaleDB + MarketAux |

---

## Resources

- [Breeze API Docs](https://api.icicidirect.com/breezeapi/documents/index.html)
- [Dhan API Docs](https://dhanhq.co/trading-apis/individuals-geeks)
- [Kite Connect Docs](https://kite.trade)
- [yfinance GitHub](https://github.com/ranaroussi/yfinance)
- [MarketAux API](https://www.marketaux.com)
- [NSE RSS Feeds](https://www.nseindia.com/rss-feed)
- [SEBI Guidelines](https://www.sebi.gov.in)
