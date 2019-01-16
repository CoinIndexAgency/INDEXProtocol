//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const crypto 		= require('crypto');
const { spawn } 	= require('child_process');
const fs			= require('fs');
let _				= require('underscore');
var emitter			= require('events');
const events 		= new emitter();
var prettyHrtime 	= require('pretty-hrtime');
var rocksdown 		= require('rocksdb');
var async 			= require('async');
const secp256k1		= require('secp256k1');
let stringify 		= require('fast-json-stable-stringify');

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
const storeLatestBlocks = 900; //how many blocks decoded and stored
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
			'blockStore' 	: [],  //filled by transactions (by 900 block)
			
			'previousAppHash' : '',
			'latestAvg'		: null,	//latest avg data	
			
			//some of settings overall all chain
			'options'		: {
				'nativeSymbol'				: 'IDXT',  //tiker for native coin at this network
				'initialNativeCoinBalance'	: 1000,
				'defaultSystemAccount'		: 'testnet@indexprotocol.network',
				
				//full reward = rewardPerBlock + (rewardPerDataTx * DataTxCount) + SUMM(TxFee)
				'rewardPerBlock'				: 1000, //reward to Validator for block (base value, for any tx at block)
				'rewardPerDataTx'				: 10
			},
			
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
							
							
							
							/** TEST **/
							if (1/*loadedAppHash === calcAppHash*/){
								appState.appHash = calcAppHash;
								
								console.log('State loaded OK\n');
								
								events.emit('appStateRestored');								
							}
							else {
								console.log('Error while appState loaded. Inconsistent data.');
								
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
	
	/**
	startTendermintNode: function(){
		
		if (startTendermintNode != false){	
	
			console.log('Tendermint node (full-node, not a Validator) starting...');
			// tendermintLogDebug
			tendermint = spawn('/opt/tendermint/tendermint', ['node', '--home=/opt/tendermint']); // , "--log_level='*:debug'"
				
			tendermint.stdout.on('data', (data) => {
			  console.log('TC:' + data);
			});

			tendermint.on('close', (code) => {
			  console.log('TC: child process exited with code: ' + code + '\n');
			  process.exit(1);
			});	
		
		}
		else
			console.log('Running in ABCI-only mode\n');
		
		events.emit('nodeStarted');
		
	},
	**/
	startAbciServer: function(){
		console.log('ABCI Server starting...');

		server.listen(26658, function(){
			console.log('ABCI server started OK');
			
			events.emit('AbciServerStarted');
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
		if (appState.blockStore.length == 900){
			
			let calcAvg = {
				symbol: 'BTC/USD',	//for testnet only
				
				blockHeight: height, 
				
				avgPrice: 0,
				minPrice: 0,
				maxPrice: 0,
				openPrice: 0,
				closePrice: 0,
				totalAmount:	0,	//in money
				totalVolume: 0, //in assets
				
				openVolume : 0,
				openAmount: 0,
				
				closeVolume : 0,
				closeAmount: 0,
				
				vwapPrice: 0,
				
				timeFrom: 0, //reserved
				timeTo: 0,  //reserved
				
				totalTx: 0,
				//blocksIncluded: [], test performance
				exchangesIncluded: []
			};
			
			var _tx = [];
			var _minPrice = null, _maxPrice = null;
			
			_.each(appState.blockStore, function(v){
				if (v.tx.length > 0){
					_tx = _tx.concat( v.tx );
					
					if (v.avgQuote){
						if (_minPrice == null || v.avgQuote.minPrice < _minPrice){
							_minPrice = v.avgQuote.minPrice;
						}
						
						if (_maxPrice == null || v.avgQuote.maxPrice > _maxPrice){
							_maxPrice = v.avgQuote.maxPrice;
						}
					}
				}
			});
			
			calcAvg.minPrice = _minPrice;
			calcAvg.maxPrice = _maxPrice;
			
			if (_tx.length != 0){
			
				//openPrice - avg from open block 
				var tmp = _.last( appState.blockStore, 1)[0].tx;
				var x = 0, y = 0, z = 0;
					
					_.each(tmp, function(v){
						x = x + v.price;
						y = y + v.amount;
						z = z + v.total;					
					});
					
				if (x > 0) calcAvg.openPrice = parseInt( x / tmp.length );
				if (y > 0) calcAvg.openAmount = parseInt( y );
				if (z > 0) calcAvg.openVolume = parseInt( z );
				
				//closePrice - avg from head of store 
				var tmp = _.first( appState.blockStore, 1)[0].tx;
				var x = 0, y = 0, z = 0;
					
					_.each(tmp, function(v){
						x = x + v.price;
						y = y + v.amount;
						z = z + v.total;					
					});
					
				if (x > 0) calcAvg.closePrice = parseInt( x / tmp.length );
				if (y > 0) calcAvg.closeAmount = parseInt( y );
				if (z > 0) calcAvg.closeVolume = parseInt( z );
				
				
				//avgPrice 
				var x = 0, y = 0, z = 0;
				
				_.each(_tx, function(v){
					x = x + v.price;
					y = y + v.amount;
					z = z + v.total;
					
					if (v.excode)
						calcAvg.exchangesIncluded.push( v.excode );
				});
				
				if (x > 0) calcAvg.avgPrice = parseInt( x / _tx.length );
				if (y > 0) calcAvg.totalAmount = parseInt( y );
				if (z > 0) calcAvg.totalVolume = parseInt( z );
				
				if (z > 0 && y > 0)
					calcAvg.vwapPrice = parseInt( ( calcAvg.totalVolume / calcAvg.totalAmount ) * fixedExponent );
				
				calcAvg.totalTx = _tx.length;
				
				if (calcAvg.exchangesIncluded > 1){
					calcAvg.exchangesIncluded.sort();
					calcAvg.exchangesIncluded = _.uniq( calcAvg.exchangesIncluded, true );
				}
			}
			
			//
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
		
		/*
			QUERY request called
			RequestQuery { data: <Buffer 7a 7a 7a 7a>, path: 'getaccountaddress' }
		*/
		
		if (request.path){
			let path = request.path.toLowerCase();
			let data = request.data; //Buffer 
			
			//var result = new Promise();
			
			if (path === 'getaccountaddress'){
				return new Promise(function(resolve, reject){
					setTimeout(function(){
						return resolve( {code: 0, value: Buffer.from(JSON.stringify({"fuck" : 'hhhhhhhhhhhhhhhhhhhh', env: process.config }), 'utf8').toString('base64')} ); //{ code: 0, data: 'ggggg', response: 'klkhkjhkhk'});
					}, 5000);
				});
			}
			
		}
		else
			return { code: 0 };
		
		

		//let path = request.path;
		
		//let tmp = Buffer.from( path, 'utf8').toString('utf8');
		
		//console.debug( tmp );

		//return { code: 0 };
	},
  
	checkTx: function(request) {
		//console.log('Call: CheckTx', request);   
		// let tx = request.tx;
		return { code: 0 }; //, log: 'tx succeeded'
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

		//console.debug( txType );
		//console.debug( z );

		switch ( txType ){
			
			case 'CET': {
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				
		//			console.log('CET: Cryptocurrency Exchange Trades :: ' + _x);
				
				var x = JSON.parse( _x );
				
				if (x){			
					if (x.price < 0)
						return { code: 0, log: 'CET: Price can not be lover then 0 :: ' + _x };
					
					if (x.amount <= 0)
						return { code: 0, log: 'CET: Amount can not be 0 or less :: ' + _x  };
					
					if (x.total <= 0)
						return { code: 0, log: 'CET: Total can not be 0 or less :: ' + _x  };
					
					if (!x.id || x.id == null || x.id == '')
						return { code: 0, log: 'CET: ID can not be empty :: ' + _x  };    
					
					/*
					if (x.excode && x.excode == 'bitfinex')
						return { code: 1, log: 'CET: bitfinex Exchange is blocked!' };
					*/
					
					delete x._hash;
					
					//all passed OK
					currentBlockStore.push( x );
				}
				
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
		//console.log('Call: BeginBlock. Height: ' + request.header.height);  
		
		console.log( request.header.height + ' block proposerAddress: ' + request.header.proposerAddress.toString('hex') ); 
		
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

		if (appState.blockStore.length == storeLatestBlocks){
			var tmp = appState.blockStore.pop();
			delete tmp;
		}
		
		//lets calc some avg stat of block 
		let avgQuote = {
			blockHeight: hx, 
			
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
				
				if (v.excode)
					avgQuote.exchangesIncluded.push( v.excode );
			});
			
			if (x > 0) avgQuote.avgPrice = parseInt( x / currentBlockStore.length );
			if (y > 0) avgQuote.totalAmount = parseFloat( y );
			if (z > 0) avgQuote.totalVolume = parseFloat( z );
			
			avgQuote.minPrice = _.min( p );
			avgQuote.maxPrice = _.max( p );
			avgQuote.vwapPrice = parseInt( (vwap / avgQuote.totalAmount ) * fixedExponent );
			
			if (avgQuote.exchangesIncluded.length > 1){
				avgQuote.exchangesIncluded.sort();			
				avgQuote.exchangesIncluded = _.uniq( avgQuote.exchangesIncluded, true );
			}
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
			
			stateDb.batch(ops, function (err){
				if (!err){
					
					saveOps = []; //reset all planned writes to main db
					
					const diff2 = process.hrtime(time2);
			
					console.log( appState.blockHeight + ' block, data tx: ' + appState.blockStore[0].tx.length + ', appState hash: ' + appState.appHash + ', save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
				}
				else {
					console.log('ERROR while save state to DB');
					process.exit(1);						
				}
			});
		}

		// Buffer.from(appState.appHash, 'hex')
		return { code: 0 }
	} 

});

/*
//=== Debug
setInterval(function(){
	
	console.log('\n');
	
	console.dir( appState.validatorStore, {depth:4, colors: true });
	
	console.log('\n');
	
	
}, 60000);
*/
//===

//initial subscribe to events
indexProtocol.eventsSubscribe();

