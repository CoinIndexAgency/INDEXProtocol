//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const crypto 		= require('crypto');
//const { spawn } 	= require('child_process');
const fs			= require('fs');
let _				= require('underscore');
var emitter			= require('events');
const events 		= new emitter();
var prettyHrtime 	= require('pretty-hrtime');
var rocksdown 		= require('rocksdb');
var async 			= require('async');
const secp256k1		= require('secp256k1');
let bs58			= require('bs58');
let stringify 		= require('fast-json-stable-stringify');
let moment			= require('moment');

const MerkleTree 	= require('merkletreejs');

// returns Buffer
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
}

function sha512(data) {
  return crypto.createHash('sha512').update(data, 'utf8').digest();
}


process.on('uncaughtException', (err) => {
  console.log('\n     *** ERROR ***   \n ' + err);
  
  if (stateDb && stateDb.status == 'open')	stateDb.close(function(){});
  
  console.log('\n');  
  
  process.exit(0);
});

process.on('exit', (code) => {
	if (code > 0){
		console.log('App exit with code: ' + code);
		
		if (stateDb && stateDb.status == 'open')	stateDb.close(function(){});

		console.log('\n');
	}
});

//test private key for system account
const godKey = '178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33';
const storeLatestBlocks = 300; //how many blocks decoded and stored
const fixedExponent = 1000000;

const stateDbPath 	= '/opt/tendermint/app/db/state.db'; //stateDb

	if (process.argv.indexOf('cleandb') != -1){
		console.log('\n     *** WARNING ***     \n');
		console.log('Destroy ALL data from application db. All data will be losted!');
		console.log('Clearing app state...');
			
		let dir = fs.readdirSync( stateDbPath );
		
		_.each(dir, function(f){
			console.log('remove file: ' + f + '... ok');
			
			fs.unlinkSync( stateDbPath + '/' + f);			
		});
		
		fs.rmdirSync( stateDbPath );
						
		console.log('All app DB cleared and removed... OK\n\n');
	}
	
	//reverto <nubblock>
	if (process.argv.indexOf('reverto') != -1){
		let revTo = parseInt( process.argv[ (process.argv.indexOf('reverto')+1)] ); 
		
		if (revTo){
			console.log( 'WARN:  Manual revert appState to height: ' + revTo);
			
			//delete all from curent height up to revTo
			
			
		}		
	}
	

const stateDb 	= rocksdown( stateDbPath );

//options for RocksDB
const rocksOpt = {
	createIfMissing: true,
	errorIfExists: false,
	compression: true,
	
	target_file_size_base: 4 * 1024 * 1024
};

	stateDb.open(rocksOpt, function(err){
		if (!err){
			//waiting for status
			var t = setInterval(function() {
				if (stateDb.status != 'open') return;
				
				console.log('stateDb opened and ready');
				clearInterval( t );								
				
				//OK, all DB ready to work
				events.emit('dbReady');
			
			}, 100);
		}
		else {
			console.log('stateDb opening error: ' + err);
			process.exit(0);
		}
	});
	
let currentBlockStore = []; //current unconfirmed block tx

/**
//temporary queue to avg confirmation
let consensusConfirmation = {
	queue: [],
	state: {} //hash-map height: proof
} **/

//test version of lib
let indexProtocol = {
	curTime: new Date().getTime(), //global time, updated every new block (at begin block)
	getDefaultState: function(){
		return {
			'version'		: 'indx-testnet-01',
			'appVersion'	: '1',	//for testnet app only!
			'appHash'		: '', 	//current AppHash (sha-256)
//TEST			
			'blockHeight'	: 0,	//current height  
			'blockHash'		: '',
			'blockStore' 	: [],  //filled by transactions (by 900 block)
			'blockTime'		: 0, //current block time
			
			'previousAppHash' : '',
			'latestAvg'		: null,	//latest avg data	
			
			//some of settings overall all chain
			'options'		: {
				//'blockBeforeConfirmation' 	: 10, //how blocks we need to wait before
				
				'nativeSymbol'				: 'IDXT',  //tiker for native coin at this network
				'initialNativeCoinBalance'	: 1000,
				'defaultSystemAccount'		: 'testnet@indexprotocol.network',
				
				//full reward = rewardPerBlock + (rewardPerDataTx * DataTxCount) + SUMM(TxFee)
				'rewardPerBlock'				: 1000, //reward to Validator for block (base value, for any tx at block)
				'rewardPerDataTx'				: 10
			},
			
			dataSource: {"hitbtc":{"name":"HitBTC","site":"https://hitbtc.com","country":"UNK","api":"https://api.hitbtc.com/api/2/public/trades/BTCUSD?limit=250","privKey":"eac107a8bbaad26efb2d45a03c3d279f80d79812198b37386e1cd65d788d7378","pubKey":"04fdd3b639f5423d7d65b1a2dcf8fc23588c4d353912945c651db64002ab9cbbb1a419a19ad8d9d9ff02793f64378d5e9b3128441b483a7b23012b077ac55c6eb0"},"rightbtc":{"name":"RightBTC","site":"https://www.rightbtc.com","country":"UNK","api":"https://www.rightbtc.com/api/public/trades/BTCUSD/100","privKey":"5837c66e137ce3e8ffb766a0355b1ce9c68500b96e173007fef6aa7a1e82de54","pubKey":"0499060b6ea451df57e0c05923b242851bf5aaf648c3182dd7e98a3357113b399d32d2c3a0e3958de048a87b68e5b7f3f26e0babd75ccb28a06529638d68f87da8"},"gemini":{"name":"Gemini","site":"https://gemini.com","country":"UNK","api":"https://api.gemini.com/v1/trades/btcusd?limit_trades=250&include_breaks=0","privKey":"05be54b552393487bc9497db4607ca737749a7fb61a43a1130e4ea12243b07d2","pubKey":"04fc27a9a88134f7c667c3d08b0e2b0f81205d1fc6e49ef86095efd88a47b8601e482ce5df9b7ea4e810a9e2e3d49aaaead638061056d701c337c727f45849a87e"},"okcoin/intl":{"name":"OkCoin/Inter","site":"https://www.okcoin.com","country":"UNK","api":"https://www.okcoin.com/api/v1/trades.do?symbol=btc_usd","privKey":"e1b6c3bad570cd7e9de4c83c4dbf5bc165c77e60afc83c03e38e11f067c6843a","pubKey":"041534535d984ce485be38c66d18a16a928553bce2dc42b80ad028023369f0d54fd99edcd9d4114c0665a04cf700cbb11dc2798a4df370a1870b1090edc81626fd"},"dsx":{"name":"DSX","site":"https://dsx.uk","country":"UNK","api":"https://dsx.uk/mapi/trades/btcusd","privKey":"773cfba8eb6a95b8751d0f3430b25e63816fe0a504553b573e6d4f33840e5d2b","pubKey":"049d06fedec3f0a90dda769cb7ca95dfe1bca3f9c740f9d446b464ee5b8be28af91aea5c5bddd89c25305cc470c36bb9a2ee9bd6410d1cda7ef3cbb4b982df6376"},"coinbasepro":{"name":"CoinBase Pro","site":"https://pro.coinbase.com","country":"UNK","api":"https://api.pro.coinbase.com/products/BTC-USD/trades","privKey":"ac05c0c32f936e7f7019eb6df4d0cff99cd00fb743c83eada66df3072a47278f","pubKey":"04bee36e23366681ec000d2407403db01879e570a5d1be6a5a966bce2ea90c679450b90518ce1019fb0daa2d89ce5121c50a6972c487f5dd3b3822d855b559ebbd"},"lakebtc":{"name":"LakeBTC","site":"https://lakebtc.com","country":"UNK","api":"https://api.lakebtc.com/api_v2/bctrades?symbol=btcusd","privKey":"28b6592515f074c8eb9cfd7940e6353740389e08e5a7b2e29a5d887358d00801","pubKey":"047691eab9e88e55e777498843d0224ce59b601abdb9e069bcde4a3226b22af34231f53fb717cef3ce0dbd448845d7694d1b6dfe58710708ad0848beb4a5cad2ae"},"bitstamp":{"name":"Bitstamp","site":"https://www.bitstamp.net","country":"UNK","api":"https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour","privKey":"140ff30a27ee81a4f6bde633c650a709f5b8246a84c5ca85939945e6e9d47813","pubKey":"047205bf8acecf829759549993bda208e0c5ad00e3288c0099d27b13211deb69de12cef0eb31a7d1c100884bb552d6780764a189c54d82af957c88f0a727bcb8f9"},"exmo":{"name":"EXMO","site":"https://exmo.com","country":"UNK","api":"https://api.exmo.com/v1/trades/?pair=BTC_USD","privKey":"777d774cae0684e6d4f0f488b85a8f779763a773794edf61297b9df458dc80d3","pubKey":"044568be0b9adff04f52ead6caa8199a508203a8b4dac52231d8d94b7d9e3b4ec39265e6654d90c8df1efd6b5ebea0747e0938578b46feb33cf4922c63d4c05246"},"bitfinex":{"name":"Bitfinex","site":"https://bitfinex.com","country":"UNK","api":"https://api.bitfinex.com/v1/trades/btcusd?limit_trades=250","privKey":"d931d3f187c7d5aa6aee49bf24df6893072cd0015fe66dab155d8ae8a86bcce0","pubKey":"048634ff922dc9ae13b46e84252d3f9255024da50a470d9cee0125dd1b5d7b742385c455740e774a582467c46c28ddb48c9bf49006081195d3ee7f57ac5639db07"},"cex.io":{"name":"CEX.IO","site":"https://cex.io","country":"UNK","api":"https://cex.io/api/trade_history/BTC/USD/","privKey":"2756a8fc2612e010f9aedd6f050e3f50e0090b39d0dc21ec4a891caef28bfc17","pubKey":"045a7975748c689df109d819917197246e2969464103d52c8614537d3d9a9de94e6c778f6109e41dd8e7cffb26bc7c83d70556787f810632f81b5ab1f5c66b65f6"},"livecoin":{"name":"Livecoin","site":"https://livecoin.net","country":"UNK","api":"https://api.livecoin.net/exchange/last_trades?currencyPair=BTC/USD&minutesOrHour=false","privKey":"04b69adcc9aafc473714cf76b247da3c4026c51d4916f69c58f0929943875709","pubKey":"04c0bcae3db285ce46b2f94eb237473d11e746c97736f336acbdbe858a8227098b168116965889e2388cce166fe26bdb3ef4fa4133c3844040798da0d194c17aeb"},"btc-alpha":{"name":"BTC-Alpha","site":"https://btc-alpha.com","country":"UNK","api":"https://btc-alpha.com/api/v1/exchanges/?format=json&limit=250&pair=BTC_USD","privKey":"8578d12df11eb9d8178abbcacb33d6bacd994a82197bbd9e5abf0d6d8c108d1f","pubKey":"04cc35e9a557143e3e70b2b97a32ab243d70e68022a1853f998ede45cc8d97e4bf68ffd525d352b74922f4b910130d9ceda528c6cb8fe801279ce97e26d3168d31"},"coinsbank":{"name":"CoinsBank","site":"https://coinsbank.com","country":"UNK","api":"https://coinsbank.com/api/bitcoincharts/trades/BTCUSD","privKey":"a1d673f1b65059f7b22244bf511a295d1648b54a38b908f19149ee1a01ccfa1d","pubKey":"042458c9bbeccdda29719d23d2d397059f8b90952f2993132680dc590c1d17674acc709cca66659d025ab719d5b2320f5cc3b05036e2621fdf6770d5ab23340a8b"},"itbit":{"name":"itBit","site":"https://itbit.com","country":"UNK","api":"https://api.itbit.com/v1/markets/XBTUSD/trades","privKey":"71b29e7fadcd1c197cd321b717b785bd6ac5a22c854fe92c9b343f1e430f0f37","pubKey":"04e304927573b39db0c1167834e3a1c406266e82edee1df0064ca9f5e4d74472e8b5209c524322b67cb7916210408d5c53c9167f99c27df73f0959493822055dd2"},"quoine":{"name":"Quoine","site":"https://quoine.com","country":"UNK","api":"https://api.quoine.com/executions?product_id=1&limit=1000&page=1","privKey":"21cdbf95107e84f5720a2c77ec401a36979a289bc7a19106c0bf16462e96541e","pubKey":"047b4dadcba1ef95ef9931e56ee937d962f91391ebd6e897e82a4f0ee8194af594caa4c89ac14b196f05fa3f5d28b24eaea8155dd9375c3a896a4f987a4544333c"},"gdax":{"name":"GDAX","site":"https://gdax.com","country":"UNK","api":"https://api.gdax.com/products/BTC-USD/trades?limit=100","privKey":"86cf0edc5b64182025c22f58dbd1d0ef9ddbc186cc8334716bb3ef48e6bd7579","pubKey":"047db18684e6a0194ad15d1ce1a2a6d1575c011a04e3ec910c535c1ef0c2c9d6eb9e83d6cb57912670c8365cbd20610db2d30c263c22e3e4fa44e9960cdf669239"},"bitbay":{"name":"BitBay","site":"https://bitbay.net","country":"UNK","api":"https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc","privKey":"de6a9905fe0b29ea9602ca25144f9a428f6daa5d743ebe49e4d8bdf09ab62cac","pubKey":"04659e3200261be5ada1039c78841ea35bd7d93c97b78d162eb57d15ed3659c92eb2544e50f06d287e98a2692c1ccc790cdf7f27d4af323635c6d1dbab8645bfe3"},"quadrigacx":{"name":"QuadrigaCX","site":"https://quadrigacx.com","country":"UNK","api":"https://api.quadrigacx.com/v2/transactions?book=btc_usd&time=hour","privKey":"6170b3bd5c042003e3cc0b01631359eccb7ee652a5bf663745e62c18e35fdfff","pubKey":"045e358c649c9b8ac166dda6e4ad72bf37b3ae18dfa973e0cc3bfbd104fa2c99c123d826950b843d90b4c843fa35adb5522489e3ec408335f18273317fd552b7d0"},"independentreserve":{"name":"Independent Reserve","site":"https://independentreserve.com","country":"UNK","api":"https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50","privKey":"ce7ac86806b55b24b4d6c169a711c500650f7db9858673b77b84a8eeb2784062","pubKey":"048101154a884925e22c333cb8f50a2484efd8f3983f7478c7c9b946819863e43f6805e78d8e591594936c1ef3a54816958c1955c2e3bb00d8a0c8029e09cefeca"},"gatecoin":{"name":"Gatecoin","site":"https://gatecoin.com","country":"UNK","api":"https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=250","privKey":"97e77bb0e5089ad58427b8f8ff74966c27d3040385c1421c605aaa1c15ccaa8d","pubKey":"04317451db98968a61fb9580641d40654cb722aaeb0a0bdedc514be645ff001d92ebfe8ef6b18feddc409f507e0377ac1b0140fdfcd505aa21ae9dec95ae89449b"},"wavesdex":{"name":"Waves DEX","site":"http://wavesplatform.com","country":"UNK","api":"http://marketdata.wavesplatform.com/api/trades/BTC/USD/100","privKey":"35854e24cb8f55a2ac348776f90a3d89df6f0d5d579da53dbfc4d10e11092ef6","pubKey":"047d2b5c0393d9f28286945855b183518f437b819e0a322d9bb91e53147c71194b577d5985e81547d0973aef7f30c802cf824e8c05e46f9322d5a7dc0cb6086bfe"},"abucoins":{"name":"Abucoins","site":"https://abucoins.com","country":"UNK","api":"https://api.abucoins.com/products/BTC-USD/trades?limit=200","privKey":"f2e574e6ef13538c90cb149519df7130c36c88887272fa30c25a049ff7298a8d","pubKey":"040847419a245789191f4cb9f10f74f0818e11452e4ee6a3b21f41414b158df08607e699393a4301de721b97d433e855d5f6a957d6aa2f35a86e52b53c8f41c685"},"bitsane":{"name":"Bitsane","site":"https://bitsane.com","country":"UNK","api":"https://bitsane.com/api/public/trades?pair=BTC_USD&limit=250","privKey":"0a295e11c15f5c1fb14764d806ad3f67f5c0355c628538eabba12870a7ae4c40","pubKey":"0434128d97a985f5bea91c7a76a6cd0a21dbc519ced753a791d4111bc0388c490c3b7d67ee44cfff7eb2e8957b4d0a83afeaee0a503e1bdab8b9899c4df5d3f3ad"},"bitexla":{"name":"Bitex.la","site":"https://bitex.la","country":"UNK","api":"https://bitex.la/api-v1/rest/btc_usd/market/transactions","privKey":"0fb4f3a2681d6f8a37732e297b8faf2b421b8568452bb805ef4b248acb5b6c50","pubKey":"04de17510e7e365df490a76b82359dfca4a1c2e9e1e76ebd0c582dfeacde050bc9e5839b9c4c5bafa92d5c9d16010f40f40e567b0ccfb44455b41686f1d445a5a9"},"bitlish":{"name":"Bitlish","site":"https://bitlish.com","country":"UNK","api":"https://bitlish.com/api/v1/trades_history?pair_id=btcusd","privKey":"c17870e816c3b997f8cf2d986bc0f3e45e2ed5e2a30b31497e18645dab4b1c7c","pubKey":"04559182fdc50f715a0497aaee89b9e36b378792f53202d68337454f82d42c02ce4b2bca2f6813dfaf8f862277cbdeef7c29cbcba313bef17b453c33d211afa623"},"southxchange":{"name":"SouthXchange","site":"https://www.southxchange.com","country":"UNK","api":"https://www.southxchange.com/api/trades/BTC/USD","privKey":"caa591e09c4c92251708f387e3c8b6499099a0ba49480aa0c0508a84713cb446","pubKey":"04ba8a640c80de53b9704242323d69a0b7656b5582f82139629a63c5fa876af5b7cc5d429c1ff01c9ddce94be4744235c3d96d884a4182748d8165034ce98efed1"},"bisq":{"name":"Bisq","site":"https://bisq.network","country":"UNK","api":"https://markets.bisq.network/api/trades?market=btc_usd&limit=250&format=json&sort=desc","privKey":"99d5e2bc6ebceb314c1f81c2471ede4b606f9dcc56ba0390e70779d4e769d53b","pubKey":"04009f3b7a74a59a7f11dd1513ab0f26f2f4fac3e997c297ef8c4d4b6b6eb04b667a81dfa6f2a0a4c14f4dd98e7d50977608de090fc12d9c8e8298e3b283762f0a"},"coingi":{"name":"Coingi","site":"https://coingi.com","country":"UNK","api":"https://api.coingi.com/current/transactions/btc-usd/250","privKey":"5c5f5f60e3af2d8be9b99bcb15e203bdc4ae0b353d2f226af8900bf143356033","pubKey":"04ec9549e37befb1e77fe58681b8f3015537049fd7aa98ce2e595549bf3cf9b4b41aae27dc688600cef21f17ed87411ff70aa370bfb38561d376f4fa3f10ab9d98"},"leoxchange":{"name":"LEOxChange","site":"https://leoxchange.com","country":"UNK","api":"https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=100","privKey":"38c285cd8c0ccb6fad475602193d58009670a024a42a7081a1ac2b8fb7dfb9ae","pubKey":"04cfe68ab9a6d2f65a6e449bd7c7fa7ae423919f6071606e35d78c9bec447dd9e1760c27c187b23d5776e51a61a566d3d688e67cbf456a8c2ea14cd766a77fc572"},"cobinhood":{"name":"Cobinhood","site":"https://cobinhood.com","country":"UNK","api":"https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50","privKey":"b36a061bcf87f85d0f1fa63b75db0635d3941a6c6d36e27cfee2f92bd935852e","pubKey":"04f8243b4f016eef1a9f914e6ec0d400f746e0052924881e70de1058431565581f8cd519f866200ce2d17aa55492f9998f06a931f32498b8f13aab5d8f7be63286"}},
			
			
			'validatorStore':{}, //state of validators balances, emission of each block. Balances ONLY at nativeSymbol
			
			// !!!!!!!!!!! prototype 
			'assetStore'	:	{
				/*'IDXT': {
					registerAt: 1547054555444,
					regBlockHeight: 0,
					initial: 1000000,
					type: 'coin', //coin for native coin, token for user assets, contract - for derivative contracts
					divide: 10,
					maxSupply: 10000000000,
					emission: 25, //emission per block
					owner: '28kCp5BWu2f1qsB582EkmkeJisHa', //address of emitent
										
					tx: []
				}*/
			}, //symbols registry DB
			
			//simple accounts store
			//address: sha256 hash of full account obj
			// full obj stores at tbl.accounts and tbl.system.namelookup (name/altnames to address map)
			
			
			'accountStore'	:	{
				/*'28kCp5BWu2f1qsB582EkmkeJisHa' : {
					name: 'raiden@coinindex.agency', //main name of account
					//altNames:[], //array of alternative names (added by scecial trx)
					createdAt: 1547054555443,
					createdBlockHeight: 0,
					status: 'open',
					type: 'user',
					nonce: 0,
					pubKey: '04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179',
					
					assets:{
						'IDXT' : {	//default, base coin of network
							amount: 10000000 //amount (*divider)
						}
					},
					
					tx: []
				}*/
			} //user accounts
		};
	},
	
	eventsSubscribe: function(){
		//events.on('blockCommit', indexProtocol.blockCommitHandler);
		
		events.on('dbReady', indexProtocol.loadState);
		
		//events.on('appStateRestored', indexProtocol.startTendermintNode);
		
		events.on('appStateRestored', indexProtocol.startAbciServer);
	},
	
	//some handlers
	loadState: function(){
		console.log('Reading latest app state from db: ' + stateDbPath + '\n');
	
		if (stateDb.status == 'open'){
			stateDb.get('appState', function(err, val){
				if (!err && val){
					console.log('Recover appState from disk... OK');
					
					if (Buffer.isBuffer(val)){
						val = val.toString('utf8');								
					}
					
					val = JSON.parse( val );
					
					_.each(val, function(v, i){
						appState[ i ] = v;
					});
					
					
					if (process.argv.indexOf('dumpappstate') != -1){
						
						console.dir( appState, {depth:64, colors:true} );					
						
						process.exit();
					}
					
				
//TEST
//appState.blockHeight = 99999;


					
					//check it 
					let calcAppHash = indexProtocol.calcHash( JSON.stringify(appState), false);
					
					//load last appHash 
					stateDb.get('appHash', function(err, val){
						if (!err && val && Buffer.isBuffer(val)){
							let loadedAppHash = val.toString('utf8');			

							console.log('Checking hash integrity...');
							console.log('loaded AppHash: ' + loadedAppHash);
							console.log('rehash AppHash: ' + calcAppHash);
							
				
							if (loadedAppHash === calcAppHash){
								appState.appHash = calcAppHash;
								
								console.log('State loaded OK\n');
								events.emit('appStateRestored');
								
								/**
								//confirmations 
								stateDb.get('tbl.confirmation', function(err, val){
									if (!err && val && Buffer.isBuffer(val)){
										val = JSON.parse( val.toString('utf8') );
										
										if (val && val.state && val.queue){
											consensusConfirmation = val;
											
											console.log('Confirmations loaded OK');
											
											events.emit('appStateRestored');
										}
										else
											process.exit(1);
									}
									else
										process.exit(1);
								});
								**/

														
							}
							else {
								console.log('Error while appState loaded. Inconsistent data.');
								console.log('Maybe data inconsistent. Try to run app with <cleandb> option');
								
								process.exit(0);						
							}
							
						}							
					});					
				}
				else 
				if (err && err.toString() == 'Error: NotFound: '){
					
					appState = indexProtocol.getDefaultState();					
					
					console.log('appState revert to default values');
					
					events.emit('appStateRestored');
				}
			});

	
		}
		else {
			console.log('Error, stateDb not ready to work. Status: ' + stateDb.status + '\n');
			process.exit(1);		
		}
	},
	
	calcHash: function( data, returnRaw ){
		if (!data)
			data = '';
		
		let hash = crypto.createHash('sha256');
			hash.update( /*JSON.stringify(appState)*/ data, 'utf8' );
		
		if (returnRaw === true)
			return hash;
		else
			return hash.digest('hex');
	},
	
	startAbciServer: function(){
		console.log('ABCI Server starting...');

		server.listen(26658, function(){
			console.log('ABCI server started OK');
			
			events.emit('AbciServerStarted');
		}).on('error', function(e){
			console.debug( e );
		}).on('close', function(e){
			console.log('Tendermint connection close!');
		});
	},
	
	//fetch pubKey from accounts base 
	pubKeyFrom: function( id ){
		if (!id) return false;
		
		//id:  address, name, any from altnames
		if (appState.accountStore[ id ])
			return appState.accountStore[ id ].pubKey;
		
		var _pubKey = null; 
		
		_.find(appState.accountStore, function(v){
			if (v.name == id){
				_pubKey = v.pubKey;
				
				return true;
			}
		});
		
		if (_pubKey)
			return _pubKey;
		else
			return false;		
	},
	
	getAddressBy: function( id ){
		if (!id) return false;
		
		if (appState.accountStore[ id ] && appState.accountStore[ id ].address == id)
			return id;
		
		var address = false; 
		
		_.find(appState.accountStore, function(v){
			if (v.name == id || v.address == id || v.pubKey == id) {
				address = v.address;
				
				return true;
			}
		});
		
		return address;		
	},
	
	blockCommitHandler: function(height){
		//if length of blocks more then 900
		if (appState.blockStore.length == storeLatestBlocks){
			
			let calcAvg = {
				symbol				: 'BTC/USD',	//for testnet only
				
				blockHeight			: height, 
				blockHash			: appState.blockHash,
				
				avgHash				: '', //sha256				
				merkleRoot			: '',
								
				avgPrice			: 0,
				minPrice			: 0,
				maxPrice			: 0,
				openPrice			: 0,
				closePrice			: 0,
				totalAmount			: 0, //in money
				totalVolume			: 0, //in assets
				
				openVolume			: 0,
				openAmount			: 0,
				
				closeVolume			: 0,
				closeAmount			: 0,
				
				vwapPrice			: 0,
				
				openTime			: 0, 
				closeTime			: 0, 
				
				totalTx				: 0,
				blocksIncluded		: [], //hash-map: height : blockHash  
				exchangesIncluded	: [],
				
				pubKey				: '', //public Key of calculater 
				sign				: ''  // signature of calc block 
			};
			
			var _tx = [];
			var _price = [];
			
			_.each(appState.blockStore, function(v){
				
				if (v.tx.length > 0){
					_tx = _tx.concat( v.tx );
					
					_.each(	v.tx, function(q){
						if (q.price) _price.push( q.price );
					});
					
					//@todo: do this after rewrite MerkleTree lib to use difference hash fn for nodes and liaf
					//let hash = indexProtocol.calcHash( indexProtocol.calcHash(v.blockHash) );
					//calcAvg.blocksIncluded.push({height: v.blockHeight, hash: hash, type: 'sha256', isDouble: true});
					calcAvg.blocksIncluded.push({height: v.blockHeight, hash: v.blockHash});
				}							
			});
			
			calcAvg.minPrice = _.min( _price );
			calcAvg.maxPrice = _.max( _price );
			
			calcAvg.blocksIncluded = _.sortBy(calcAvg.blocksIncluded, 'height');

			if (_tx.length != 0){
			
				//openPrice - avg from open block
				let openBlockId = _.first( calcAvg.blocksIncluded, 1)[0].height;
				let closeBlockId = _.last( calcAvg.blocksIncluded, 1)[0].height;
				
				//first block with price
				var tmp = _.find(appState.blockStore, function(v){ if (v.blockHeight == openBlockId) return true; });
			
				if (tmp){
					
					//@todo: which price use? avg/mid/vwap, first of tx at block?
					calcAvg.openPrice = tmp.vwapPrice;
					calcAvg.openAmount = tmp.totalAmount;
					calcAvg.openVolume = tmp.totalVolume;
					calcAvg.openTime   = tmp.blockTime;
				}	
				
				//closePrice - avg from head of store 
				var tmp = _.find(appState.blockStore, function(v){ if (v.blockHeight == closeBlockId) return true; });
				
				if (tmp){
					
					//@todo: which price use? avg/mid/vwap, first of tx at block?
					calcAvg.closePrice 	= tmp.vwapPrice;
					calcAvg.closeAmount = tmp.totalAmount;
					calcAvg.closeVolume = tmp.totalVolume;
					calcAvg.closeTime   = tmp.blockTime;
				}	
				
				//avgPrice 
				var x = 0, y = 0, z = 0;
				
				_.each(_tx, function(v){
					x = x + v.price;
					y = y + v.amount;
					z = z + v.total;
					
					if (v.excode)
						calcAvg.exchangesIncluded.push( v.excode );
				});
				
				//@todo calc Mid price
				if (x > 0) calcAvg.avgPrice 	= Math.trunc( x / _tx.length );
				if (y > 0) calcAvg.totalAmount 	= Math.trunc( y );
				if (z > 0) calcAvg.totalVolume 	= Math.trunc( z );
				
				if (z > 0 && y > 0)
					calcAvg.vwapPrice = Math.trunc( ( calcAvg.totalVolume / calcAvg.totalAmount ) * fixedExponent );
				
				calcAvg.totalTx = _tx.length;
				
				if (calcAvg.exchangesIncluded.length > 1){
					calcAvg.exchangesIncluded.sort();
					calcAvg.exchangesIncluded = _.uniq( calcAvg.exchangesIncluded, true );
				}
			}
			
			/*
			let _tmp = [];
			
			calcAvg.blocksIncluded.forEach(function(v){
				if (v.hash) _tmp.push( v.hash );
			});
			
			if (_tmp && _tmp.length > 0){
			
				//const tree = new MerkleTree(_tmp, sha256, {isBitcoinTree: true});
				//calcAvg.merkleRoot = tree.getRoot().toString('hex');
				
				//store all Merkle Tree
				//@todo: add creation from stored
				//calcAvg.merkleTree = tree.getLayersAsObject(); 
			}
			*/
			/* @todo: realize sign avg quote */
			calcAvg.avgHash = sha256( JSON.stringify( calcAvg ) ).toString('hex');
			
//console.dir( calcAvg, {depth: 16, colors: true}); 
//process.exit();

			appState.latestAvg = calcAvg;
		}
	},
	
	processDelayedTask: function( height ){
		if (delayedTaskQueue.length > 0){
			_.each(delayedTaskQueue, function(v, i){
				if (v && v.exec){
					if (v.exec == 'tbl.accounts.create')
						indexProtocol.processNewAccountReg( v, height );
					else
					if (v.exec == 'tbl.system.rewards')
						indexProtocol.processValidatorsBlockReward( v, height );
					else
					if (v.exec == 'tbl.tx.transfer')
						indexProtocol.processTransfer( v );
				}
			});
			
		}
	},
	
	processValidatorsBlockReward: function(data, height){
		if (!data || !height) return false; 
		
		if (!appState.validatorStore[ data.address ]){
			appState.validatorStore[ data.address ] = {
				address			: data.address,
				totalRewards	: 0,
				totalDataTx		: 0,
				lastReward		: 0,
				lastBlockHeight : 0,
				unspentRewards	: 0,
				
				hash			: '',
				appStateHash	: ''
			};
		}
		
		//add rewards 
		appState.validatorStore[ data.address ].totalRewards++;
		appState.validatorStore[ data.address ].totalDataTx = appState.validatorStore[ data.address ].totalDataTx + data.numTx;
		appState.validatorStore[ data.address ].lastReward = data.rewardFull;
		appState.validatorStore[ data.address ].unspentRewards = appState.validatorStore[ data.address ].unspentRewards + data.rewardFull;
		
		appState.validatorStore[ data.address ].lastBlockHeight = data.blockHeight;
		//empty only for block 1
		appState.validatorStore[ data.address ].appStateHash = appState.previousAppHash;
		
		let json = stringify( appState.validatorStore[ data.address ] );
		
		let sha256  = crypto.createHash('sha256');	
		let hash = sha256.update( Buffer.from( json, 'utf8') ).digest('hex');
		
		appState.validatorStore[ data.address ].hash = hash;
		
		saveOps.push({ type: 'put', key: 'tbl.system.rewards.' + data.address, value: stringify(appState.validatorStore[ data.address ]) });
		
		return true;
	},
	
	
	//new account registration
	processNewAccountReg: function(data, height){
		if (!data || !height) return false; 
		
		let accObj = {
			name				: data.name,
			address				: data.addr,
			createdBlockHeight	: height,
			updatedBlockHeight  : height,
			status				: 'created',  //in next tx will be changed to active
			type				: data.type,
			nonce				: 0, //count tx from this acc
			pubKey				: data.pubk,
			
			assets				: {},					
			tx					: [] //array of hash (?) of all transactions in/out from acc
		};
		
		//adding default native token 
		accObj.assets[ appState.options.nativeSymbol ] = { amount: appState.options.initialNativeCoinBalance };
		
console.debug( accObj );
		
		let sha256  = crypto.createHash('sha256');	
		let accJson = stringify( accObj );
		let accHash = sha256.update( Buffer.from( accJson, 'utf8') ).digest('hex');
		
		//add to appState 
		appState.accountStore[ data.addr ] = accHash;
		
		saveOps.push({ type: 'put', key: 'tbl.account.' + data.addr, value: accJson });
		//save as reverse map to fast lookup by name/altnames.
		//@todo: Possible to optimize by one big hash-map
		saveOps.push({ type: 'put', key: 'tbl.system.namelookup.' + accObj.name, value: data.addr }); 

		return true;
	},
	
	//transfer asset by one account to other
	processTransfer: function( data ){
		//find address from 
		//find destination addres 
		var _from = indexProtocol.getAddressBy( data.base );
		var _to = indexProtocol.getAddressBy( data.toad ); 
		
		if (_from && _to){
			//проверить достаточность суммы 
			var total = data.amnt; //
			var fromAcc = appState.accountStore[ _from ];
			var toAcc   = appState.accountStore[ _to ];
			
			if (fromAcc.assets[ data.symb ].amount >= total && fromAcc.nonce < data.nonc){
				//do this 
				if (!toAcc.assets[ data.symb ]){
					toAcc.assets[ data.symb ] = { amount: 0};
				}
				
				fromAcc.nonce++;				
				fromAcc.assets[ data.symb ].amount = fromAcc.assets[ data.symb ].amount - total;
				toAcc.assets[ data.symb ].amount = toAcc.assets[ data.symb ].amount + total;
				
				fromAcc.updatedBlockHeight = appSate.blockHeight;
				toAcc.updatedBlockHeight = appSate.blockHeight;
				
				//формируем тразакцию для сохранения 
				let tx = {
					fromAddr	: _from,
					toAddr   	: _to, 
					blockheight : appSate.blockHeight,
					appState	: appState.previousAppHash,
					
					hash 		: '',
					
					original	: data
				}
				
				
				let sha256  = crypto.createHash('sha256');	
				let txHash  = sha256.update( Buffer.from( stringify( tx ), 'utf8') ).digest('hex');
				
				tx.hash = txHash;
				
				let txJson = stringify( tx );
				
				fromAcc.tx.push( txHash );
				toAcc.tx.push( txHash );
				
				let sha256  = crypto.createHash('sha256');	
				let accJson = stringify( fromAcc );
				let accHash = sha256.update( Buffer.from( accJson, 'utf8') ).digest('hex');
				
				appState.accountStore[ _from ] = accHash;
				
				
				let sha256  = crypto.createHash('sha256');	
				let accJson = stringify( toAcc );
				let accHash = sha256.update( Buffer.from( accJson, 'utf8') ).digest('hex');
				
				appState.accountStore[ _to ] = accHash;
				
				saveOps.push({ type: 'put', key: 'tbl.tx.transfer.' + txHash, value: txJson });
				
				return true;				
			}			
		}		
	},
	
	//API handlers for abci_query 
	api: {
		
	}
}

//APP state
let appState = indexProtocol.getDefaultState();
let beginBlockTs = 0; // process.hrtime();
let endBlockTs = 0;

//tasks to do at block commit
let delayedTaskQueue = []; 
let saveOps = []; //array of data to batch save to stateDb

//Create ABCI server 
let server = createServer({
	
	//Global initialize network
	//Called once upon genesis
	initChain: function(request){
		console.log('Call: InitChain');
		
		let chainId = request.chainId;
		
		console.log('Staring new chain with ID: ' + chainId);
		console.log('Try to initialize clear evn for contracts and registry');
		console.log(' ****** IMPORTANT!   CLEAN DB ************** ');		
		/***
		stateDb.close(function(){});
		
		console.log('Destroy ALL data from application db. All data will be losted!');
		console.log('Clearing app state...');
			
		let dir = fs.readdirSync( stateDbPath );
		
		_.each(dir, function(f){
			console.log('remove file: ' + f + '... ok');
			
			fs.unlinkSync( stateDbPath + '/' + f);			
		});
		
		fs.rmdirSync( stateDbPath );
						
		console.log('All app DB cleared and removed... OK\n\n');
		
		stateDb.open(rocksOpt, function(err){
			if (!err){
				//waiting for status
				var t = setInterval(function() {
					if (stateDb.status != 'open') return;
					
					console.log('stateDb opened and ready');
					clearInterval( t );								
					
					//OK, all DB ready to work
					events.emit('dbReady');
				
				}, 100);
			}
			else {
				console.log('stateDb opening error: ' + err);
				process.exit(0);
			}
		});
		**/
		
		
		//default value for appState
		appState = indexProtocol.getDefaultState();		
		
		return {
			code: 0,
			validators: [] //use validators list, defined by genesis.json
		};		
	},	
  
	info: function(request) {
		console.log('INFO request called');
		console.debug( request );
		
		//@todo optimize it
		stateDb.put('appVersion', appState.appVersion, function(err){});
		stateDb.put('version', appState.version, function(err){});

		return {
			data: 'Node.js INDEX Protocol app',
			version: appState.version, 
			appVersion: appState.appVersion,
			lastBlockHeight: appState.blockHeight 
			//lastBlockAppHash: appState.appHash  //now disable for debug
		}; 
	}, 
  
	setOption: function(request){
		console.log('setOption request called');
		console.debug( request );  

		return { code: 0 };	
	},

	query: function(request){
		console.log('QUERY request called');
		console.debug( request ); 
		
		if (stateDb.status != 'open')	return { code: 1 };
		
		/*
			QUERY request called
			RequestQuery { data: <Buffer 7a 7a 7a 7a>, path: 'getaccountaddress' }
		*/
		
		if (request.path){
			let path = request.path.toLowerCase();
			let data = request.data; //Buffer 
			
			//var result = new Promise();
			
			//@todo: use browser-based account generation
			//@todo2: add HD and seed-based account 
			if (path === 'getaccountaddress'){
				//generate new account (without safe)
				const 	ecdh 	= 	crypto.createECDH('secp256k1');
						ecdh.generateKeys();
		
				let privKey = ecdh.getPrivateKey();
				let pubKey = ecdh.getPublicKey();
				let address = '';

				let sha256 = crypto.createHash('sha256');
				let ripemd160 = crypto.createHash('ripemd160');
				let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

					address = bs58.encode( hash );
					
				//simple check 
				if (appState.accountStore[ address ])
					return {code: 1}; 
			
		console.log('===========================');
		console.log('Generate new account (TEST):');
		console.log('privateKey: ' + privKey.toString('hex'));
		console.log('publicKey:  ' + pubKey.toString('hex'));
		console.log('wallet address: ' + address);
		console.log('===========================');
				
				return {code: 0, value: Buffer.from(JSON.stringify( {
					address: address,
					pubKey:	pubKey.toString('hex'),
					privKey: privKey.toString('hex')
				} ), 'utf8').toString('base64')};
				
				
				/**
				return new Promise(function(resolve, reject){
					setTimeout(function(){
						return resolve( {code: 0, value: Buffer.from(JSON.stringify({"fuck" : 'hhhhhhhhhhhhhhhhhhhh', env: process.config }), 'utf8').toString('base64')} ); //{ code: 0, data: 'ggggg', response: 'klkhkjhkhk'});
					}, 5000);
				});
				**/
			}
			else
			if (path === 'getavgtx'){
				let _height = parseInt( data.toString('utf8') );
				
				if (!_height)
					return { code: 1 };
				
				if (_height > appState.blockHeight)
					return { code: 1 };
				
				return new Promise(function(resolve, reject){
					
					stateDb.get('tbl.block.'+_height+'.avg', function(err, val){
						if (!err && val){
							console.log('Query fetch: avg tx from block #' + _height);
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );
						}
						else
							return reject( {code:1} );
					});
					
				});				
			}
			else
			if (path === 'gettxs'){
				let _height = parseInt( data.toString('utf8') );
				
				if (!_height)
					return { code: 1 };
				
				if (_height > appState.blockHeight)
					return { code: 1 };
				
				return new Promise(function(resolve, reject){
					
					stateDb.get('tbl.block.'+_height+'.tx', function(err, val){
						if (!err && val){
							console.log('Query fetch: all tx from block #' + _height);
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );
						}
						else
							return reject( {code:1} );
					});
					
				});				
			}
			else
			if (path === 'getappstate'){
				//only latest
				//@todo: save full appState per height
				return new Promise(function(resolve, reject){
					
					stateDb.get('appState', function(err, val){
						if (!err && val){
							console.log('Query fetch: latest appState');
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );
						}
						else
							return reject( {code:1} );
					});
					
				});				
			}
			else
			if (path === 'getallaccounts'){
				let maxCountAddr = 1000; //maximum of addresses
				let _res = [];
				
				//@todo: use find
				_.each(appState.accountStore, function(v, addr){
					if (_res.length > maxCountAddr) return;
					
					_res.push({
						address	:	v.address,
						name	:	v.name,
						height	:	v.createdBlockHeight,
						status	:	v.status,
						type	:	v.type,
						nonce	: 	v.nonce,
						pubKey	: 	v.pubKey
					});
					
				});
	
				return {code: 0, value: Buffer.from(JSON.stringify( _res ), 'utf8').toString('base64')};
			}
			
			
			
			/**
			{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.tx', value: stringify(appState.blockStore[0])}
			 **/
			
		}
		
		
		return { code: 1 };
		//let path = request.path;
		
		//let tmp = Buffer.from( path, 'utf8').toString('utf8');
		
		//console.debug( tmp );

		//return { code: 0 };
	},
  
	checkTx: function(request) {
		//console.log('Call: CheckTx', request);   
		// let tx = request.tx;
		let ztag = [];
			ztag.push({key: 'year', value : '2019'}); 
			ztag.push({key: 'zear', value : 'test'}); 
				
		return { code: 0, tags: ztag }; 
		//return { code: 0 }; //, log: 'tx succeeded'
	},

	deliverTx: function(request) {
		//console.log('Call: DeliverTx');    
		//console.debug( request );  
		//return { code: 0 };

		let tx = request.tx.toString('utf8'); //'base64'); //Buffer 
		let z  = tx.split(':'); //format: CODE:<base64 transaction body>

		if (!tx) return { code: 0, log: 'Wrong tx type' };
		if (!z || z.length != 2) return { code: 0, log: 'Wrong tx type' }; 	 

		let txType = z[0].toUpperCase();
		let tags = {};

		//console.debug( txType );
		//console.debug( z );

		switch ( txType ){
			
			case 'CET': {
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				
				tags[ 'tx.class' ] = 'cetx';
				
		//			console.log('CET: Cryptocurrency Exchange Trades :: ' + _x);
				
				var x = JSON.parse( _x );
				
				if (x){			
					if (x.price < 0)
						return { code: 0, log: 'CET: Price can not be lover then 0'};
					
					if (x.amount <= 0)
						return { code: 0, log: 'CET: Amount can not be 0 or less'};
					
					if (x.total <= 0)
						return { code: 0, log: 'CET: Total can not be 0 or less'};
					
					if (!x.id || x.id == null || x.id == '')
						return { code: 0, log: 'CET: ID can not be empty'};    
					
					
					if (x.excode && x.excode == 'rightbtc'){
						tags[ 'tx.excode' ] = x.excode.toLowerCase();
						
						let _price = Math.trunc( x.price / 100000000 );
						let _amount = Math.trunc( x.amount / 100000000 );
						let _total = Math.trunc( parseFloat( (_price * _amount)/ fixedExponent ) );
//  3540330000, 14700, 52042851000000, 8966192506135904000
//console.log([x.price, x.amount, _price, _amount, _total]);
	
						x.price = _price;
						x.amount = _amount;						
						x.total = _total;
						
//console.log(['Test', Number(x.price/fixedExponent).toFixed(3), Number(x.amount/fixedExponent).toFixed(3), Number(x.total/fixedExponent).toFixed(3)]);						

						//x.total = Math.trunc(  x.total / 100000000 );
						
						//console.log( x );
					}
					//	return { code: 1, log: 'CET: RightBTC Exchange is blocked!' };
					
/**					
					tags[ 'asset' ] = x.asset.toUpperCase();
					tags[ 'cur' ] = x.cur.toUpperCase();
					tags[ 'tx.symbol' ] = x.symbol.toUpperCase();
					tags[ 'tx.type' ] = x.type.toUpperCase();
					
					if (x.side && x.side != '')
						tags[ 'tx.side' ] = x.side.toUpperCase();
					
					let _ts = moment.unix( x.ts );
					
					tags[ 'tx.date' ] = _ts.format('DD/MM/YYYY');
					//tags[ 'year' ] = _ts.format('YYYY');
					
					tags[ 'year' ] = 2019; //_ts.format('YYYY');
					tags[ 'tx.year' ] = 2019; //_ts.format('YYYY');
					
					tags[ 'tx.month' ] = _ts.format('MM/YYYY');
					tags[ 'tx.week' ] = _ts.format('ww');
					
					tags[ 'tx.hour' ] = _ts.format('HH');
					tags[ 'tx.time' ] = _ts.format('HH:mm');
**/
					delete x._hash;

					currentBlockStore.push( x );
				}
				
				
				// //ztag.push({'key': 'tx.year', 'value' : '2019'});
				let ztag = [];
					ztag.push({key: 'year', value : '2019'}); 
					ztag.push({key: 'zear', value : 'test'}); 
				
				return { code: 0, tags: ztag }; 
				
				break;   
			}
			
			case 'AVG': {
				//console.log('AVG: Calc Rates :: ' + z[1]);
				
				
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				
				var x = JSON.parse( _x );
				
				if (x){
				
					console.log('AVG: Calc Rates commited for height ' + x.blockHeight + ' (diff: ' + (appState.blockHeight - x.blockHeight) + ')');
				
				}
				
				break;
			}
			
			//new account register action 
			case 'REG' : {
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				var x = JSON.parse( _x );
				
				if (x){
					//1. check all required fields 
					//2. exclude signature, replace it to ''
					//3. Verify signature 
					//4. if OK, check account present at state.accountStore. If Ok = wrong tx 
					//5. check system nslookup tbl for name. If Ok - wrong tx 
					//6. If OK - add to action queue (real create will be delegated to block commit)
					
					/*
						{
							exec: 'tbl.accounts.create',	//ns of actions
							addr: address,
							pubk: pubKey.toString('hex'),
							name: 'raiden@indexprotocol.network',
							type: 'user', //index, provider, issuer, exchange, fund... any type
							sign: ''
						}
					*/
					
					console.debug( x );
					
					//@todo: more complex check each fileds
					if (x.exec == 'tbl.accounts.create' && x.addr && x.pubk && x.name && x.type == 'user' && x.sign){
						let sign = x.sign;
							x.sign = '';
						let pubKey = x.pubk;
						let sha256 = crypto.createHash('sha256');						
						let xHash = sha256.update( Buffer.from( stringify( x ), 'utf8') ).digest();
						
						let vRes = secp256k1.verify(xHash, Buffer.from(sign, 'hex'), Buffer.from(pubKey, 'hex'));

						if (vRes == true){
							//sign OK 
							
							if (!appState.accountStore[ x.addr ]){							
								delayedTaskQueue.push( x ); //do this at the commit of block
							
								return { code: 0, log: 'REG:' + x.name + ';' + x.addr + ';OK' };
							}
						}
						
					}					
				}
				
				//DEBUG
				return { code: 0, log: 'Invalid tx format' };
				
				break;
			}
			
			//Transfer active from one address to another address
			case 'TRA' : {
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				var x = JSON.parse( _x );
				
				if (x){
					//1. check all required fields 
					//2. exclude signature, replace it to ''
					//3. Verify signature 
					//4. if OK, check account present at state.accountStore. If Ok = wrong tx 
					//5. check system nslookup tbl for name. If Ok - wrong tx 
					//6. If OK - add to action queue (real create will be delegated to block commit)
					
					/*
						{
							exec: 'tbl.tx.transfer',	//ns of actions
							base: address,
							toad: address, //or name or one of altnames registered by chain
							//pubk: pubKey.toString('hex'), //from pubkey
							symb: 'IDXT', // if empty, null or 0 = IDXT or any default type of coin, or registered symbols
							amnt: 10000, //amount of tx, including tfee, (always integer, used fixedExponent), min is 1
							tfee: 1, // standart fee (or any other, todo)
							data: '', //up to 256 bytes any user data 
							nonc: 1, 
							sign: '' //signature from privateKey of from address
						}
					*/
					
					console.debug( x );
					
					//@todo: more complex check each fileds
					if (x.exec == 'tbl.tx.transfer' && x.base && x.toad && x.amnt && x.nonc > 0 && x.sign){
						
						let sign = x.sign;
							x.sign = '';
						
						//find pubKey from associated acc 
						let pubKey = indexProtocol.pubKeyFrom( x.base );
						
						if (!pubKey || pubKey === false)
							return { code: 0, log: 'Wrong account' };
						
						let sha256 = crypto.createHash('sha256');						
						let xHash = sha256.update( Buffer.from( stringify( x ), 'utf8') ).digest();
						
						let vRes = secp256k1.verify(xHash, Buffer.from(sign, 'hex'), Buffer.from(pubKey, 'hex'));

						if (vRes == true){
							//sign OK 
							
							delayedTaskQueue.push( x ); //do this at the commit of block
							
							return { code: 0 };
						}
						
					}					
				}
				
				//DEBUG
				return { code: 0, log: 'Invalid tx format' };
				
				break;
			}
			
			
			
			default: {	//DEBUG
				return { code: 0, log: 'Unknown tx type' };
			}
		}

		//let number = tx.readUInt32BE(0)
		//if (number !== state.count) {
		//  return { code: 1, log: 'tx does not match count' }
		//}

		// update state
		// state.count += 1

		return { code: 0 }; //, log: 'tx succeeded' };
	},
  
	beginBlock: function(request) {
		console.log('Call: BeginBlock. Height: ' + request.header.height);  
		//console.log( request );
		
		//block time
		appState.blockTime = parseInt( request.header.time.seconds ); 
		
		//console.log( request.header.height + ' block proposerAddress: ' + request.header.proposerAddress.toString('hex') ); 
		appState.blockHash = request.hash.toString('hex');
		
		let proposerAddress = request.header.proposerAddress.toString('hex');
		let numTx = parseInt( request.header.numTxs.toString() );
		let rewardFull = appState.options.rewardPerBlock + ( appState.options.rewardPerDataTx * numTx);
			
			//save to special system tbl 
			delayedTaskQueue.push({
				exec: 'tbl.system.rewards', 
				address: proposerAddress, 
				rewardPerBlock: appState.options.rewardPerBlock,
				rewardPerDataTx: appState.options.rewardPerDataTx,
				numTx: numTx,
				
				rewardFull: rewardFull,
				
				blockHeight: parseInt( request.header.height.toString() )
			});
	
		//initial current block store
		currentBlockStore = [];

		beginBlockTs = process.hrtime();
		
		indexProtocol.curTime = new Date().getTime(); //local node's time
		
		return { code: 0 };
	},
  
	endBlock: function(request){
		let hx = parseInt( request.height.toString() );
		
		
//console.dir( request, {depth:16, colors: true});		
		
		
		if (appState.blockStore.length == storeLatestBlocks){
			appState.blockStore.pop();
		}
		
		//lets calc some avg stat of block 
		let avgQuote = {
			blockHeight: hx, 
			blockHash: appState.blockHash,
			blockTime: appState.blockTime,
			
			avgPrice: 0,
			minPrice: 0,
			maxPrice: 0,
			
			vwapPrice: 0,
			
			totalVolume: 0,
			totalAmount: 0,
			
			tx: [],
			
			totalTx: currentBlockStore.length,
			exchangesIncluded: []
		};
		
		let exchangesIncluded = [];

		//update only non-empty block
		if (currentBlockStore.length > 0){
						
			var x = 0, y = 0, z = 0, vwap = 0;
			var p = [];
				
			_.each(currentBlockStore, function(v){
				x = x + v.price;
				y = y + v.amount;
				z = z + v.total;
				
				vwap = vwap + (v.total); // / fixedExponent);
				
				p.push( parseInt( v.price ) );
				
				if (v.excode && exchangesIncluded.indexOf(v.excode) == -1)
					exchangesIncluded.push( v.excode );
			});
			
			if (x > 0) avgQuote.avgPrice = parseInt( x / currentBlockStore.length );
			if (y > 0) avgQuote.totalAmount = parseFloat( y );
			if (z > 0) avgQuote.totalVolume = parseFloat( z );
			
//console.log('\n\n');
//console.log(p);
			
			avgQuote.minPrice = _.min( p );
			avgQuote.maxPrice = _.max( p );
			
			
//console.log([avgQuote.minPrice, avgQuote.maxPrice]);			
//console.log( exchangesIncluded );	
//console.log( _.uniq( exchangesIncluded ) );	

//console.log('\n\n');	
			
			avgQuote.vwapPrice = parseInt( (vwap / avgQuote.totalAmount ) * fixedExponent );
			
			//exchangesIncluded.sort();			
			avgQuote.exchangesIncluded = _.uniq( exchangesIncluded );
		}
		
		avgQuote.tx = currentBlockStore;
		
		appState.blockStore.unshift( avgQuote );
		appState.blockHeight = hx;
		appState.previousAppHash = appState.appHash;
		appState.appHash = '';

		//console.log(hx + ' EndBlock, tx count: ' + currentBlockStore.length ); 

		return { code: 0 };
	},

	//Commit msg for each block.
	commit: function(){
		try {
		
		//events.emit('blockCommit', appState.blockHeight);
		if (delayedTaskQueue.length > 0){
			indexProtocol.processDelayedTask( appState.blockHeight ); //
			
			delayedTaskQueue = [];
		}
				
		indexProtocol.blockCommitHandler( appState.blockHeight );

		endBlockTs = process.hrtime( beginBlockTs ); 

		if (appState.appHash == ''){
			const time = process.hrtime();
			
			//create full string
			let jsonAppState = JSON.stringify( appState );//stringify
			
			//calc actual hash
			appState.appHash = indexProtocol.calcHash( jsonAppState, false);
			
			const diff = process.hrtime(time);	
			const time2 = process.hrtime();
			
			let ops = [
				{ type: 'put', key: 'appHash', value: appState.appHash },
				{ type: 'put', key: 'blockHeight', value: appState.blockHeight },
				
				{ type: 'put', key: 'appState', value: jsonAppState },

				{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.avg', value: stringify(appState.latestAvg) },
				{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.tx', value: stringify(appState.blockStore[0])}
			];
			
			if (saveOps.length > 0){
				ops = ops.concat( saveOps );
			}
			
			//save confirmations queue and state 
			//ops.push({type: 'put', key: 'tbl.confirmation', value: JSON.stringify( consensusConfirmation )});
			
			return new Promise(function(resolve, reject){
				stateDb.batch(ops, function (err){
					if (!err){
						saveOps = []; //reset all planned writes to main db
						
						const diff2 = process.hrtime(time2);
				
						console.log( appState.blockHeight + ' block, data tx: ' + appState.blockStore[0].tx.length + ', appState hash: ' + appState.appHash + ', save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
						
						return resolve( {code: 0} );
					}
					else {
						console.log('ERROR while save state to DB');
						process.exit(1);	

						return reject( {code:1} );
					}
				});
			});
		}

		// Buffer.from(appState.appHash, 'hex')
		//return { code: 0 }
		
		}catch(e){
			console.log( e );
			
			console.log('ERROR while save state to DB');
			process.exit(1);	
			
			return { code: 1 }
		}
	} 

});

/**
//=== Debug
setInterval(function(){
	
	console.log('\n');
	
	console.dir( blockHashStore, {depth:4, colors: true });
	
	console.log('\n');
	
	
}, 60000);
**/
//===

//initial subscribe to events
indexProtocol.eventsSubscribe();

