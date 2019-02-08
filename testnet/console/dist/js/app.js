$(function () {

  'use strict';
  
  indexProtocol = _.extend({
	run: function(){
		//search 
		/*
		$('#sidebar-search-form').submit(function(e){
			$(e.currentTarget).preventDefault();
		});
		*/
		
		$('#search-btn').on('click', function(e){
			var val = $('#chain-search-control').val();
				
			if (val)	indexProtocol.findAndOpen( val );
		});
		
		$('#chain-search-control').on('keyup', function(e){
			//console.log( e );
			if (e.keyCode == 13){
				var val = $('#chain-search-control').val();
				
				if (val)	indexProtocol.findAndOpen( val );
			}				
		});
		
		if (_datasourceKeys){
			this.dataSources = _datasourceKeys;
				_datasourceKeys = null;
		}
		
		
		//show default page
		this.overviewPage();
	},
	
	findAndOpen: function(val){
		console.log('Search for: ' + val + ' (isNumber: '+$.isNumeric( val )+')' );
		
		if ($.isNumeric( val )){
				val = parseInt(val);
				
				if (val > 0){
					//possible block height?
					indexProtocol.blockPage( val );
				}
			}	
		
		
		
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
		},
		'quoine' : {
			name: 'Quoine',
			site: 'https://quoine.com',
			country: 'UNK',
			api: 'https://api.quoine.com/executions?product_id=1&limit=1000&page=1'
		},
		'gdax' : {
			name: 'GDAX',
			site: 'https://gdax.com',
			country: 'UNK',
			api: 'https://api.gdax.com/products/BTC-USD/trades?limit=100'
		},
		'bitbay' : {
			name: 'BitBay',
			site: 'https://bitbay.net',
			country: 'UNK',
			api: 'https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc'
		},
		'quadrigacx' : {
			name: 'QuadrigaCX',
			site: 'https://quadrigacx.com',
			country: 'UNK',
			api: 'https://api.quadrigacx.com/v2/transactions?book=btc_usd&time=hour'
		},
		'independentreserve' : {
			name: 'Independent Reserve',
			site: 'https://independentreserve.com',
			country: 'UNK',
			api: 'https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50'
		},
		'gatecoin' : {
			name: 'Gatecoin',
			site: 'https://gatecoin.com',
			country: 'UNK',
			api: 'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=250'
		},
		'wavesdex' : {
			name: 'Waves DEX',
			site: 'http://wavesplatform.com',
			country: 'UNK',
			api: 'http://marketdata.wavesplatform.com/api/trades/BTC/USD/100'
		},
		'abucoins' : {
			name: 'Abucoins',
			site: 'https://abucoins.com',
			country: 'UNK',
			api: 'https://api.abucoins.com/products/BTC-USD/trades?limit=200'
		},
		'bitsane' : {
			name: 'Bitsane',
			site: 'https://bitsane.com',
			country: 'UNK',
			api: 'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=250'
		},
		'bitexla' : {
			name: 'Bitex.la',
			site: 'https://bitex.la',
			country: 'UNK',
			api: 'https://bitex.la/api-v1/rest/btc_usd/market/transactions'
		},
		'bitlish' : {
			name: 'Bitlish',
			site: 'https://bitlish.com',
			country: 'UNK',
			api: 'https://bitlish.com/api/v1/trades_history?pair_id=btcusd'
		},
		'southxchange' : {
			name: 'SouthXchange',
			site: 'https://www.southxchange.com',
			country: 'UNK',
			api: 'https://www.southxchange.com/api/trades/BTC/USD'
		},
		'bisq' : {
			name: 'Bisq',
			site: 'https://bisq.network',
			country: 'UNK',
			api: 'https://markets.bisq.network/api/trades?market=btc_usd&limit=250&format=json&sort=desc'
		},
		'coingi' : {
			name: 'Coingi',
			site: 'https://coingi.com',
			country: 'UNK',
			api: 'https://api.coingi.com/current/transactions/btc-usd/250'
		},
		'LEOxChange' : {
			name: 'Coingi',
			site: 'https://leoxchange.com',
			country: 'UNK',
			api: 'https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=100'
		},
		'Cobinhood' : {
			name: 'Coingi',
			site: 'https://cobinhood.com',
			country: 'UNK',
			api: 'https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50'
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
	},
	
	walletPage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/wallet.page.html');
	},
	
	datasourcePage: function(){
		var el = $('#console-content-wrapper');
			el.empty().load('/console/datasource.page.html');
	},
	
	
	test: function(){
		$.getJSON("https://rpc.testnet.indexprotocol.online/tx_search?query=\"year='2019'\"", function(res){ 
			console.dir( res );
		});
	}
	
  });
  
  

  indexProtocol.run();
});
