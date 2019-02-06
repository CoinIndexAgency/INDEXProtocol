//let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');
let secp256k1		= require('secp256k1');
let stringify 		= require('fast-json-stable-stringify');
let http			= require('http');
let _				= require('underscore');

console.log("\n");
console.log('INDEXProtocol testnet cli tools');
//console.log('WARNING: used default TEST private key!');
console.log("\n");
/***
//default private key
let privKey = Buffer.from('178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33', 'hex');

console.log("Private key: " + privKey.toString('hex'));

const 	ecdh = crypto.createECDH('secp256k1');

		ecdh.setPrivateKey( privKey );

let pubKey = ecdh.getPublicKey('hex');


//let pubKey = secp256k1.publicKeyCreate(privKey, false);

console.log("Public key: " + pubKey.toString('hex'));

let address = '';

let sha256 = crypto.createHash('sha256');
let ripemd160 = crypto.createHash('ripemd160');

let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

	address = bs58.encode( hash );
	
	console.log('\n');
	console.log( 'Address (base58 encoded): ' + address );
	console.log('\n');
*/	
	
	let dataSources = {
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
		'leoxchange' : {
			name: 'LEOxChange',
			site: 'https://leoxchange.com',
			country: 'UNK',
			api: 'https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=100'
		},
		'cobinhood' : {
			name: 'Cobinhood',
			site: 'https://cobinhood.com',
			country: 'UNK',
			api: 'https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50'
		}
	};
	
	console.log('1. Create Pub/Priv key for all of data sources');
	
	_.each(dataSources, function(d, key){
		console.log('Generate key for: ' + d.name);
		
		let 	ecdh 	= 	crypto.createECDH('secp256k1');
				ecdh.generateKeys();
		
		let privKey = ecdh.getPrivateKey();
		let pubKey = ecdh.getPublicKey();
		
		
		dataSources[ key ].privKey = privKey.toString('hex');
		dataSources[ key ].pubKey = pubKey.toString('hex');
		
		console.log('\n');
		
	});
	
	console.log('\n\n');
	console.log( JSON.stringify( dataSources ) );
	console.log('\n\n');
	
	process.exit();
	
	
	
	
	console.log('Step 1: create account transaction (mnemonic code: CAT)');
	
	var data = {
		exec: 'tbl.accounts.create',	//ns of actions
		addr: null,
		pubk: null, //pubKey.toString('hex'),
		name: 'raiden@indexprotocol.network',
		type: 'user', //index, provider, issuer, exchange, fund... any type
		sign: ''		
	};
	
	
	if (!process.argv[2])
		process.exit();
	
	
		data.name = process.argv[2];
		
		//пересоздать адрес 
		const 	ecdh 	= 	crypto.createECDH('secp256k1');
				ecdh.generateKeys();
		
		let privKey = ecdh.getPrivateKey();
		
//console.debug( privKey );
		
			//ecdh.setPrivateKey( privKey );

		let pubKey = ecdh.getPublicKey();
		
//console.debug( pubKey );
		
		let address = '';

		let sha256 = crypto.createHash('sha256');
		let ripemd160 = crypto.createHash('ripemd160');
		let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

			address = bs58.encode( hash );
			
		data.addr = address;
		data.pubk = pubKey.toString('hex');
		
		
		console.log('===========================');
		console.log('Generate new account:');
		console.log('name: ' + data.name);
		console.log('privateKey: ' + privKey.toString('hex'));
		console.log('publicKey:  ' + pubKey.toString('hex'));
		console.log('wallet address: ' + address);
		console.log('\n');
	
	
	//sign in by private key 
		sha256 = crypto.createHash('sha256');
	let dx = Buffer.from( stringify( data ), 'utf8');
	let dxHash = sha256.update( dx ).digest();
	
	
	//console.debug( crypto.getCurves() );
	//console.log('\n');
	//console.debug( crypto.getHashes() );
	
	
	const sigObj = secp256k1.sign(dxHash, privKey);
	let sign = sigObj.signature.toString('hex');
	
	//console.log( sign );
	
	//let sign = crypto.createSign('RSA-SHA256'); //sha256');  ecdsa-with-SHA256
	//	sign.update( dxHash.toString('hex'), 'hex' ); //.end();
		
		
	//console.log( privKey );
		
	//let res = sign.sign( privKey.toString('latin1'), 'latin1');
	let res = secp256k1.verify(dxHash, sigObj.signature, pubKey);
	
	console.log('  Data: ');
	console.log( data );
	console.log('Hash: ' + dxHash.toString('hex') );
	console.log('Sign: ' + sign);
	console.log(' Verify sign result: ' + res );
	console.log('\n\n');
	
	if (res == true){
		//add tx to chain 
		data.sign = sign;
				
		let tx = 'reg:' + Buffer.from( stringify( data ), 'utf8').toString('base64');
		let url = 'http://localhost:8080/broadcast_tx_commit?tx="' + tx + '"&_=' + new Date().getTime();
		
		console.log( url );
		
//process.exit();
		
		http.request({
			host: 'localhost', //'rpc.testnet.indexprotocol.online',
			port: 8080,
			path: '/broadcast_tx_commit?tx="' + tx + '"&_=' + new Date().getTime(),
			timeout: 15000
		}, function(req){
			
			if (req){
				req.setEncoding('utf8');
				var  rawData = '';
				
				req.on('data', (chunk) => { rawData += chunk; });
				
				req.on('end', () => {
					
					try {
					  const parsedData = JSON.parse(rawData);
						
						console.log('\n');
						console.debug(parsedData);
						console.log('\n');
						
					} catch (e) {
					  console.error(e.message);
					}
				  });
				
			}
		}).on('error', (e) => {
		  console.error(`problem with request: ${e.message}`);
		}).end();
				
	}
	
	/*
	console.log('Step 2: register new coin (mnemonic code: RNA :: RegisterNewAsset)');
	
	console.log('Step 3: emission (initial) of registered coin (mnemonic code: CGE :: CoinGenerationEvent)');
	
	
	console.log('Step 4: create another account transaction (mnemonic code: CAT)');
	
	
	console.log('Step 5: Transfer coin from acc 1 to acc 2 (mnemonic code: CTE :: CoinTransferEvent)');
	*/
//=======================
/*	
	
Private key: 178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33
Public key: 04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179



Address (base58 encoded): MCPqykgZUJPb72vC9kgPRC6vvZm
Real hash of pubkey: 18fe93bfc9f4dfea3d9f55f941b7d1a060f6c358
	
	
	

//=======================
const ecdh = crypto.createECDH('secp256k1');
//let keyPair =  ecdh.generateKeys();

//console.debug( keyPair.toString('hex') );

//console.debug( ecdh );

ecdh.setPrivateKey( privKey );

let pubk = ecdh.getPublicKey('hex');

console.log( pubk );
*/

