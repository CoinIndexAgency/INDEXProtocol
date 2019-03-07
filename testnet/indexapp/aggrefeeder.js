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
global.fetch 		= require('node-fetch');

const events		= new EventEmitter();
const fixedExponent = 1000000;
const rpcHost		= 'rpc.testnet.indexprotocol.online';

const coinGecko			= require('coingecko-api');
const coinMarketCap		= require('coinmarketcap-api');
const bitcoinAverage 	= require('bitcoinaverage');
const worldCoinIndex 	= require('worldcoinindex-api');

const dataConn = {
	coinMarketCap 	: null,
	cryptoCompare 	: require('cryptocompare'),
	coinGecko		: new coinGecko(),
	bitcoinAverage 	: null,
	coinDesc		: require('node-coindesk-api'),
	worldCoinIndex	: null,
	bitcoinCharts 	: fetch, //use own code
	cryptonator		: fetch,//require('cryptonator'),
	cryptoFacilities: fetch
};

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

/*

const coinLib			= require('coinlib-api');
const coinRanking 		= require('coinranking-api');
const coinPaprika 		= require('coinpaprika-js');
const coinBasePro   	= require('coinbase-pro-feed'); //WS realtime module

*/

//add Nomics
//add Brave New coin spot and liqudity index
//add zloadr
//add nexchange
//add messari if available(https://messari.io/api/docs)
//add CME & cryptofacilities
//add localbitcoins if possible
//add CoinApi.io free (15 min) - whats data from??
//add DataLight (data from coinmarkedcap

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
	
	cryptoFacilities : {
		"enabled"	: 	true,
		"interval"	:	3, //15 min
		
		"nonce"		: 	0, //counter of query 
		"updated"	: 	0, //UTC of last succsessful responce
		"loaded"	: 	0, //UTC loading data (local)
		"_raw"		: 	'',
		"lastHash"	: '',
		"rate"		: 	null //latest rate, object
	},
	
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

//init...
dataConn.coinMarketCap = new coinMarketCap( dataFeed.coinMarketCap.apikey );

dataConn.cryptoCompare.setApiKey( dataFeed.cryptoCompare.apikey );

//@todo: use WebSocket in the future
dataConn.bitcoinAverage = bitcoinAverage.restfulClient(dataFeed.bitcoinAverage.apikey, dataFeed.bitcoinAverage.secret);

dataConn.worldCoinIndex = new worldCoinIndex(dataFeed.worldCoinIndex.apikey); 


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
				if ((v.symbol === 'in_xbtusd') || (v.symbol === 'rr_xbtusd')){
					let rate = getRateTpl();
						rate.id 		= dataFeed[ src ].nonce;
						rate.ts			= new Date( v.lastTime ).getTime();
						rate.excode		= src.toLowerCase();
				
					if (v.symbol == 'in_xbtusd'){
						rate.symbol		= 'CME CF Real-Time Indices';
					}
					else
					if (v.symbol == 'rr_xbtusd'){
						rate.symbol		= 'CME CF Reference Rates';
						rate.id++;
					}
					
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
	
	//hash this 
	let hash = sha256( JSON.stringify( rate ) );
	
	//prevent double sending
	if (dataFeed[ src ].lastHash == hash) return;
	
	if (dataFeed[ src ].price === rate.price && dataFeed[ src ].ts === rate.ts) return;
	
	dataFeed[ src ].updated = rate.ts;
	dataFeed[ src ].lastHash = hash;
	
	//add pubKey 
	let pubKey = sourceKeys.keys[ src ].pubKey;
	
	if (!pubKey) return;
	
	let privKey = Buffer.from(sourceKeys.keys[ src ].privKey, 'hex');
	
	//lets sign this 
	let sign = secp256k1.sign(hash, privKey).signature.toString('hex');
	
	//@todo: add sing from Node? Protocol?
	//console.log( JSON.stringify(rate) );
	
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


console.log('Starting feed...');

_.each(dataFeed, function(v, source){
	if (v.enabled != true) return; 
	
	//create timer for each 
	dataFeed[ source ]._timer = setInterval(function(src){
		events.emit('fetchData:' + src, src);
	}, v.interval * 1000, source);
});


// Here we send the ready signal to PM2
if (process.send)
	process.send('ready');

console.log('');