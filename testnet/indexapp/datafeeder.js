/** Simple script for aggregators data **/

const crypto 		= require('crypto');
const _				= require('underscore');
const prettyHrtime 	= require('pretty-hrtime');
const async 		= require('async');
const secp256k1		= require('secp256k1');
const fs 			= require('fs');
const EventEmitter 	= require('events');
const moment 		= require('moment');
const http			= require('http');
const https			= require('https');
const fetch 		= require('node-fetch');

const events		= new EventEmitter();
const fixedExponent = 1000000;
const rpcHost		= 'rpc.testnet.indexprotocol.online';

const apiFeeds = {
	/*'CEX.io' 	:	'https://cex.io/api/trade_history/BTC/USD/',
	'BTC-Alpha' :	'https://btc-alpha.com/api/v1/exchanges/?format=json&limit=100&pair=BTC_USD',
	'Bitfinex' 	:	'https://api.bitfinex.com/v1/trades/btcusd?limit_trades=250',
	'Quoine'	:	'https://api.quoine.com/executions?product_id=1&limit=100&page=1', 
	'GDAX'		:	'https://api.gdax.com/products/BTC-USD/trades?limit=100',	
	'HitBTC'	:	'https://api.hitbtc.com/api/2/public/trades/BTCUSD?limit=100',
	'Bitstamp'	:	'https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour',
	'Gemini'	:	'https://api.gemini.com/v1/trades/btcusd?limit_trades=50&include_breaks=0',
	'LakeBTC'	:	'https://api.lakebtc.com/api_v2/bctrades?symbol=btcusd',
	'Exmo'		:	'https://api.exmo.com/v1/trades/?pair=BTC_USD',
	'CoinsBank'	:	'https://coinsbank.com/api/bitcoincharts/trades/BTCUSD',
	'BitBay'	:	'https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc',
	'Livecoin'	:	'https://api.livecoin.net/exchange/last_trades?currencyPair=BTC/USD&minutesOrHour=false',
    'itBit'		:	'https://api.itbit.com/v1/markets/XBTUSD/trades',
	'OkCoin'	:	'https://www.okcoin.com/api/v1/trades.do?symbol=btc_usd',
	'Independent Reserve'	:	'https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50',
	'DSX'	:	'https://dsx.uk/mapi/trades/btcusd',
	'Gatecoin'	:	'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=50',*/
	'Waves DEX'	:	'http://marketdata.wavesplatform.com/api/trades/BTC/USD/50',
	/*'Abucoins'	:	'https://api.abucoins.com/products/BTC-USD/trades?limit=50',
	'Bitsane'	:	'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=50',
	'Bitex.la'	:	'https://bitex.la/api-v1/rest/btc_usd/market/transactions',
	'Bitlish'	:	'https://bitlish.com/api/v1/trades_history?pair_id=btcusd',
	'SouthXchange'	:	'https://www.southxchange.com/api/trades/BTC/USD',
	'Bisq'	:	'https://markets.bisq.network/api/trades?market=btc_usd&limit=50&format=json&sort=desc',
	'Coingi'	:	'https://api.coingi.com/current/transactions/btc-usd/50',
	'LEOxChange'	:	'https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=50',
	'Cobinhood'		:	'https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50',
	'CoinbasePro'	:	'https://api.pro.coinbase.com/products/BTC-USD/trades',
	'RightBTC'	:	'https://www.rightbtc.com/api/public/trades/BTCUSD/50'  */
};

var apiHttpAgent = new http.Agent({
	keepAlive: true,
	timeout: 5000
});

var apiHttpsAgent = new https.Agent({
	keepAlive: true,
	timeout: 5000
});

//im ms, max difference between quote and current time. Any older quotes will be ignore
const maxTimeDiff = 5 * 60 * 1000;
const dydx = 1000000;

//================
function makeQuote(id, ts, price, amount, side, total){
	let tot = Math.trunc( price * amount * dydx );
	if (total)	tot = Math.trunc( total * dydx );
	
	return {
		id		: new String(id).toLowerCase().trim().toString(),
		ts 		: ts,
		symbol 	: 'BTC/USD',
		asset	: 'BTC',
		cur		: 'USD',
		type	: 'FX/Spot',
		side	: side,
		price	: Math.trunc( price * dydx ),
		amount	: Math.trunc( amount * dydx ),
		total	: tot
	};	
}

_.each(apiFeeds, function(url, src){
	
	let agent = apiHttpAgent;
	
	if (url.indexOf('https') === 0)
		agent = apiHttpsAgent;
	
	//current time 
	const ts = new Date().getTime();
	
	fetch(url, {agent: agent})
		.then(function(res){
			if (res.ok)	 
				return res;
			else 
				throw Error(res.statusText);
		})
		.then(res => res.json())
		.then(function(data){
			//console.log(' Data fetched OK ');
			//console.dir( data, {depth: 16});
			let newQuotes = [];
			let bodyHash = sha256( JSON.stringify( data ) ).toString('hex');
			
			switch( src ){
				case 'CEX.io': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16});
					
					if (data && data.length > 0){
						data.forEach(function(q){
							if (!q || !q.date) return;
							
							let qt = 0;
							
							if (_.isString(q.date) && q.date.length == 10)
								qt = new Date( parseInt(q.date) * 1000 ).getTime();
							else
							if ( ((_.isString(q.date) && q.date.length == 13)) || _.isNumber(q.date) ){
								qt = new Date( parseInt(q.date) ).getTime();
							}
							
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
								
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + qt;
								
								if (q.tid)	id = q.tid;
								
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}
						});
					}
					
					break;
				}
				case 'BTC-Alpha': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16});
					//process.exit();
					
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestamp || !q.id) return;
							
							let qt = new Date( Math.trunc( q.timestamp * 1000 ) ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.timestamp;
								
								if (q.id)	id = q.id;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.amount ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Bitfinex': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16});
					//process.exit();
					
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestamp || !q.tid || q.exchange != 'bitfinex') return;
							
							let qt = new Date( Math.trunc( q.timestamp * 1000 ) ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.timestamp;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.amount ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Quoine': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data.models.length > 0){
						data.models.forEach(function(q){
							
							if (!q || !q.created_at || !q.id) return;
							
							let qt = new Date( Math.trunc( q.created_at * 1000 ) ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.taker_side.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.taker_side.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.created_at;
								
								if (q.id)	id = q.id;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.amount ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'GDAX': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.time || !q.trade_id) return;
							
							let qt = new Date( q.time ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.side.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.side.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.time;
								
								if (q.trade_id)	id = q.trade_id;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.size ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'HitBTC': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestamp || !q.id) return;
							
							let qt = new Date( q.timestamp ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.side.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.side.toLowerCase() == 'sell')
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.timestamp;
								
								if (q.id)	id = q.id;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Bitstamp': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date || !q.tid) return;
							
							let qt = new Date( q.date ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type != 1)	
									side = 'BUY';
								else
									side = 'SELL';
								
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Gemini': {
					console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestampms || !q.tid || q.exchange != 'gemini') return;
							
							let qt = new Date( q.timestampms ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.timestampms;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'LakeBTC': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date || !q.tid) return;
							
							let qt = new Date( q.date ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
																
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Exmo': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data['BTC_USD'])	data = data['BTC_USD'];
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date || !q.trade_id || q.exchange != 'gemini') return;
							
							let qt = new Date( q.date ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.trade_id)	id = q.trade_id;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side, parseFloat(q.amount));
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'CoinsBank': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date || !q.tid) return;
							
							let qt = new Date( q.date ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.direction.toLowerCase() == 'bid')	
									side = 'BUY';
								else
								if (q.direction.toLowerCase() == 'ask')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'BitBay': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date || !q.tid) return;
							
							let qt = new Date( q.date ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'bid')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Livecoin': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.time || !q.id) return;
							
							let qt = new Date( q.time ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'bid')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
																
								let id = q.id + '-s' + q.orderSellId + '-b' + q.orderBuyId;

//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'itBit': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
				
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestamp || !q.matchNumber) return;
							
							let qt = new Date( q.timestamp ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								let id = src.toLowerCase() + '-' + q.timestamp;
								
								if (q.matchNumber)	id = q.matchNumber;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'OkCoin': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();

					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.date_ms || !q.tid) return;
							
							let qt = new Date( q.date_ms ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'buy')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'sell')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.date_ms;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Independent Reserve': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();

					if (data && data.Trades.length > 0){
						data.Trades.forEach(function(q){
							
							if (!q || !q.TradeTimestampUtc) return;
							
							let qt = new Date( q.TradeTimestampUtc ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
																
								let id = src.toLowerCase() + '-' + q.TradeTimestampUtc;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.SecondaryCurrencyTradePrice ), parseFloat( q.PrimaryCurrencyAmount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'DSX': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (data && data['btcusd'])	data = data['btcusd'];
	
					if (data && data.length > 0){
						data.forEach(function(q){
							
							if (!q || !q.timestamp || !q.trade_id) return;
							
							let qt = new Date( q.timestamp * 1000 ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.type.toLowerCase() == 'bid')	
									side = 'BUY';
								else
								if (q.type.toLowerCase() == 'ask')
									side = 'SELL';
																
								let id = src.toLowerCase() + '-' + q.date;
								
								if (q.tid)	id = q.tid;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				case 'Gatecoin': {
					//console.log( src + ' Data fetched OK ');
					//console.dir( data, {depth: 16, maxArrayLength: 2048});
					//process.exit();
					
					if (!data || !data.responseStatus || data.responseStatus.message != 'OK') break;
	
					if (data && data.transactions.length > 0){
						data.transactions.forEach(function(q){
							
							if (!q || !q.transactionTime || !q.transactionId || q.currencyPair != 'BTCUSD') return;
														
							let qt = new Date( q.transactionTime * 1000 ).getTime();
								
							if (qt && ( (ts - qt) > 0 && (ts - qt) < maxTimeDiff )){
//console.dir( q );
								let side = '';
								
								if (q.way.toLowerCase() == 'bid')	
									side = 'BUY';
								else
								if (q.way.toLowerCase() == 'ask')
									side = 'SELL';
																
								let id = q.transactionId + '-s' + q.askOrderId + '-b' + q.bidOrderId;
//console.dir( [	id, qt, parseFloat( q.price ), parseFloat( q.size ), side ] );							
								let z = makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
								
								if (z) newQuotes.push( z );
							}							
						});
					}
					
					break;
				}
				
				
				default: {
					console.log('Unknown source, please update code!');
				}
			}
			
			console.log( src + ' :: parsed ' + newQuotes.length + ' new trades');
			console.dir( newQuotes );
			
		}).catch(function(e){console.error('ERROR ('+src+'): ', e);});
});





//=================


// returns Buffer
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
}




function getRateTpl(){
	return {
			id		: 0,
			symbol	: '',
			asset	: 'BTC',
			cur		: 'USD',
			type	: 'IND', //index
			side	: '',
			ts		: 0,
			//pts		: new Date().getTime(), //datateime of processing
			excode	: 0,
			//pubKey	: '', //public Key of source 
			//sign	: '',
			amount	: 1 * fixedExponent,
			total	: 0,
			price	: 0
	};
}

//Open datasource keys 
const sourceKeys	= JSON.parse( fs.readFileSync('./datasource.keys.json', {encoding:'utf8'}) );

const dataFeed	= {
	//OK
	coinMarketCap	: {
		"enabled"	: 	true,
		"email"		:	"indexprotocol@coinindex.agency",
		"apikey"	:	"ef188838-e4dd-4e47-8fb0-113c80bbbbe6",
		"interval"	:	5 * 60, //5 min TEST
		
		"nonce"		: 0, //counter of query 
		"updated"	: 0, //UTC of last succsessful responce
		"loaded"	: 0, //UTC loading data (local)
		"_raw"		: '',
		"lastHash"	: '',
		"rate"		: null //latest rate, object 
	},
	//OK
	cryptoCompare	: {
		"enabled"	: 	true,
		"email"		:	"indexprotocol@coinindex.agency",
		"apikey"	:	"d333f8c2fd912718229a9b6c52a8d5ab60b76917167f186ba4777e8927756c5f",
		"interval"	:	1 * 60, //1 min	
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	},
	//OK
	coinGecko		: {
		"enabled"	: 	true,
		"interval"	:	3, //3 sec	
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object 
	},
	//OK
	bitcoinAverage	: {
		"enabled"	: 	true,
		"apikey"	:	"NDA5M2M5M2U2NTBjNGVlMWE1YjE0MmRlYzg1NmJhM2M",  //pubKey	
		"secret"	:	"ZTMwYzNiZWVhNzU4NGI0Y2JiYTRlODkzZmE3YTExZjZkMzZhYWFjMGU0Mzk0YTYxOTk1OTdmNWVlZjg3NjM0OA",
		"interval"	:	10 * 60,	//10 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object 
	},
	//OK
	coinDesc		: {
		"enabled"	: 	true,
		"interval"	:	3, //3 sec	
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object 
	},
	//Fail with usd pairs
	worldCoinIndex	: {
		"enabled"	: 	false,
		"apikey"	: 	"jKYUFJIIFD2tZPEoRVwQh7buEAWEw4",
		"interval"	:	3, //5 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object 		
	},
	//OK
	bitcoinCharts	: {
		"enabled"	: 	true,
		"interval"	:	15 * 60, //15 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	},
	
	cryptoFacilities: {
		"enabled"	: 	true,
		"interval"	:	3, //15 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	},
	/**
	cryptoFacilitiesRR : {
		"enabled"	: 	true,
		"interval"	:	3, //15 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	},
	**/
	//Disable, use IP/address checkig
	cryptonator		: {
		"enabled"	: 	false,
		"interval"	:	30, //15 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	}
};

//==========
events.on('fetchData:coinMarketCap', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	api.getQuotes({symbol: 'BTC', convert: 'USD'}).then(
		function(data){
			dataFeed[ src ]._raw = data;
			let ts = new Date().getTime();
		
			if (data && data.status && data.status.error_code == 0 && data.data && data.data.BTC && data.data.BTC.quote && data.data.BTC.quote.USD){
				dataFeed[ src ].loaded = ts;
				
				let rate = getRateTpl();
					rate.id 		= dataFeed[ src ].nonce;
					rate.symbol		= 'BTC/USD';
					rate.ts 		= new Date( data.data.BTC.quote.USD.last_updated ).getTime();
					rate.excode		= src.toLowerCase();
					rate.total		= Math.trunc( data.data.BTC.quote.USD.price * fixedExponent );
					rate.price		= rate.total;
					
					//let's sign and commit to chain
					events.emit('signRate', rate, src);		
			}
			else
				console.log('ERROR ['+src+'] while obtain current rate');
		}
	).catch(function(e){console.error('ERROR ['+src+']: ', e);});	
});

events.on('fetchData:cryptoCompare', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	//@todo: use generateAvg and sent two different indexes	
	api.priceFull('BTC', 'USD').then(function(data){
		dataFeed[ src ]._raw = data;
		let ts = new Date().getTime();
		
		if (data && data.BTC && data.BTC.USD){
			dataFeed[ src ].loaded = ts;
			
			let rate = getRateTpl();
				rate.id 		= dataFeed[ src ].nonce;
				rate.symbol		= 'BTC/USD';
				rate.ts 		= new Date( data.BTC.USD.LASTUPDATE * 1000 ).getTime();
				rate.excode		= src.toLowerCase();
				rate.total		= data.BTC.USD.PRICE * fixedExponent;
				rate.price		= rate.total;
				
				//let's sign and commit to chain
				events.emit('signRate', rate, src);		
		}
		else
			console.log('ERROR while obtain current rate');

		//console.dir(data, {depth:16, colors: true});
	
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

events.on('fetchData:coinGecko', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	var func = async() => {
		
		let data = await dataConn.coinGecko.simple.price({
			ids: 'bitcoin',
			vs_currencies: 'usd',
			include_last_updated_at: true
		});
		
		dataFeed[ src ]._raw = data;		
		let ts = new Date().getTime();
		
		if (data && data.success == true && data.data && data.data.bitcoin && data.data.bitcoin.usd){
			dataFeed[ src ].loaded = ts;
			
			let rate = getRateTpl();
				rate.id 		= dataFeed[ src ].nonce;
				rate.symbol		= 'BTC/USD';
				rate.ts 		= new Date( data.data.bitcoin.last_updated_at * 1000 ).getTime();
				rate.excode		= src.toLowerCase();
				rate.total		= data.data.bitcoin.usd * fixedExponent;
				rate.price		= rate.total;
				
				//let's sign and commit to chain
				events.emit('signRate', rate, src);		
		}
		else
			console.log('ERROR ['+src+'] while obtain current rate');
	};
	
	func();
});

events.on('fetchData:bitcoinAverage', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	api.getTickerDataPerSymbol('global', 'BTCUSD', function(_data) {
		
		let data = '';
		
		if (_data)	data = JSON.parse( _data );
		
		let ts = new Date().getTime();
		dataFeed[ src ]._raw = _data;
		
		if (data && data.last){
			dataFeed[ src ].loaded = ts;
					
			let rate = getRateTpl();
				rate.id 		= dataFeed[ src ].nonce;
				rate.symbol		= 'BTC/USD';
				rate.ts 		= new Date( data.timestamp ).getTime();
				rate.excode		= src.toLowerCase();
				rate.total		= data.last * fixedExponent;
				rate.price		= rate.total;
			
				//let's sign and commit to chain
				events.emit('signRate', rate, src);
		}
		
		//console.dir(data, {depth:16, colors: true});

	}, function(e){console.error('ERROR ['+src+']: ', e);});
	
});

events.on('fetchData:coinDesc', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
		api.getCurrentPrice().then(
			function(data){
				let ts = new Date().getTime();
				dataFeed[ src ]._raw = data;
				
				//@todo: add other currency (EUR, GBP)
				//@todo: add othre index, check asset
				if (data && data.bpi && data.bpi.USD && data.bpi.USD.rate_float){
					dataFeed[ src ].loaded = ts;
					
					let rate = getRateTpl();
						rate.id 		= dataFeed[ src ].nonce;
						rate.symbol		= 'BTC/USD_BPI';
						rate.ts 		= new Date( data.time.updated ).getTime();
						rate.excode		= src.toLowerCase();
						rate.total		= data.bpi.USD.rate_float * fixedExponent;
						rate.price		= rate.total;
					
						//let's sign and commit to chain
						events.emit('signRate', rate, src);					
				}			  
			}
		).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

events.on('fetchData:worldCoinIndex', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	api.getTicker('btc', 'usd').then(function(data){
		
		
		console.dir(data, {depth:16, colors: true});
		
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

events.on('fetchData:bitcoinCharts', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	api('http://api.bitcoincharts.com/v1/weighted_prices.json').then(res => res.json()).then(function(data){
		
		let ts = new Date().getTime();
		dataFeed[ src ]._raw = data;
		
		if (data && data.USD && data.USD['24h']){
			dataFeed[ src ].loaded = ts;
					
			let rate = getRateTpl();
				rate.id 		= dataFeed[ src ].nonce;
				rate.symbol		= 'BTC/USD_24HWA';
				rate.ts 		= new Date().getTime();
				rate.excode		= src.toLowerCase();
				rate.total		= data.USD['24h'] * fixedExponent;
				rate.price		= rate.total;
			
				//let's sign and commit to chain
				events.emit('signRate', rate, src);
		
			//console.dir(data, {depth:16, colors: true});
		}
	
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

events.on('fetchData:cryptoFacilities', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	api('https://www.cryptofacilities.com/derivatives/api/v3/tickers').then(res => res.json()).then(function(data){
		
		let ts = new Date().getTime();
		dataFeed[ src ]._raw = data;
		
		if (data && data.result && data.result == 'success' && data.tickers){
			dataFeed[ src ].loaded = ts;
					
			//Use two = Reference Rate and RealTime Index		
			
			_.each(data.tickers, function(v){
				if (v.symbol === 'in_xbtusd'){
					let rate = getRateTpl();
						rate.id 		= dataFeed[ src ].nonce;
						rate.ts			= new Date( v.lastTime ).getTime();
						rate.excode		= src.toLowerCase();
				
						rate.symbol		= 'CME CF Real-Time Indices';
					
					rate.price		= v.last * fixedExponent;
					rate.total		= rate.price;
					
					//let's sign and commit to chain
					events.emit('signRate', rate, src);
				}				
			});

			//console.dir(data, {depth:16, colors: true});
		}
	
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

/**
events.on('fetchData:cryptoFacilitiesRR', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ 'cryptoFacilities' ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	api('https://www.cryptofacilities.com/derivatives/api/v3/tickers').then(res => res.json()).then(function(data){
		
		let ts = new Date().getTime();
		dataFeed[ src ]._raw = data;
		
		if (data && data.result && data.result == 'success' && data.tickers){
			dataFeed[ src ].loaded = ts;
					
			//Use two = Reference Rate and RealTime Index		
			
			_.each(data.tickers, function(v){
				if (v.symbol === 'rr_xbtusd'){
					let rate = getRateTpl();
						rate.id 		= dataFeed[ src ].nonce;
						rate.ts			= new Date( v.lastTime ).getTime();
						rate.excode		= src.toLowerCase();
						rate.symbol		= 'CME CF Reference Rates';

										
					rate.price		= v.last * fixedExponent;
					rate.total		= rate.price;
					
					//let's sign and commit to chain
					events.emit('signRate', rate, src);
				}				
			});

			//console.dir(data, {depth:16, colors: true});
		}
	
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});
**/
events.on('fetchData:cryptonator', function(src){
	console.log(new Date() + ' :: fetchData: ' + src);
	
	let api = dataConn[ src ];
	
	//@todo: state nonce and all data to persistent storage (RocksDb)
	dataFeed[ src ].nonce++;
	
	//
	api('https://api.cryptonator.com/api/ticker/btc-usd').then(res => res.json()).then(function(data){
		
		let ts = new Date().getTime();
		dataFeed[ src ]._raw = data;
		
		if (data && data.success && data.success == true && data.ticker){
			dataFeed[ src ].loaded = ts;
			
			let rate = getRateTpl();
				rate.id 		= dataFeed[ src ].nonce;
				rate.symbol		= 'BTC/USD'; //volume_weighted
				rate.ts 		= new Date( data.timestamp ).getTime();
				rate.excode		= src.toLowerCase();
				rate.price		= Math.trunc(parseFloat(data.ticker.price) * fixedExponent);
				rate.total		= rate.price;
			
				//let's sign and commit to chain
				events.emit('signRate', rate, src);
		}
	}).catch(function(e){console.error('ERROR ['+src+']: ', e);});
});

//===========
events.on('signRate', function(rate, src){
	rate.price = Math.trunc( rate.price );
	rate.total = Math.trunc( rate.total );
	dataFeed[ src ].updated = rate.ts;
	
//console.log('[' + rate.symbol + '] New val: ' + rate.price);
	
	//hash this 
	let hash = sha256( JSON.stringify( rate ) );
	
	//prevent double sending
	if (dataFeed[ src ].lastHash == hash) return;	
	
	//test it
	if (dataFeed[ src ].rate && dataFeed[ src ].rate.price === rate.price) return;
	
	
	let pubKey, privKey;
	//add pubKey 
	if (sourceKeys.keys[ src ]){
		pubKey = sourceKeys.keys[ src ].pubKey;
		privKey = Buffer.from(sourceKeys.keys[ src ].privKey, 'hex');
	}
	
	
	/*
	else
	if (src.indexOf('cryptoFacilities') == 0){
		let pubKey = sourceKeys.keys[ 'cryptoFacilities' ].pubKey;
		let privKey = Buffer.from(sourceKeys.keys[ 'cryptoFacilities' ].privKey, 'hex');
	}
	*/
	if (!pubKey || !privKey) return;
	
	dataFeed[ src ].updated = rate.ts;
	dataFeed[ src ].lastHash = hash;
	
	//lets sign this 
	let sign = secp256k1.sign(hash, privKey).signature.toString('hex');
	
	//@todo: add sing from Node? Protocol?
//console.log( JSON.stringify(rate) );
	
	if (dataFeed[ src ].rate)
		console.log('[' + rate.symbol + '] New val: ' + rate.price + ', old: ' + dataFeed[ src ].rate.price);
	
	if (rate && rate.price && pubKey && sign && rate.excode && rate.id){
		
		dataFeed[ src ].rate = rate;
		
		events.emit('sendTx', hash.toString('hex'), pubKey, sign, rate);
	}	
});

events.on('sendTx', function(hash, pubKey, sign, rate){
	//code:hash:sign:pubkey:flags:data
	
	let tx = 'ind:' + hash + ':' + sign + ':' + pubKey + '::' + Buffer.from( JSON.stringify( rate ), 'utf8').toString('base64');
	let rpc = http;
	
	if (rpcHost != 'localhost'){
		rpc = https;
	}
	
	rpc.request({
			host: rpcHost, //'rpc.testnet.indexprotocol.online',
			port: 443,
			path: '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(),
			timeout: 15000
		}, function(req){
			
			if (req){
				req.setEncoding('utf8');
				let  rawData = '';
				
				req.on('data', (chunk) => { rawData += chunk; });
				
				req.on('end', () => {
					
					try {
						const parsedData = JSON.parse(rawData);
						
						if (parsedData && parsedData.result && parsedData.result.code == 0){
							console.log('tx: ' + parsedData.result.hash);
						}
						else
						if (parsedData.error.code != -32603)
						{
							console.log('\n');
							console.debug(parsedData);
							console.log('\n');
							
							throw new Error('Something gone wrong with send tx');
						}			
						
					} catch (e) {
					  console.error('ERROR: ', e);
					}
				  });
				
			}
		}).on('error', (e) => {
		  console.error(`problem with request: ${e.message}`);
		}).end();
	
});


/**
console.log('Starting feed...');

_.each(dataFeed, function(v, source){
	if (v.enabled != true) return; 
	
	//create timer for each 
	dataFeed[ source ]._timer = setInterval(function(src){
		events.emit('fetchData:' + src, src);
	}, v.interval * 1000, source);
});
**/

// Here we send the ready signal to PM2
if (process.send)
	process.send('ready');

console.log('');