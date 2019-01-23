$(function () {

  'use strict';
  
  indexProtocol = _.extend({
	run: function(){
		
		
		
		
		this.overviewPage();
	},
	
	_timer: null,	
	height: null,
	
	totalNodesBytes: 0,
	
	nodeCodes: {
		'am'	: 'Amsterdam, NL',
		'ca'	: 'Canada, CA',
		'de'	: 'Frankfurt, DE',
		'ny'	: 'New-York, USA',
		'sf'	: 'San Francisco, USA',
		'sg'	: 'Singapore, SG',
		'uk'	: 'London, UK',
		'in'	: 'Bangalore, IN',
		'tw'	: 'Taiwan, TW',
		'au'	: 'Sydney, AU'
	},
	
	txTypes: {
		'CET' : 'Exchange',
		'AVG' : 'Aggregated',
		'REG' : 'New account',
		'TRA' : 'Transfer'		
	},
	
	/*
	'Quoine'	=>	'https://api.quoine.com/executions?product_id=1&limit=1000&page=1',
	'GDAX'		=>	'https://api.gdax.com/products/BTC-USD/trades?limit=100',
	'BitBay'	=>	'https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc',
	'QuadrigaCX'	=>	'https://api.quadrigacx.com/v2/transactions?book=btc_usd&time=hour',
	'Independent Reserve'	=>	'https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50',
	'Gatecoin'	=>	'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=250',
	'Waves DEX'	=>	'http://marketdata.wavesplatform.com/api/trades/BTC/USD/100',
	'Abucoins'	=>	'https://api.abucoins.com/products/BTC-USD/trades?limit=200',
	'Bitsane'	=>	'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=250',
	'Bitex.la'	=>	'https://bitex.la/api-v1/rest/btc_usd/market/transactions',
	'Bitlish'	=>	'https://bitlish.com/api/v1/trades_history?pair_id=btcusd',
	'SouthXchange'	=>	'https://www.southxchange.com/api/trades/BTC/USD',
	'Bisq'	=>	'https://markets.bisq.network/api/trades?market=btc_usd&limit=250&format=json&sort=desc',
	'Coingi'	=>	'https://api.coingi.com/current/transactions/btc-usd/250',
	'LEOxChange'	=>	'https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=100',
	'Cobinhood'		=>	'https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50',
);
	
	*/
	dataSources: {
		'hitbtc' : {
			name : 'HitBTC',
			site : 'https://hitbtc.com',
			country : 'UNK', 
			api: 'https://api.hitbtc.com/api/2/public/trades/BTCUSD?limit=250'
		},
		'rightbtc' : {
			name : 'RightBTC',
			site : 'https://www.rightbtc.com',
			country : 'UNK', 
			api: 'https://www.rightbtc.com/api/public/trades/BTCUSD/100'
		},
		'gemini' : {
			name : 'Gemini',
			site : 'https://gemini.com',
			country : 'UNK', 
			api: 'https://api.gemini.com/v1/trades/btcusd?limit_trades=250&include_breaks=0',
		},
		'okcoin/intl' : {
			name: 'OkCoin/Inter',
			site: 'https://www.okcoin.com',
			country : 'UNK', 
			api: 'https://www.okcoin.com/api/v1/trades.do?symbol=btc_usd'
		},
		'dsx' : {
			name: 'DSX',
			site: 'https://dsx.uk',
			country : 'UNK', 
			api: 'https://dsx.uk/mapi/trades/btcusd'
		},
		'coinbasepro' : {
			name: 'CoinBase Pro',
			site: 'https://pro.coinbase.com',
			country : 'UNK', 
			api: 'https://api.pro.coinbase.com/products/BTC-USD/trades'
		},
		'lakebtc' : {
			name: 'LakeBTC',
			site: 'https://lakebtc.com',
			country: 'UNK',
			api: 'https://api.lakebtc.com/api_v2/bctrades?symbol=btcusd'
		},
		'bitstamp' : {
			name: 'Bitstamp',
			site: 'https://www.bitstamp.net',
			country: 'UNK',
			api: 'https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour'
		},
		'exmo' : {
			name: 'EXMO',
			site: 'https://exmo.com',
			country: 'UNK',
			api: 'https://api.exmo.com/v1/trades/?pair=BTC_USD'
		},
		'bitfinex' : {
			name: 'Bitfinex',
			site: 'https://bitfinex.com',
			country: 'UNK',
			api: 'https://api.bitfinex.com/v1/trades/btcusd?limit_trades=250'
		},
		'cex.io' : {
			name: 'CEX.IO',
			site: 'https://cex.io',
			country: 'UNK',
			api: 'https://cex.io/api/trade_history/BTC/USD/'
		},
		'livecoin' : {
			name: 'Livecoin',
			site: 'https://livecoin.net',
			country: 'UNK',
			api: 'https://api.livecoin.net/exchange/last_trades?currencyPair=BTC/USD&minutesOrHour=false'
		},
		'btc-alpha' : {
			name: 'BTC-Alpha',
			site: 'https://btc-alpha.com',
			country: 'UNK',
			api: 'https://btc-alpha.com/api/v1/exchanges/?format=json&limit=250&pair=BTC_USD'
		},
		'coinsbank' : {
			name: 'CoinsBank',
			site: 'https://coinsbank.com',
			country: 'UNK',
			api: 'https://coinsbank.com/api/bitcoincharts/trades/BTCUSD'
		},
		'itbit' : {
			name: 'itBit',
			site: 'https://itbit.com',
			country: 'UNK',
			api: 'https://api.itbit.com/v1/markets/XBTUSD/trades'
		}
		
		
	},
	
	
	//Main page (overview of network)
	overviewPage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/overview.page.html');
	},
	
	//Network status 
	networkPage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/network.page.html');
	},
	
	//Validators (from genesis)
	validatorsPage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/validators.page.html');
	},
	
	explorerPage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/explorer.page.html');
	},
	
	blockPage: function(height){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/block.page.html?height=' + height);
	}
	
  });
  
  

  indexProtocol.run();
});
