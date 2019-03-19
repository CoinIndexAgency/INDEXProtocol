/** Processor for abci-query **/

const _				= require('underscore');
const crypto 		= require('crypto');
const async 		= require('async');
const secp256k1		= require('secp256k1');
const fetch			= require('node-fetch');
const http			= require('http');
const https			= require('https');
const prettyHrtime 	= require('pretty-hrtime');

/*

const fs			= require('fs');
const emitter		= require('events');
const events 		= new emitter();

const rocksdown 	= require('rocksdb');


const bs58			= require('bs58');
const stringify 	= require('fast-json-stable-stringify');
const moment		= require('moment');

*/


exports.FeedTrades = {
	_timer		: null,
	_ip			: null,
	totalNewQuotes	: 0,
	sourceKeys	: null,
	
	maxTimeDiff : 15 * 60 * 1000,
	maxIdsAtCache : 10 * 1000, //per exchange, per assets
	fixedExponent : 1000000,
	
	startFeeder	: function( indexProtocol, sourceKeys ){
		this._ip = indexProtocol;
		this.sourceKeys = sourceKeys;
		
		this.fetchAll();
	},
	
	sha256: function(data) {
	  return crypto.createHash('sha256').update(data, 'utf8').digest();
	},
	
	source: {
		'CEX.io' 	:	'https://cex.io/api/trade_history/BTC/USD/',
		'BTC-Alpha' :	'https://btc-alpha.com/api/v1/exchanges/?format=json&limit=100&pair=BTC_USD',
		'Bitfinex' 	:	'https://api.bitfinex.com/v1/trades/btcusd?limit_trades=250',
		'Liquid'	: 	'https://api.liquid.com/executions?product_id=1&limit=100&page=1', 
		'GDAX'		:	'https://api.gdax.com/products/BTC-USD/trades?limit=100',	
		'HitBTC'	:	'https://api.hitbtc.com/api/2/public/trades/BTCUSD?limit=250',
		'Bitstamp'	:	'https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour',
		'Gemini'	:	'https://api.gemini.com/v1/trades/btcusd?limit_trades=200&include_breaks=0',
		'LakeBTC'	:	'https://api.lakebtc.com/api_v2/bctrades?symbol=btcusd',
		'Exmo'		:	'https://api.exmo.com/v1/trades/?pair=BTC_USD',
		'CoinsBank'	:	'https://coinsbank.com/api/bitcoincharts/trades/BTCUSD',
		'BitBay'	:	'https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc',
		'Livecoin'	:	'https://api.livecoin.net/exchange/last_trades?currencyPair=BTC/USD&minutesOrHour=false',
		'itBit'		:	'https://api.itbit.com/v1/markets/XBTUSD/trades',
		'OkCoin'	:	'https://www.okcoin.com/api/v1/trades.do?symbol=btc_usd',
		'IndependentReserve'	:	'https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50',
		'DSX'		:	'https://dsx.uk/mapi/trades/btcusd',
		'Gatecoin'	:	'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=50',
		'WavesDEX'	:	'https://marketdata.wavesplatform.com/api/trades/BTC/USD/50',
		'Bitsane'	:	'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=50',
		'Bitlish'	:	'https://bitlish.com/api/v1/trades_history?pair_id=btcusd',
		'Bisq'		:	'https://markets.bisq.network/api/trades?market=btc_usd&limit=50&format=json&sort=desc',
		'Coingi'	:	'https://api.coingi.com/current/transactions/btc-usd/50',
		'CoinbasePro'	:	'https://api.pro.coinbase.com/products/BTC-USD/trades',
		'RightBTC'	:	'https://www.rightbtc.com/api/public/trades/BTCUSD/50',
		'Kraken'	:   'https://api.kraken.com/0/public/Trades?pair=xbtusd' 	
	},
	fetchAll: function(){
		
		let _sources = {};
		let fetchAtOnce = 4;
		
		let a = _.allKeys( this.source ); //.keys();
		let b = _.shuffle( a ) ;
		let tmp = b.slice(0, fetchAtOnce);
		var _this = this;
		
		tmp.forEach( function(c){
			_sources[ c ] = this.source[ c ];
		}, this);
	
		console.log('Oracle loads: ' + tmp.join(', '));
					
		//console.log('Current time: ' + new Date(ts).toGMTString() );
		const t1 = process.hrtime();
		_this.totalNewQuotes = 0;
//console.dir( _this );	
		//use async.js 	
		async.eachOfLimit(
			_sources, 
			2, //fetchAtOnce, //at parralel
			function(url, src, cb){
				//console.dir( _this );
				_this.processDatafeed( url, src, cb ).bind( _this );
			},
			//this.processDatafeed, 
			function(err){
				const tf = process.hrtime( t1 );
console.dir( [tf] );
				/**
				console.log('\nTotal new trades: ' + _this.totalNewQuotes + ' (from ' + _.size(_this.source) + ' sources), processed by ' + prettyHrtime(tf));
				//console.log('\n');
				
				setTimeout(function(){
					_this.fetchAll();
				}, 5 * 1000, _this);
				**/
			}
		).bind( this );
	},
	processDatafeed: function(url, src, cb){
//console.dir( [ url, src, this ] );
//process.exit();		
		if (!url || !src) return;
		
		var _this = this;
		
		fetch(url, {agent: _this._ip.apiHttpsAgent, follow: 3, timeout: 5000})
			.then(function(res){
				if (res.ok)	 
					return res;
				else 
					throw Error(res.statusText);
			})
			.then(res => res.json())
			.then(function(data){
				let bodyHash = _this.sha256( JSON.stringify( data ) ).toString('hex');

				return new Promise(function(resolve, reject){
					//check latest hash 
					_this._ip.stateDb.get('tbl.datafeed.' + src.toLowerCase() + '.bodyHash', function(err, val){
						if (!err && val && Buffer.isBuffer(val)){
							val = val.toString('utf8');
							
							if (val === bodyHash){
								//console.log( src + ' - no updates from perviosly loaded body ('+val+' :: ' + bodyHash+')');
								return reject();
							}
						}
						
						_this._ip.stateDb.put('tbl.datafeed.' + src.toLowerCase() + '.bodyHash', bodyHash, function(err){
							if (!err)
								return resolve( data );
							else
								return reject(err);
						});
					});			
				});			
			})
			.then(function(data){

				let newQuotes = [];
				let ts = _this._ip.curTime;
				let maxTimeDiff = _this.maxTimeDiff;
//console.dir( _this );				
				try {			
				switch( src ){
					case 'CEX.io': {
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
								
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){
									
									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + qt;
									
									if (q.tid)	id = q.tid;
									
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}
							});
						}
						
						break;
					}
					case 'BTC-Alpha': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.id) return;
								
								let qt = new Date( Math.trunc( q.timestamp * 1000 ) ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){
									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.id)	id = q.id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Bitfinex': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.tid || q.exchange != 'bitfinex') return;
								
								let qt = new Date( q.timestamp * 1000 ).getTime();
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){
								
									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Liquid': {
						if (data && data.models.length > 0){
							data.models.forEach(function(q){
								
								if (!q || !q.created_at || !q.id) return;
								
								let qt = new Date( Math.trunc( q.created_at * 1000 ) ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.taker_side.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.taker_side.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.created_at;
									
									if (q.id)	id = q.id;
								
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'GDAX': {
						if (data && data.length > 0){
							
							data.forEach(function(q){
								
								if (!q || !q.time || !q.trade_id) return;
								
								let qt = new Date( q.time ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.side.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.side.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.time;
									
									if (q.trade_id)	id = q.trade_id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.size ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'HitBTC': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.id) return;
								
								let qt = new Date( q.timestamp ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.side.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.side.toLowerCase() == 'sell')
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.id)	id = q.id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Bitstamp': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date || !q.tid) return;
								
								let qt = new Date( q.date ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type != 1)	
										side = 'BUY';
									else
										side = 'SELL';
									
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
								
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Gemini': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestampms || !q.tid || q.exchange != 'gemini') return;
								
								let qt = new Date( q.timestampms ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.timestampms;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'LakeBTC': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date || !q.tid) return;
								
								let qt = new Date( q.date * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
																	
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
								
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Exmo': {
						if (data && data['BTC_USD'])	data = data['BTC_USD'];
		
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date || !q.trade_id || q.exchange != 'gemini') return;
								
								let qt = new Date( q.date ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.trade_id)	id = q.trade_id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side, parseFloat(q.amount));
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'CoinsBank': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date || !q.tid) return;
								
								let qt = new Date( q.date * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.direction.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.direction.toLowerCase() == 'ask')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'BitBay': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date || !q.tid) return;
								
								let qt = new Date( q.date * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'ask')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Livecoin': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.time || !q.id) return;
								
								let qt = new Date( q.time * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
																	
									let id = q.id + '-s' + q.orderSellId + '-b' + q.orderBuyId;
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'itBit': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.matchNumber) return;
								
								let qt = new Date( q.timestamp ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.matchNumber)	id = q.matchNumber;
								
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'OkCoin': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.date_ms || !q.tid) return;
								
								let qt = new Date( q.date_ms ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.date_ms;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'IndependentReserve': {
						if (data && data.Trades.length > 0){
							data.Trades.forEach(function(q){
								
								if (!q || !q.TradeTimestampUtc) return;
								
								let qt = new Date( q.TradeTimestampUtc ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
																	
									let id = src.toLowerCase() + '-' + q.TradeTimestampUtc;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.SecondaryCurrencyTradePrice ), parseFloat( q.PrimaryCurrencyAmount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'DSX': {
						if (data && data['btcusd'])	data = data['btcusd'];
		
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.trade_id) return;
								
								let qt = new Date( q.timestamp * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'ask')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Gatecoin': {
						if (!data || !data.responseStatus || data.responseStatus.message != 'OK') break;
		
						if (data && data.transactions.length > 0){
							data.transactions.forEach(function(q){
								
								if (!q || !q.transactionTime || !q.way || !q.transactionId || q.currencyPair != 'BTCUSD') return;
															
								let qt = new Date( q.transactionTime * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){
									let side = '';
									
									if (q.way.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.way.toLowerCase() == 'ask')
										side = 'SELL';
																	
									let id = q.transactionId + '-s' + q.askOrderId + '-b' + q.bidOrderId;
						
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'WavesDEX': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.id || q.confirmed != true) return;
								
								let qt = new Date( q.timestamp ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.type.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.type.toLowerCase() == 'sell')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.id)	id = q.id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Bitsane': {
						if (data && data.statusCode != 0) return;
					
						if (data && data.result.length > 0){
							data.result.forEach(function(q){
								
								if (!q || !q.timestamp || !q.tid) return;
								
								let qt = new Date( q.timestamp * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
																									
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Bitlish': {
						if (data && data.pair_id == 'btcusd' && data.list.length > 0){
							data.list.forEach(function(q){
								
								if (!q || !q.created) return;
								
								let qt = new Date( Math.trunc(q.created / 1000) ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.dir.toLowerCase() == 'bid')	
										side = 'BUY';
									else
									if (q.dir.toLowerCase() == 'ask')
										side = 'SELL';
																	
									let id = src.toLowerCase() + '-' + q.created;
						
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Bisq': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.trade_date || !q.trade_id) return;
								
								let qt = new Date( q.trade_date ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.direction.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.direction.toLowerCase() == 'sell')
										side = 'SELL';
																									
									let id = src.toLowerCase() + '-' + q.trade_date;
									
									if (q.trade_id)	id = q.trade_id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side, parseFloat( q.volume ));
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Coingi': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.timestamp || !q.id) return;
								if (q.currencyPair.base != 'btc' && q.currencyPair.counter != 'usd') return;
								
								let qt = new Date( q.timestamp ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
																																	
									let id = src.toLowerCase() + '-' + q.timestamp;
									
									if (q.id)	id = q.id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'CoinbasePro': {
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (!q || !q.time || !q.trade_id) return;
								
								let qt = new Date( q.time ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.side.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.side.toLowerCase() == 'sell')
										side = 'SELL';
																									
									let id = src.toLowerCase() + '-' + q.time;
									
									if (q.trade_id)	id = q.trade_id;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.size ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'RightBTC': {
						if (data && data.status.success != 1) return;
						
						if (data && data.result.length > 0){
							data.result.forEach(function(q){
								
								if (!q || !q.date || !q.tid) return;
								
								let qt = new Date( q.date ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q.side.toLowerCase() == 'buy')	
										side = 'BUY';
									else
									if (q.side.toLowerCase() == 'sell')
										side = 'SELL';
																									
									let id = src.toLowerCase() + '-' + q.date;
									
									if (q.tid)	id = q.tid;
							
									let z = _this.makeQuote(id, qt, parseFloat( q.price/100000000 ), parseFloat( q.amount/100000000 ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					case 'Kraken': {
						if (data && data.error.length > 0) return;
						
						if (data && data.result && data.result['XXBTZUSD'])	data = data.result['XXBTZUSD'];
						
						if (data && data.length > 0){
							data.forEach(function(q){
								
								if (q.length != 6) return;
								
								let qt = new Date( q[2] * 1000 ).getTime();
									
								let diff = ts - qt;
																
								if (qt && diff > 0 && diff <= maxTimeDiff ){

									let side = '';
									
									if (q[3] == 'b')	
										side = 'BUY';
									else
									if (q[3] == 's')
										side = 'SELL';
																									
									let id = src.toLowerCase() + '-' + q[2];
						
									let z = _this.makeQuote(id, qt, parseFloat( q[0] ), parseFloat( q[1] ), side);
									
									if (z) newQuotes.push( z );
								}							
							});
						}
						
						break;
					}
					
					default: {
						console.log('Unknown source, please update code!');
						
						return [];
					}
				}
				
				}catch(e){
					if (e instanceof SyntaxError){
						console.dir(src + ' - JSON parsing error: ' + e.message, {colors:true});
						
						return [];
					}
					else {
						console.dir(src + ' - Unknown parsing error: ' + e.message, {colors:true});
						
						return [];					
					}					
				}
				
				//console.log( src + ' - prepared ' + newQuotes.length + ' quotes to post-process');
				
				if (newQuotes.length == 0) return [];
				
				return new Promise(function(resolve, reject){
					_this._ip.stateDb.get('tbl.datafeed.' + src.toLowerCase() + '.cachedIds', function(err, val){
						if (!err && val && Buffer.isBuffer(val)){
							val = val.toString('utf8');
													
							if (!val)	
								val = [];
							else
								val = JSON.parse( val );
						}
						else
							val = [];
						
						//console.log( src + ' - Cached ids: ' + val.length );
						
						let realNewQuotes = [];
						
						newQuotes.forEach(function(nq){
							if (nq.id && val.indexOf( nq.id ) === -1){
								realNewQuotes.push( nq );
								
								val.unshift( nq.id );
							}
						});
						
						//check cache size 
						if (val.length > _this.maxIdsAtCache)
							val = val.slice(0, _this.maxIdsAtCache);
						
						//console.log( src + ' - new cache ids: ' + val.length );
						//console.log( src + ' - real new quotes: ' + realNewQuotes.length );
						
						return resolve( [realNewQuotes, val] );					
										
					});
				});
				
			})
			.then(function(resq){
				if (!resq) return;
				
				let resultQuotes = resq[0];				
				
				if (resultQuotes && resultQuotes.length != 0){
				
					console.log( src + ' :: parsed, ' + resultQuotes.length + ' new trades, at cache: ' + resq[1].length);
					
					_this.totalNewQuotes += resultQuotes.length;
					
					let sourceKey = _this.sourceKeys.keys[ src.toLowerCase() ];
					
					if (!sourceKey){
						console.log( src + ' - WARNING. No keys for Data Provider');
						return;
					}
					//add signatures = from source and node 
					resultQuotes.forEach(function(rate){
						console.log('\n\nSign trade for ' + src );
//console.dir( this );						
						this.signTrade(rate, src, sourceKey.privKey, sourceKey.pubKey, this._ip.node.privKey, this._ip.node.pubKey, this);
						
					}, _this);
					
					return new Promise(function(resolve, reject){
//console.dir( _this );
						_this._ip.stateDb.put('tbl.datafeed.' + src.toLowerCase() + '.cachedIds', JSON.stringify(resq[1]), function(err){	
							if (err) throw new Error( err );
							
							return resolve();
						}); 
					});
					
				}		
			}).catch(function(e){
				if (e){
					console.dir('Error ('+src+'): ' + e.message, {colors:true}); 
					
					//console.dir( e );
					/*
					if (e instanceof FetchError){
						console.error('FetchError ('+src+'): ' + e.message); 
					}
					else
					*/
				}	
			}).finally(function(){
				//console.log( src + ' - finally processing.');
				
				if (cb && _.isFunction(cb))
					cb();
			});
	},
		
	makeQuote: function(id, ts, price, amount, side, total){
		let tot = Math.trunc( price * amount * this.fixedExponent );
		if (total)	tot = Math.trunc( total * this.fixedExponent );

	//	console.log( ts + ' :: ' + new Date( ts ).toUTCString() );
		
		return {
			id		: new String(id).toLowerCase().trim().toString(),
			ts 		: ts,
			symbol 	: 'BTC/USD',
			asset	: 'BTC',
			cur		: 'USD',
			type	: 'FX/Spot',
			side	: side,
			price	: Math.trunc( price * this.fixedExponent ),
			amount	: Math.trunc( amount * this.fixedExponent ),
			total	: tot
			//_dtx	: new Date(ts).toUTCString()
		};	
	},

	signTrade: function(rate, src, sourcePrivKey, sourcePubKey, nodePrivKey, nodePubKey, _this){
//console.dir( [rate, src, sourcePrivKey, sourcePubKey, nodePrivKey, nodePubKey, _this] ); 		
		
		if (!sourcePrivKey || !sourcePubKey || !nodePrivKey || !nodePubKey) return;
			
		//hash this 
		let hash = _this.sha256( JSON.stringify( rate ) );
		let source = src.toLowerCase();

		//lets sign this 
		let sourceSign = secp256k1.sign(hash, Buffer.from(sourcePrivKey, 'hex')).signature.toString('hex');
		
		let obj = {
			sign		:	sourceSign,
			//pubKey 		:	sourcePubKey,
			provider 	:	source,
			//hash		:   hash.toString('hex'),
			
			data		:	rate
		}
		
		//Sign this by node key
		let hash2 = _this.sha256( JSON.stringify( obj ) );
		let nodeSign = secp256k1.sign(hash2, Buffer.from(nodePrivKey, 'hex')).signature.toString('hex');
		
		//<code>:<version:1>:<ApplyFromTs:0>:<ApplyOnlyAfterHeight:0>:<Hash(Sha256)>:<CounOfSign:1>:<Signature:S1>:<PubKey(Compres)>:<Data/Base64>
		let tx = 'data.src.trades:1:0:0:' + hash2.toString('hex') + ':1:' + nodeSign + ':' + nodePubKey + ':' + Buffer.from( JSON.stringify( obj ), 'utf8').toString('base64');
		
		//console.log('\n' + tx + '\n');
		//let _this = this;
		process.nextTick( _this.sendDataSrcTradesTx, tx, _this );
	},

	sendDataSrcTradesTx: function( tx, _this ){
		let agent = _this._ip.apiHttpAgent;
		let url = 'http://localhost:8080/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime();
//console.dir( [url, agent, _this._ip.node.rpcHealth] );		
		/*
		if (indexProtocol.node.rpcHost != 'localhost'){
			agent = indexProtocol.apiHttpsAgent;
			url = 'https://rpc.testnet.indexprotocol.online/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime();
		} */

		if (_this._ip.node.rpcHealth === false) return;
		
		fetch(url, {agent: agent})
			.then(function(res){
				if (res.ok)	 
					return res;
				else 
					throw Error(res.statusText);
			})
			.then(res => res.json())
			.then(function(data){
				//do anything with obtained tx hash
			})
			.catch(function(e){
				if (e){
					console.dir('Error at RPC call broadcast_tx: ' + e.message, {colors:true}); 
				}	
			}).finally(function(){

			});
	}
		
};