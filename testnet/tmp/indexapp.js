//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const crypto 		= require('crypto');
const fs			= require('fs');
const _				= require('underscore');
const emitter		= require('events');
const events 		= new emitter();
const prettyHrtime 	= require('pretty-hrtime');
const rocksdown 	= require('rocksdb');
const async 		= require('async');
const secp256k1		= require('secp256k1');
const bs58			= require('bs58');
const stringify 	= require('fast-json-stable-stringify');
const moment		= require('moment');
const fetch			= require('node-fetch');
const http			= require('http');
const https			= require('https');

const ssdb 			= null; //require('nodessdb').connect({host:'127.0.0.1', port:8888}, function(err){});

//lib functions, handlers
const queryHandlers		= require('./libs/queryhandlers.js').Handlers;

//console.dir( queryHandlers );

const MerkleTree 	= require('merkletreejs');
const tendermintSocketPath = '/opt/tendermint/tendermint.socket';
//clear old socket 
if (fs.existsSync( tendermintSocketPath ) === true)
	fs.unlinkSync( '/opt/tendermint/tendermint.socket' );

const stateDbPath 	= '/opt/tendermint/app/db/state.db'; //stateDb
const stateDb 	= rocksdown( stateDbPath );

// returns Buffer
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
}

// returns Buffer
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
const storeLatestBlocks = 300; //how many blocks decoded and stored
const storeLatestAvgBlocks = 99; //how many blocks stored for check AVG tx.
const maxDiffFromAppHeight = 30; // avg quote from proposer - how much difference

const fixedExponent = 1000000;
let manualRevertTo = 0;

let dbSyncThrottle = 20; //how many block per db dics sync
let currentThrottleCounter = 0;

const maxTimeDiff 	= 15 * 60 * 1000;
const maxIdsAtCache = 3 * 1000; //per exchange, per assets

	if (process.argv.indexOf('--cleandb') != -1){
		console.log('\n     *** WARNING ***     \n');
		console.log('Destroy ALL data from application db. All data will be losted!');
		console.log('Clearing app state...');
		
		let dir = null;
		
		try {
			dir = fs.readdirSync( stateDbPath );
			 
			_.each(dir, function(f){
				console.log('remove file: ' + f + '... ok');
				
				fs.unlinkSync( stateDbPath + '/' + f);			
			});
			
			//maybe not remove all
			//fs.rmdirSync( stateDbPath );
		}catch(e){
			//already deleted?
		}
		finally {
			/*
			ssdb.flushdb('', function(err){
				if (!err){
					console.log('SSDB, data storage, flushed OK');					
				}
			});*/
		}
		
		console.log('All app DB cleared and removed... OK\n\n');
	}
	
	//reverto <nubblock>
	if (process.argv.indexOf('--reverto') != -1){
		console.log( 'WARN:  Manual revert appState to new height');
		
		let _t = Math.abs( parseInt( process.argv[ process.argv.indexOf('--reverto')+1 ] ) );
		
		manualRevertTo = _t;				
	}
	
	//save throttle
	if (process.argv.indexOf('--savesync') != -1){
		console.log( 'INFO:  Manual save sync ');
		
		let _t = Math.abs( parseInt( process.argv[ process.argv.indexOf('--savesync')+1 ] ) );
		
		if (_t > 100)
			_t = 20;
		
		dbSyncThrottle = _t;				
	}	
	

//Try to open private Key of node or create if no exists
let nodePrivKey = null;

//Open datasource keys 
//@todo: add it to Genesis.json
const sourceKeys	= JSON.parse( fs.readFileSync('/opt/tendermint/app/datasource.keys.json', {encoding:'utf8'}) );

//options for RocksDB
const rocksOpt = {
	createIfMissing: true,
	errorIfExists: false,
	compression: 1,  //'kSnappyCompression',
	
	//compression_per_level: 1, 
	bottommost_compression: 1, //'kSnappyCompression',
	//kSnappyCompression
	
	maxOpenFiles: -1, //16384,	
	target_file_size_base	: 256 * 1024 * 1024,	
	maxFileSize 			: 256 * 1024 * 1024,
	
	max_background_compactions: 2,
	max_background_flushes: 1,
	
	write_buffer_size: 64 * 1024 * 1024,	
	max_write_buffer_number: 4,
	min_write_buffer_number_to_merge: 2,
	
	level0_file_num_compaction_trigger	: 10,
	level0_slowdown_writes_trigger		: 20,
	level0_stop_writes_trigger			: 40,
	
	max_bytes_for_level_base: 512 * 1024 * 1024,
	memtable_prefix_bloom_bits: 8 * 1024 * 1024,
	
	compression_size_percent: -1,
	
	optimize_filters_for_hits: true,
	level_compaction_dynamic_level_bytes: true,
	
	block_cache: 512 * 1024 * 1024,
	allow_os_buffer: true,
	
	block_size: 16 * 1024
	
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

//var totalNewQuotes = 0;

//test version of lib
let indexProtocol = {   
	node:{
		configDir: '/opt/tendermint/config', 
		address: '', 
		
		//@todo: decode from config
		pubKey: '',	
		privKey: '',
		
		rpcHost: 'http://localhost:8080', //'http://127.0.0.1:26657', // 'http://localhost:8080',
		rpcHealth: false, //check if local rpc up
	},
	
	apiHttpAgent	:	new http.Agent({
		keepAlive: true,
		timeout: 5000
	}),
	apiHttpsAgent	:	new https.Agent({
		keepAlive: true,
		timeout: 5000
	}),
	rpcHttpAgent	:	new http.Agent({
		keepAlive: true,
		timeout: 15000
	}),
	
	stateDb:	stateDb,
	
	ssdb:	ssdb,
	
	txQueue: [], //queue to send at Commmit msg
	
	dataTxQueue: {}, //queue to store data tx at ssdb, <key> : [json obj...]
	
	accountsStore : {}, //local in-memory account storage 
	
	indexValuesHistory: {}, //store latest data, for each registerd asset index
	
	//@todo: maybe store it at rocksDb? 
	//local storage of latest uncomitted avg quotes
	//store latest N 
	latestAvgStore:[],  //{height: height, hash: hash,  symbol: calcAvg.symbol, data: calcAvg}
		
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
			'blockProposer'	: '', //current block proposer address
			
			'previousAppHash' : '',
						
			//some of settings overall all chain
			//Megre with Genesis.json data at initChain
			'options'		: {
				'indicesFreq'	: {
					'rt'	:	1, 
					'1min'  :	20,
					'5min'  :	100,
					'15min' :	300,
					'1h'    :	1200,
					'3h'	:	3600, 
					'12h'	:	14400,
					'eod'	:	null,	//@todo realize it
					'eow'	: 	null	//@todo realize it
				},
				
				historyPoints: 32768  // indexValuesHistory
			},
			
			'dataSource': {},
			
			'validatorStore':{}, //state of validators balances, emission of each block. Balances ONLY at nativeSymbol

			'assetStore'	:	{}, //symbols registry DB
			
			//simple accounts store, only address
			'accountStore'	:	[ ] //user accounts addresses
		};
	},
	//'latestAvg'		: null,	//latest avg data	
	lastAvg		: null,	//latest avg data	
	
	eventsSubscribe: function(){
		//events.on('blockCommit', indexProtocol.blockCommitHandler);
		
		events.on('dbReady', indexProtocol.loadState);
		
		//events.on('appStateRestored', indexProtocol.startTendermintNode);
		
		events.on('appStateRestored', indexProtocol.startAbciServer);
	},
	
	//some handlers
	loadState: function(){
		
		//Sync load current node Validators address
		//@todo: use config path
		let privVal = fs.readFileSync(indexProtocol.node.configDir + '/priv_validator_key.json', {encoding:'utf8'});
				
		if (privVal){
			privVal = JSON.parse(privVal);
			
			if (privVal.address)
				indexProtocol.node.address = privVal.address.toLowerCase();
			
			console.log('My validator\'s address: ' + indexProtocol.node.address);
			
			try {
				nodePrivKey = fs.readFileSync('./account.json', {encoding: 'utf8'});
			}catch(e){
				console.log('Error while read account file: ' + e.message);
			}

			if (nodePrivKey){
				nodePrivKey = JSON.parse( nodePrivKey );
				
				if (nodePrivKey && nodePrivKey.address && nodePrivKey.privKey){
					//getting pubKey
					let 	_ecdh = crypto.createECDH('secp256k1');
							_ecdh.setPrivateKey( Buffer.from(nodePrivKey.privKey, 'hex') );

					nodePrivKey.pubKey = secp256k1.publicKeyConvert( _ecdh.getPublicKey(), true ).toString('hex');
				}
			}

			if (!nodePrivKey){
				console.log('***** WARNING! No account key (file: .account.json) *****');
				console.log('New account key (private key) will be created and store');

				let 	_ecdh = crypto.createECDH('secp256k1');
						_ecdh.generateKeys();
					
				let privKey = _ecdh.getPrivateKey();
				let pubKey 	= _ecdh.getPublicKey();
					pubKey = secp256k1.publicKeyConvert( pubKey, true );
				
				let hash = crypto.createHash('ripemd160').update( crypto.createHash('sha256').update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

				let address = 'indxt' + bs58.encode( hash );
				
				nodePrivKey = {
					address 	: address, 
					taddress 	: indexProtocol.node.address, 
					name		: address, 
					privKey		: privKey.toString('hex'), 
					pubKey		: pubKey.toString('hex'),
					
					generate	: 'auto',
					genDate		: moment().toISOString()
				};
				
				fs.writeFileSync( 'account.json', JSON.stringify( nodePrivKey ), {encoding: 'utf8'});
				
				console.log('Stored at ./account.json');
				console.dir( nodePrivKey, {depth: 2, colors: true});	
				console.log('IMPORTANT: Keep save this data. Do NOT share it!');
			}	

			if (!nodePrivKey || !nodePrivKey.address || !nodePrivKey.privKey || !nodePrivKey.pubKey){
				console.log('Invalid account key. Not possible to work without account key file');
				process.exit(0);
			}
			else {
				console.log('    ');
				console.log('Account address: ' + nodePrivKey.address);
				console.log('Account pubKey: ' + nodePrivKey.pubKey);
				console.log('    ');
				console.log('    ');
				
				
				indexProtocol.node.pubKey = nodePrivKey.pubKey;
				indexProtocol.node.privKey = nodePrivKey.privKey;
			}
			
			
			
			
			
		}
		else {
			console.log('ERROR: Can\'t load file priv_validator_key.json from ' + indexProtocol.node.configDir);
			process.exit(1);
		}
		
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
					
					//@todo remove after full update
					//if ( typeof( appState.accountStore ) != 'array' )
					//	appState.accountStore = [];
					
					if (process.argv.indexOf('dumpappstate') != -1){
						
						console.dir( appState, {depth:64, colors:true} );					
						
						process.exit();
					}

//TEST
//appState.blockHeight = 99999;
					console.log('Found: ' + appState.accountStore.length + ' accounts. ');
					
					//@todo: check it in parralel and batch (ol limitation of max)
					_.each(appState.accountStore, function(a){
						
						stateDb.get('tbl.accounts.' + a, function(err, val){
							if (!err && val && Buffer.isBuffer(val)){
								let acc = JSON.parse( val.toString('utf8') );
								
								if (acc){
									
									acc.pubKeyComp = secp256k1.publicKeyConvert( Buffer.from(acc.pubKey, 'hex'), true ).toString('hex');
									
									if (!acc.tx)
										acc.tx = [];
									/*
									acc.pubKeyComp = crypto.ECDH.convertKey( Buffer.from(acc.pubKey, 'hex'),
										'secp256k1',
										'hex',
										'hex',
										'compressed');	
									*/

									indexProtocol.accountsStore[ a ] = acc;
								}
							}
						});
						
					});
					
					//check it 
					let calcAppHash = indexProtocol.calcHash( JSON.stringify(appState), false);
					
					//load last appHash 
					stateDb.get('appHash', function(err, val){
						if (!err && val && Buffer.isBuffer(val)){
							let loadedAppHash = val.toString('utf8');			

							console.log('Checking hash integrity...');
							console.log('loaded AppHash: ' + loadedAppHash);
							console.log('rehash AppHash: ' + calcAppHash);
							
//@todo DISABLE FOR DEV hash eq check
							if (loadedAppHash === calcAppHash){
								appState.appHash = calcAppHash;
								
								console.log('State loaded OK\n');
								
								//Ready to GO
								events.emit('appStateRestored');
										
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
			hash.update( /*JSON.stringify(appState)*/ data );
		
		if (returnRaw === true)
			return hash;
		else
			return hash.digest('hex');
	},
	
	startAbciServer: function(){
		
		/*
		console.log('Starting datafeed Oracle service...');
								
			indexProtocol.feed.fetchAll();
								
		console.log('');
		*/
		
		console.log('ABCI Server starting...');

		server.listen('/opt/tendermint/tendermint.socket', function(){
			console.log('ABCI server started OK');
			
			//run periodical check local RPC 
			setInterval(function(){
				fetch(indexProtocol.node.rpcHost + '/health', {agent: indexProtocol.rpcHttpAgent})
					.then(res => res.json())
					.then(function(json){
						if (json && json.result && !json.error){
							if (indexProtocol.node.rpcHealth === false){
								indexProtocol.node.rpcHealth = true;
								
								console.log('');
								console.log('[INFO] local node RPC interface now online at: ' + indexProtocol.node.rpcHost);
								console.log('');
								
								
								console.log('Starting datafeed Oracle service...');
								
									indexProtocol.feed.fetchFeeds();
									//indexProtocol.feed.fetchIndices();
								
								console.log(''); 
							}						
						}
							
					}).catch(_.noop);
			}, 1000);
			
			events.emit('AbciServerStarted');
			
			
		}).on('error', function(e){
			console.debug( e );
		}).on('close', function(e){
			console.log('Tendermint connection close!');
		});
		

	},
	
	blockCommitHandler: function(height){
		//if length of blocks more then 900
		if (appState.blockStore.length == storeLatestBlocks){
			
			let calcAvg = {
				symbol				: 'BTC/USD',	//for testnet only
				
				blockHeight			: height, 
				blockHash			: appState.blockHash,
				blockCommit			: 0, //0 for verify
							
				txMerkleRoot		: '', //Merkle root from tx, included in
								
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
				
				//todo: include decoded all tx? or only Merkle root? 
				
				//@use Tendermint's key from config
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
					calcAvg.openPrice 	= tmp.vwapPrice;
					calcAvg.openAmount 	= tmp.totalAmount;
					calcAvg.openVolume 	= tmp.totalVolume;
					calcAvg.openTime   	= tmp.blockTime;
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
			
			let _blockHashes = [];
			let _blockIds = [];
			
			calcAvg.blocksIncluded.forEach(function(v){
				if (v.hash) {
					_blockHashes.push( v.hash );
					_blockIds.push( v.height );
				}
			});
			
			_blockIds.sort();
			//optimize for smallest tx size
			calcAvg.blocksIncluded = _blockIds;
			
			if (_blockHashes && _blockHashes.length > 0){
			
				const tree = new MerkleTree(_blockHashes, sha256, {isBitcoinTree: true});
				calcAvg.txMerkleRoot = tree.getRoot().toString('hex');
				
				//store all Merkle Tree
				//@todo: add creation from stored
				//calcAvg.merkleTree = tree.getLayersAsObject(); 
			}
			
			//hash this 
			let hash = sha256( JSON.stringify(calcAvg) ).toString('hex');
						
//console.dir( calcAvg, {depth: 16, colors: true}); 
//process.exit();

			//check history 
			if (indexProtocol.latestAvgStore.length > storeLatestAvgBlocks){
				//delete first 
				delete indexProtocol.latestAvgStore.shift();
			}
			
			//store 
			indexProtocol.latestAvgStore.push({height: height, hash: hash,  symbol: calcAvg.symbol, data: calcAvg});
			
			indexProtocol.lastAvg = calcAvg;
		}
	},
	
	processDelayedTask: function( height ){
		if (delayedTaskQueue.length > 0){
			_.each(delayedTaskQueue, function(v, i){
				if (v && v.exec){
					if (v.exec == 'tbl.system.rewards')
						indexProtocol.processValidatorsBlockReward( v, height );
					
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
	
	//check, if we proposer
	isProposer: function( address, height ){
		if (!address || !_.isString(address) || indexProtocol.node.address == '' || !indexProtocol.node.address) return false; 
		
		//
		if ( address.toLowerCase() === indexProtocol.node.address ){
			console.log( '\nWE are Proposer of height: ' + height + '\n' );
			
			return true;
		}
		
		return false;		
	},
	
	//Prepare TX with AVG calculated info, only if we are proposer
	prepareCalculatedRateTx: function( data ){
		if (!data) return false;
//console.dir( data );		
		let _code = 'avg'; //type of TX, prefix
		
		//using deterministic stringify
		let json  = JSON.stringify( data ); 
		//use gzip?
		/* @todo: realize sign avg quote */
		let _hash = sha256( json ).toString('hex');
		
		//todo: Add sign with private key of me (Validator)
		//store at tx as separated part (code:hash:signature:pubkey:flags:txbody)			
		let tx = _code + ':' + _hash + '::::' + Buffer.from(json, 'utf8').toString('base64');
//console.dir( tx );

		indexProtocol.txQueue.push( tx );		

		//====
		//adding to local store for index token 
		let q = {
				id		: 0,
				symbol	: 'BTCUSD_COININDEX',
				asset	: 'BTC',
				cur		: 'USD',
				type	: 'IND', //index
				side	: '',
				ts		: appState.blockTime,
				excode	: 'coinindex',
				amount	: 1000000,
				total	: 0,
				price	: data.avgPrice
		};
					
		let qhash = sha256( JSON.stringify(q) );
					
		let sign = secp256k1.sign(qhash, Buffer.from(nodePrivKey.privKey, 'hex')).signature.toString('hex');
					
		let tx = 'aiv:' + qhash.toString('hex') + ':' + sign + ':' + nodePrivKey.pubKey +':'+appState.blockHeight+':' + Buffer.from( JSON.stringify( {symbol: q.symbol, data: q} ), 'utf8').toString('base64');
					
		indexProtocol.txQueue.push( tx );	
		
				
		
		//return tx;		
	},

	
	//TEST: check stored index and prepare tx for index tokens
	updateIndexTokens: function(){
		let it = []; 
		
		//check availables index tokens 
		_.each(appState.assetStore, function(v){
			if (v.type == 'index' && v.family == 'IND' && v.standart == 'IDX42'){
				it.push( v );
			}
		});
		
		//run it 
		it.forEach(function(v){
			let data = null; 
			/**
			if (v.symbol == 'BTCUSD_COININDEX'){
				data = indexProtocol.lastAvg.avgPrice;
			}
			else **/
			if (v.symbol == 'BTCUSD_BPI'){
				data = appState.dataSource[ 'IND:coindesc:BTC/USD_BPI' ];
			}
			else
			if (v.symbol == 'BTCUSD_CF_RTI'){
				data = appState.dataSource[ 'IND:cryptofacilities:CME CF Real-Time Indices' ];
			}
			else
			if (v.symbol == 'BTCUSD_CGI'){
				data = appState.dataSource[ 'IND:coingecko:BTC/USD' ];
			}
			else
			if (v.symbol == 'BTCUSD_CF_REF'){
				data = appState.dataSource[ 'IND:cryptofacilities:CME CF Reference Rates' ];
			}
			else
			if (v.symbol == 'BTCUSD_CCI'){
				data = appState.dataSource[ 'IND:cryptocompare:BTC/USD' ];
			}
			else
			if (v.symbol == 'BTCUSD_CMC'){
				data = appState.dataSource[ 'IND:coinmarketcap:BTC/USD' ];
			}
			else
			if (v.symbol == 'BTCUSD_BCH_24HWA'){
				data = appState.dataSource[ 'IND:bitcoincharts:BTC/USD_24HWA' ]; 
			}	
			
			//create multisig tx with data 
			if (data && nodePrivKey.privKey && data.pubKey){
				
//console.dir( data, {depth:16});
				let hash = sha256( JSON.stringify(data) );
				//use addition sign = with proposer 
				let sign2 = secp256k1.sign(
					hash, 
					Buffer.from(nodePrivKey.privKey, 'hex')
				).signature.toString('hex');
				
				//code:hash:sign:pubkey:flags:data
				//sign: sign1,sign2, pubkey: pk1,pk2   
				//flag msig == multisig tx 
				let tx = 'aiv:' + data.hash + ':' + data.sign + ',' + sign2 + ':' + data.pubKey + ',' + nodePrivKey.pubKey + ':'+appState.blockHeight+':' + Buffer.from( JSON.stringify( {symbol: v.symbol, data: data.data} ), 'utf8').toString('base64');
				
//console.log( 'tx: ' + tx );
				
				indexProtocol.txQueue.push( tx );	
				
			}
			
		});



		
	},
	
	//parse raw tx from Tendermint (as a buffer)
	//based on tx-spec.txt 
	//return false if error 
	parseTx: function( rawTx ){
		if (!rawTx || !Buffer.isBuffer( rawTx ))
			return false;
		
		let tx = null;
		
		if (Buffer.isBuffer( rawTx ))
			tx 		= rawTx.toString('utf8');
		else
			tx 		= rawTx.trim();
		
//console.log( tx );
		
		if (!tx) return false;
		
		/*
		Global structure: 

		<code>:<version:1>:<ApplyFromTs:0>:<ApplyOnlyAfterHeight:0>:<Hash(Sha256)>:<CounOfSign:1>:<Signature:S1>:<PubKey(Compres)>:<Data/Base64>

		Code: 

		protocol.<native tx, must be processed>

		data.src.trades   (can be 2 formats: short, code:version:hash:data and full (with all fields)
		data.src.index    (only full variant)
		data.index - comitted by proposal <immediate process>
		*/
		let z  = tx.split(':');
		
//console.dir( z, {depth:8, colors: true});
		
		
		if (z.length != 9) return false; //minimal length
		
		let txObj = {
			code		: 'unknown',
			version		: 1,
			applyTx		: 0, //immediate
			applyHeight : 0, 
			hash		: null,
			multiSigns	: 1, //count of signatures for tx
			sign		: false,
			pubKey		: false,
			
			data		: null, //json-decoded data
			dataRaw		: null			
		}
		
		if (z[0]) txObj.code = z[0].trim();
		
		txObj.version = parseInt(z[1]);
				
		txObj.applyTx = parseInt(z[2]);
		txObj.applyHeight = parseInt(z[3]);
		
		txObj.hash = z[4].trim();
		
		txObj.multiSigns = parseInt(z[5]);
		
		txObj.sign = z[6].trim();
		txObj.pubKey = z[7].trim();
		
		txObj.dataRaw = z[8].trim();
				
		if (txObj.dataRaw){
			txObj.data = JSON.parse( Buffer.from(txObj.dataRaw, 'base64').toString('utf8') );
		}
		
		//check Sign and Pubkey 
		if (txObj.pubKey && secp256k1.publicKeyVerify( Buffer.from(txObj.pubKey, 'hex') ) != true ){
			
			console.log('ERROR: publicKeyVerify false');
			return false;
		}
		
		if (txObj.pubKey && !txObj.sign){
			console.log('ERROR: !txObj.sign');
			return false;
		}
		
		if (txObj.hash != sha256( JSON.stringify(txObj.data) ).toString('hex')){
			console.log('ERROR: Invalid hash: ' + txObj.hash + ', calcs: ' + sha256( txObj.dataRaw ).toString('hex') );
			
			return false;
		}
		
//console.dir( txObj, {depth:8, colors: true});
		
		return txObj;		
	},
	
	
	feed: {
		txQueue: [],
		totalNewQuotes : 0, 
		tradeSource: {
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
			//'Gatecoin'	:	'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=50',
			'WavesDEX'	:	'https://marketdata.wavesplatform.com/api/trades/BTC/USD/50',
			'Bitsane'	:	'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=50',
			'Bitlish'	:	'https://bitlish.com/api/v1/trades_history?pair_id=btcusd',
			'Bisq'		:	'https://markets.bisq.network/api/trades?market=btc_usd&limit=50&format=json&sort=desc',
			'Coingi'	:	'https://api.coingi.com/current/transactions/btc-usd/50',
			'CoinbasePro'	:	'https://api.pro.coinbase.com/products/BTC-USD/trades',
			'RightBTC'	:	'https://www.rightbtc.com/api/public/trades/BTCUSD/50',
			'Kraken'	:   'https://api.kraken.com/0/public/Trades?pair=xbtusd' 	
		},
		
		//important: only free (unlimited) sources, without api keys 
		indexSources : {
			'cryptoFacilities'  :	'https://www.cryptofacilities.com/derivatives/api/v3/tickers',
			'coinDesc'			:	'https://api.coindesk.com/v1/bpi/currentprice/USD.json',
			'coinGecko'			:	'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true'
		},
		
		fetchFeeds: function(){			
			let _sources = {};
			let fetchAtOnce = 4;
			
			let a 	= _.allKeys( indexProtocol.feed.tradeSource ); //.keys();
			let b 	= _.shuffle( a ) ;
			let tmp = b.slice(0, fetchAtOnce)
			
			tmp.forEach( function(c){
				_sources[ c ] = indexProtocol.feed.tradeSource[ c ];
			} );
			
			//adding indices at every round
			_.each( indexProtocol.feed.indexSources, function(v, c){
				_sources[ c ] = v;
			});
			
			console.log('\nOracle trades/indices from: ' + _.allKeys(_sources).join(', ') + '\n');
						
			//console.log('Current time: ' + new Date(ts).toGMTString() );
			const t1 = process.hrtime();
			indexProtocol.feed.totalNewQuotes = 0;
			
			//use async.js 	
			async.eachOfLimit(
				_sources, 
				3, //fetchAtOnce, //at parralel
				indexProtocol.feed.processDatafeed, 
				function(err){
					const tf = process.hrtime( t1 );
			
					console.log('Total new trades: ' + indexProtocol.feed.txQueue.length + ' (from ' + _.size(indexProtocol.feed.tradeSource) + ' sources), processed by ' + prettyHrtime(tf));
					//console.log('\n');
					
					
					async.eachOfLimit(
						indexProtocol.feed.txQueue,
						3,
						indexProtocol.feed.sendDataSrcTradesTx,
						function(e){
							console.log('HTTP all broadcast_tx sended OK');
							
							indexProtocol.feed.txQueue = [];
							
							setTimeout(function(){
								indexProtocol.feed.fetchFeeds();
							}, 5 * 1000);
						}
					);
				}
			);
		},
	
		processDatafeed: function(url, src, cb){
			if (!url || !src) return;
			
			fetch(url, {agent: indexProtocol.apiHttpsAgent, follow: 3, timeout: 5000})
				.then(function(res){
					if (res.ok)	 
						return res;
					else 
						throw Error(res.statusText);
				})
				.then(res => res.json())
				.then(function(data){
					let bodyHash = sha256( JSON.stringify( data ) ).toString('hex');
					
					return new Promise(function(resolve, reject){
						//check latest hash 
						stateDb.get('tbl.datafeed.' + src.toLowerCase() + '.bodyHash', function(err, val){
							if (!err && val && Buffer.isBuffer(val)){
								val = val.toString('utf8');
								
								if (val === bodyHash){
									//console.log( src + ' - no updates from perviosly loaded body ('+val+' :: ' + bodyHash+')');
									return reject();
								}
							}
							
							stateDb.put('tbl.datafeed.' + src.toLowerCase() + '.bodyHash', bodyHash, function(err){
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
					let ts = indexProtocol.curTime;
					
					try {			
					switch( src ){
						case 'cryptoFacilities': {
							if (data && data.result == 'success'){
								let a = [];
								
								data.tickers.forEach(function(q){
									if (['in_xbtusd', 'in_xrpusd', 'in_ethusd', 'in_ltcusd', 'in_bchusd', 'rr_xbtusd', 'rr_xrpusd', 'rr_ethusd', 'rr_ltcusd', 'rr_bchusd'].indexOf(q.symbol) != -1){
										a.push( q );
									}
								});
								
								a.forEach(function(q){
									let qt  = new Date( q.lastTime ).getTime();
									let val = parseFloat( q.last );
									let id  = 'cf-' + q.symbol + '-' + qt;
									let z = null;
									
									switch (q.symbol) {
										case 'in_xbtusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'XBTUSD_CFI' );
											//z.
											break;
										}
										case 'in_xrpusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'XRPUSD_CFI' );
											z.asset = 'XRP';
											break;
										}
										case 'in_ethusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'ETHUSD_CFI' );
											z.asset = 'ETH';
											break;
										}
										case 'in_ltcusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'LTCUSD_CFI' );
											z.asset = 'LTC';
											break;
										}
										case 'in_bchusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'BCHUSD_CFI' );
											z.asset = 'BCH';
											break;
										}
										case 'rr_xbtusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'BCHUSD_CFRR' );
											z.asset = 'BTC';
											break;
										}
										case 'rr_xrpusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'XRPUSD_CFRR' );
											z.asset = 'XRP';
											break;
										}
										case 'rr_ethusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'ETHUSD_CFRR' );
											z.asset = 'ETH';
											break;
										}
										case 'rr_ltcusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'LTCUSD_CFRR' );
											z.asset = 'LTC';
											break;
										}
										case 'rr_bchusd': {
											z = indexProtocol.feed.makeQuote(id, qt, val, 1, '', 1, 'index', 'BCHUSD_CFRR' );
											z.asset = 'BCH';
											break;
										}
										default: {
											break;
										}										
									}
									
									if (z){
										newQuotes.push( z );	
									}								
								});					
								
							}				
							
							break;
						}
						case 'coinDesc' : {
							if (data && data.bpi && data.bpi.USD){
								let qt = 0;
									qt = new Date( data.time.updatedISO ).getTime();
									
								let z = indexProtocol.feed.makeQuote('bpi-' + qt, qt, parseFloat( data.bpi.USD.rate_float ), 1, '', 1, 'index', 'BTCUSD_BPI' );
										
								if (z) newQuotes.push( z );	
							}
														
							break;
						}
						case 'coinGecko': {
							if (data && data.bitcoin && data.bitcoin.usd){
								let qt = new Date( data.bitcoin.last_updated_at * 1000 ).getTime();
								
								let z = indexProtocol.feed.makeQuote('cg-' + data.bitcoin.last_updated_at, qt, parseFloat( data.bitcoin.usd ), 1, '', 1, 'index', 'BTCUSD_CGI' );
										
								if (z) newQuotes.push( z );
							}							
							
							break;
						}
						
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
										
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
									
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.size ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
										
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
									
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
									
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side, parseFloat(q.amount));
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
										
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
									
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.SecondaryCurrencyTradePrice ), parseFloat( q.PrimaryCurrencyAmount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
							
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.quantity ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
							
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side, parseFloat( q.volume ));
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.amount ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price ), parseFloat( q.size ), side);
										
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
								
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q.price/100000000 ), parseFloat( q.amount/100000000 ), side);
										
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
							
										let z = indexProtocol.feed.makeQuote(id, qt, parseFloat( q[0] ), parseFloat( q[1] ), side);
										
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
						stateDb.get('tbl.datafeed.' + src.toLowerCase() + '.cachedIds', function(err, val){
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
							if (val.length > maxIdsAtCache)
								val = val.slice(0, maxIdsAtCache);
							
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
						//console.log('\n\n\n');
						//console.dir( resultQuotes );		
						
						indexProtocol.feed.totalNewQuotes += resultQuotes.length;
						
						let sourceKey = sourceKeys.keys[ src.toLowerCase() ];
					
						if (!sourceKey){
							console.log( src + ' - WARNING. No keys for Data Provider');
							return;
						}
						//add signatures = from source and node 
						resultQuotes.forEach(function(rate){
							//console.log('Sign trade for ' + src );	
							//indexProtocol.feed.signTrade(rate, src, sourceKey.privKey, sourceKey.pubKey, nodePrivKey.privKey, nodePrivKey.pubKey)
							
							process.nextTick(indexProtocol.feed.signTrade, rate, src, sourceKey.privKey, sourceKey.pubKey, nodePrivKey.privKey, nodePrivKey.pubKey);
							
						});
						
						//saveOps.push({ type: 'put', key: 'tbl.datafeed.' + src.toLowerCase() + '.cachedIds', value: JSON.stringify(resq[1]) });
						return new Promise(function(resolve, reject){
							
							stateDb.put('tbl.datafeed.' + src.toLowerCase() + '.cachedIds', JSON.stringify(resq[1]), function(err){	
								if (err) throw new Error( err );
								
								return resolve();
							}); 
						});
						
					}		
				}).catch(function(e){
					if (e){
						console.dir('Error ('+src+'): ' + e.message, {colors:true}); 
					}	
				}).finally(function(){
					//console.log( src + ' - finally processing.');
					
					if (cb && _.isFunction(cb))
						cb();
				});
		},
		
		makeQuote: function(id, ts, price, amount, side, total, type, symbol){
			let tot = Math.trunc( price * amount * fixedExponent );
			if (total)	tot = Math.trunc( total * fixedExponent );
	
		//	console.log( ts + ' :: ' + new Date( ts ).toUTCString() );
			if (!type || type == 'trade'){
				type = 'FX/Spot';
			}
			else
			if (type == 'index'){
				type = 'INDEX';
			}
			
			if (!symbol)	symbol = 'BTC/USD';
			
			return {
				id		: new String(id).toLowerCase().trim().toString(),
				ts 		: ts,
				symbol 	: symbol,
				asset	: 'BTC',
				cur		: 'USD',
				type	: type, //'FX/Spot',
				side	: side,
				price	: Math.trunc( price * fixedExponent ),
				amount	: Math.trunc( amount * fixedExponent ),
				total	: tot
				//_dtx	: new Date(ts).toUTCString()
			};	
		},

		signTrade: function(rate, src, sourcePrivKey, sourcePubKey, nodePrivKey, nodePubKey){
			if (!sourcePrivKey || !sourcePubKey || !nodePrivKey || !nodePubKey) return;
				
			//hash this 
			let hash = sha256( JSON.stringify( rate ) );
			let source = src.toLowerCase();
	
			//lets sign this 
			let sourceSign = secp256k1.sign(hash, Buffer.from(sourcePrivKey, 'hex')).signature.toString('hex');
			
			let obj = {
				sign		:	sourceSign,
				provider 	:	source,
				data		:	rate
			}
			
			//Sign this by node key
			let hash2 = sha256( JSON.stringify( obj ) );
			let nodeSign = secp256k1.sign(hash2, Buffer.from(nodePrivKey, 'hex')).signature.toString('hex');
			
			//<code>:<version:1>:<ApplyFromTs:0>:<ApplyOnlyAfterHeight:0>:<Hash(Sha256)>:<CounOfSign:1>:<Signature:S1>:<PubKey(Compres)>:<Data/Base64>
			let txCode = 'data.src.trades';
			
			if (rate.type == 'INDEX'){
				 txCode = 'data.src.index';
			}		
			
			let tx = txCode + ':1:0:0:' + hash2.toString('hex') + ':1:' + nodeSign + ':' + nodePubKey + ':' + Buffer.from( JSON.stringify( obj ), 'utf8').toString('base64');
			
			indexProtocol.feed.txQueue.push( tx );
			
			//process.nextTick( indexProtocol.feed.sendDataSrcTradesTx, tx );			
		},

		sendDataSrcTradesTx: function( tx, i, cb ){
			let url = 'http://localhost:8080/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime();
			
			if (indexProtocol.node.rpcHealth === false){
				if (cb)
					cb();
				
				return;			
			}
			
			//console.log( url );
			
			fetch(url, {agent: indexProtocol.apiHttpAgent})
				.then(function(res){
					if (res.ok)	 
						return res;
					else 
						throw Error(res.statusText);
				})
				.then(res => res.json())
				.then(function(data){
					//do anything with obtained tx hash
					
					//console.dir( data );
					
					if (data && data.result && data.result.code == 0){
							
					}
				})
				.catch(function(e){
					if (e){
						console.dir('Error at RPC call broadcast_tx: ' + e.message, {colors:true}); 
					}	
				}).finally(function(){
					if (cb) cb();
				});
		}
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
		
		/***
		console.dir( request, {depth: 64, color: true});
		
		let z = crypto.createHash('sha256').update( request.validators[0].pubKey.data ).digest('hex');

		console.dir( z, {depth: 4, color: true});
		
		console.log(' ');
		
		process.exit();
		***/
		
		let chainId = request.chainId;
		
		console.log('Staring new chain with ID: ' + chainId);
		console.log('Try to initialize clear evn for contracts and registry');
		console.log(' ************** IMPORTANT!   CLEAN DB ************** ');		
		
		//default value for appState
		appState = indexProtocol.getDefaultState();

		//process app_state 
		if (request.appStateBytes.length > 1){

			let genesisAppState = JSON.parse( Buffer.from(request.appStateBytes.toString('utf8'), 'base64').toString('utf8') );
			
			//assign options 
			if (genesisAppState.options){
				appState.options = _.extend( appState.options, genesisAppState.options );
			}
			
//console.dir( appState.options, {depth: 16, color: true});
//process.exit(1);
			
			appState.chainId = chainId;
			
			if (genesisAppState.assets){
				
				_.each(genesisAppState.assets, function(v){
					appState.assetStore[ v.symbol ] = v;
					
					saveOps.push({type: 'put', key: 'tbl.assets.' + v.symbol.toUpperCase(), value: JSON.stringify(v)});
					
					console.log('Initial appState: assets symbol ' + v.symbol + ' was registered');
				});
			
			}
			
			if (genesisAppState.accounts){
				
				_.each(genesisAppState.accounts, function(v){
					//@todo: check sign
					let data = JSON.parse( Buffer.from(v.data, 'base64').toString('utf8') );
					
					if (data){
						appState.accountStore.push( data.address );
						
						if (!data.pubKeyComp){
							data.pubKeyComp = secp256k1.publicKeyConvert( Buffer.from(data.pubKey, 'hex'), true ).toString('hex');
							
							saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.pubKeyComp, value: data.address});
						}
						
						//save to global lookup tbl
						//@todo: check it't uniques
						saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.pubKey, value: data.address});
						saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.address, value: data.pubKey});
						//saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.address, value: data.address}); //self to search with any field
						
						if (data.name !== data.address){
							saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.name, value: data.address});
						}
						
						if (data.ids.length > 0){
							_.each(data.ids, function(i){
								if (i && i !== data.address && i !== data.pubKey){
									saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + i, value: data.address});
								}
							});
						}
						
						//if (data.data.assets.length == 0){
						//fix native currency balance 
						data.data.assets[ appState.options.nativeSymbol ] = { amount: 0};
						
						
						//Save to systems accounts 
						indexProtocol.accountsStore[ data.address ] = data;
						
						console.log('Initial appState: accounts with addresses ' + data.address + ' was registered');
					}					
				});
				
			}
			
			//parse initial allocation 
			if (genesisAppState.initialAllocation){
				_.each(genesisAppState.initialAllocation, function(v){
					if (indexProtocol.accountsStore[ v.to ] && appState.assetStore[ v.symbol ]){
						
						/*
						let t = _.find( indexProtocol.accountsStore[ v.to ].data.assets, function(z){ if (z.symbol === v.symbol) return true; });
						
						if (t){
							t.amount = t.amount + v.amount;
						}
						else
							indexProtocol.accountsStore[ v.to ].data.assets.push( {symbol: v.symbol, amount: v.amount} );
						*/
						indexProtocol.accountsStore[ v.to ].data.assets[ v.symbol ] = { amount: v.amount };
						console.log('Initial appState allocation: to ' + v.to + ', asset ' + v.symbol + ', amount ' + v.amount);
					}
					else {
						//@todo: what to do with "unallocated address"
					}
				});
			}

			//save accounts 
			_.each(indexProtocol.accountsStore, function(v, i){
				saveOps.push({type: 'put', key: 'tbl.accounts.' + v.address, value: JSON.stringify( v )});
			});
			
			console.log(' ');
			console.log('Processing genesis OK');
			console.log(' ');
			console.log(' ');
			console.log(' ');
			
			return new Promise(function(resolve, reject){
				return resolve({code: 0, validators: []});
				/*
				indexProtocol.ssdb.flushdb('', function(err){
					if (!err){
						console.log('SSDB, data storage, flushed OK');					
					}
					
					return resolve({code: 0, validators: []});
				});
				*/
			});
		}
		
		return {
			code: 0,
			validators: [] //use validators list, defined by genesis.json
		};		
	},	
  
	info: function(request) {
		console.log('INFO request called');
		console.dir( request, {depth:4} );
		
		//@todo optimize it
		//@todo: open question - how to upgrade network node?
		stateDb.put('appVersion', appState.appVersion, function(err){});
		stateDb.put('version', appState.version, function(err){});
		
		let responce = {
			data: 'INDEXProtocol App#Testnet-01',
			
			version: appState.version, 
			appVersion: appState.appVersion,
			
			lastBlockHeight: appState.blockHeight - manualRevertTo
			//lastBlockAppHash: appState.appHash  //now disable for debug
		};
		
		//console.log('Restored from DB latest snapshot');
		//console.dir( [appState.version, appState.appVersion, appState.blockHeight], {depth:4} );

		return  responce;
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

			if (['tbl.accounts.all', 'tbl.assets.all', 'tbl.assets.info'].indexOf(path) != -1)			
				return queryHandlers.doQuery(path, data, appState, indexProtocol);

			//@todo: use browser-based account generation
			//@todo2: add HD and seed-based account 
			if (path === 'generatenewaccount'){
				//generate new account (without safe)
				const 	ecdh 	= 	crypto.createECDH('secp256k1');
						ecdh.generateKeys();
		
				let privKey = ecdh.getPrivateKey();
				let pubKey = ecdh.getPublicKey();
				let address = '';

				//let sha256 = crypto.createHash('sha256');
				let ripemd160 = crypto.createHash('ripemd160');
				let hash = ripemd160.update( sha256( pubKey.toString('hex') ) ).digest(); // .digest('hex');

					address = appState.options.addressPrefix + bs58.encode( hash );
					
				//simple check 
				if (appState.accountStore[ address ])
					return {code: 1}; 
			
		console.log('===========================');
		console.log('Blockchain Height: ' + appState.blockHeight);
		console.log('Generate new account (TEST):');
		console.log('privateKey: ' + privKey.toString('hex'));
		console.log('publicKey:  ' + pubKey.toString('hex'));
		console.log('wallet address: ' + address);
		console.log('===========================');
		
		
				let accObj = {
					ids					:[address], 	//array of any string-based ids (global uniq!) associate with account
					name				: address,		//main name, if associated		
					address				: address,
					createdBlockHeight	: 0,
					updatedBlockHeight  : 0,
					type				: 'user',
					nonce				: 0, //count tx from this acc
					data				: {
						assets				: [],
						messages			: [],
						storage				: []
					},
					pubKey				: pubKey.toString('hex')
				};
				
				let json = JSON.stringify( accObj );
		
				//create Tx to register new account 
				//using deterministic stringify
				let _hash = crypto.createHash('sha256').update( json ).digest();
				let signature = secp256k1.sign(_hash, privKey).signature;
		
				//store at tx as separated part (code:hash:signature:pubkey:flags:txbody)			
				let tx = 'reg:' + _hash.toString('hex') + ':'+signature.toString('hex')+':'+pubKey.toString('hex')+'::' + Buffer.from(json, 'utf8').toString('base64');
				
				//console.log( '   ' );
				//console.log( tx );
				//console.log( '   ' );
				
				return new Promise(function(resolve, reject){
					
					http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:indexProtocol.rpcHttpAgent}, function(resp){
						
						//console.dir( resp, {depth: 16} );
					
						
						return resolve({code: 0, value: Buffer.from(JSON.stringify( {
							address: address,
							pubKey:	pubKey.toString('hex'),
							privKey: privKey.toString('hex')		
						} ), 'utf8').toString('base64')});
						
					}).on('error', (e) => {
					  console.error(`Got error: ${e.message}`);
					  
					  return resolve({code: 1, value: Buffer.from(e.message, 'utf8').toString('base64')});
					});
					
				});
			}
			else
			if (path === 'getavgtx'){
				let _height = parseInt( data.toString('utf8') );
				
				if (!_height)
					return { code: 0 };
				
				if (_height > appState.blockHeight)
					return { code: 0 };
				
				return new Promise(function(resolve, reject){
					
					stateDb.get('tbl.block.'+_height+'.avg', function(err, val){
						//console.dir( err, {depth:2} );	
						//console.dir( val, {depth:2} );	
						
						if (!err && val){
							console.log('Query fetch: avg tx from block #' + _height);
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );   
						}
						else {
							//check local version if no comitted
							let localCopy = _.find(indexProtocol.latestAvgStore, function(v){
								if (v.height == _height /*@todo&& v.symbol == data.symbol*/)
									return true;
								else
									return false;
							});
							
							if (localCopy && localCopy.data){
								return resolve( {code: 0, value: Buffer.from(JSON.stringify(localCopy.data), 'utf8').toString('base64')} );
							}
							else {
								console.log('ERROR: No commited and NO local AVG fro height: ' + _height);
							}
							
							return resolve( {code:1} );
						}
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
							return resolve( {code:1} );
					});
					
				});				
			}
			else
			if (path === 'getappstate'){
				//only latest
				//@todo: save full appState per height
				return new Promise(function(resolve, reject){
					
					stateDb.get('appState', function(err, val){
						if (!err && val && Buffer.isBuffer(val)){
							val = val.toString('utf8');								
							
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );
						}
						else
							return resolve( {code:1} );
					});
					
				});				
			}
			else
			if (path === 'tbl.assets.index.latest'){
				let symbol = data.toString('utf8');
				
				console.log('Request latest index value for symbol: ' + symbol);
				
				if (!appState.assetStore[ symbol.toUpperCase() ]){
					return {code: 1};
				}
				
				let ass = appState.assetStore[ symbol.toUpperCase() ];
				let latVal = null;
					
				if (ass.type === 'index'){
					latVal = {
						symbol: ass.symbol,
						changesByPrevios: ass.changesByPrevios,
						initDataValue: ass.initDataValue,
						latestDataValue: ass.latestDataValue,
						latestUpdateHeight: ass.latestUpdateHeight,						
						txCount: ass.tx.length
					}
				}
				
				return {code: 0, value: Buffer.from(JSON.stringify( latVal ), 'utf8').toString('base64')};
			}
			else
			if (path === 'tbl.assets.index.history'){
				let symbol = data.toString('utf8');
				
				console.log('Request history index value for symbol: ' + symbol);
				
				if (!appState.assetStore[ symbol.toUpperCase() ]){
					return {code: 1};
				}
				
				let ass = appState.assetStore[ symbol.toUpperCase() ];
				let valuesHistory = [];
					
				if (ass.type === 'index'){
					valuesHistory = indexProtocol.indexValuesHistory[ symbol ];
				}
				
				return {code: 0, value: Buffer.from(JSON.stringify( valuesHistory ), 'utf8').toString('base64')};
			}
			else
			if (path === 'tbl.accounts.info'){
				
				if (data.length === 0){
					return {code: 1 };
				}
				
				let address = data.toString('utf8');
				
				console.log('Request info about: ' + address);
				
				//check it 
				if (appState.accountStore.indexOf( address ) === -1){
					return {code: 403 };
				} 
				
				return new Promise(function(resolve, reject){
					
					if (indexProtocol.accountsStore[ address ]){
						let account = indexProtocol.accountsStore[ address ];
					
						//@todo: pre-process address
						//console.log('Account data in memory cache!');
						
						if (!account.pubKeyComp){
							//add compressed public key 
							//const 	ecdh 	= 	crypto.createECDH('secp256k1');
							
							account.pubKeyComp = secp256k1.publicKeyConvert( Buffer.from(account.pubKey, 'hex'), true ).toString('hex');
							
							/*
							crypto.ECDH.convertKey( Buffer.from(account.pubKey, 'hex'),
								'secp256k1',
								'hex',
								'hex',
								'compressed');
							*/	
							console.log('Uncompressed key: ' + 	account.pubKey);
							console.log('Compressed key: ' + 	account.pubKeyComp);
						}
						
						//fetch all data about assets 
						_.each(account.data.assets, function(z, symbol){
							if (z && symbol){
								let ass = appState.assetStore[ symbol ];
								
								if (!ass) return;

								let obj = {
									symbol				: ass.symbol,
									dividedSymbol		: ass.dividedSymbol,
									type				: ass.type,
									family				: ass.family,
									standart			: ass.standart,
									name				: ass.name,
									divider				: ass.divider,
									txFee 				: ass.txFee,
									txIssuerFee			: ass.txIssuerFee,
									issuerAddress		: ass.issuerAddress,
									issuerName			: ass.issuerName,
									
									holders				: _.size( ass.holders ),
									
									options				: ass.options						
								};
								
								z.asset = obj;
								// account.data.assets[i].asset = obj;									
							}
						});
												
						return resolve({code: 0, value: Buffer.from(JSON.stringify( account ), 'utf8').toString('base64')});
					}
					
					//restore from disc 				
					stateDb.get('tbl.accounts.' + address, function(err, val){
						if (!err && val){
							console.log('Query fetch: latest account state from addr: ' + address);
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							
							//update local storage memory 
							//@todo: need fixed length of in-memory cache
							let z = JSON.parse( val );
								if (!z.pubKeyComp){
									//add compressed public key 
									//const 	ecdh 	= 	crypto.createECDH('secp256k1');
									
									z.pubKeyComp = secp256k1.publicKeyConvert( Buffer.from(z.pubKey, 'hex'), true ).toString('hex');
									/*
									z.pubKeyComp = crypto.ECDH.convertKey( Buffer.from(z.pubKey, 'hex'),
                                        'secp256k1',
                                        'hex',
                                        'hex',
                                        'compressed');
									*/	
									console.log('Uncompressed key: ' + 	z.pubKey);
									console.log('Compressed key: ' + 	z.pubKeyComp);	
								}
								
							indexProtocol.accountsStore[ address ] = z;
														
							//@todo: optimize code/decode
							return resolve( {code: 0, value: Buffer.from(val, 'utf8').toString('base64')} );
						}
						else
							return resolve( {code:1} );
					});					
				});		
			}
			else
			if (path === 'tbl.accounts.open'){		//open by publicKey (fetched by private at browser)
				
				if (data.length === 0){
					return {code: 1 };
				}
				
				let pubKey = data.toString('utf8');
				
				//console.log('Request info about: ' + pubKey);
				
				//check account-author 
				let fromAddr = null;
				
				_.find(indexProtocol.accountsStore, function( acc ){
					if (acc.pubKey === pubKey || acc.pubKeyComp === pubKey){
						fromAddr = acc.address;
						return true;
					}
				});
				
				if (fromAddr){
					console.log('Finded: ' + fromAddr);
					
					return {code: 0, value: Buffer.from(fromAddr, 'utf8').toString('base64')};
				}
				else {
					return new Promise(function(resolve, reject){
						stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
							console.log('Check avalability of pubKey at lookup tbl');
						
							if (!err && val && Buffer.isBuffer(val)){
								val = val.toString('utf8');								
								
								if (val && val != ''){
									console.log('Author address exists: ' + val);
									
									return resolve({code: 0, value: Buffer.from(fromAddr, 'utf8').toString('base64')});
								}
							}
							
							return resolve({code: 1, value: Buffer.from('', 'utf8').toString('base64')});
						});
					});
				}				
			}			
		}
		
		return { code: 1 };
	},
	
	beginBlock: function(request) {
		
		
		beginBlockTs = process.hrtime();
		indexProtocol.curTime = new Date().getTime(); //local node's time
		//initial current block store
		currentBlockStore = [];
		
		//clear queue
		//indexProtocol.dataTxQueue = {};
		
		
		//block time - UTC
		appState.blockTime = parseInt( request.header.time.seconds * 1000 ); 
		
//console.dir( [appState.blockTime, request.header.time.seconds, Math.trunc(request.header.time.nanos/100000)], {depth:8, colors: true} );
		
		//console.log( request.header.height + ' block proposerAddress: ' + request.header.proposerAddress.toString('hex') ); 
		appState.blockHash = request.hash.toString('hex');
		appState.blockProposer = request.header.proposerAddress.toString('hex').toLowerCase();
		appState.blockHeight = parseInt( request.header.height.toString() );
		
		//console.log('      BeginBlock.Height: ' + request.header.height + ' at time '+moment.utc(appState.blockTime).format('HH:mm:ss DD/MM/YYYY')+', proposer: ' + appState.blockProposer + ', me: ' + (appState.blockProposer == indexProtocol.node.address));  
		
		let numTx = parseInt( request.header.numTxs.toString() );
		
		/** rewrite Reward/Mining sheme 
		
		let rewardFull = appState.options.rewardPerBlock + ( appState.options.rewardPerDataTx * numTx);
			
			//save to special system tbl 
			delayedTaskQueue.push({
				exec: 'tbl.system.rewards', 
				address: appState.blockProposer, 
				rewardPerBlock: appState.options.rewardPerBlock,
				rewardPerDataTx: appState.options.rewardPerDataTx,
				numTx: numTx,
				
				rewardFull: rewardFull,
				
				blockHeight: appState.blockHeight
			});
		**/
		
		return { code: 0 };
	},
  
  
	checkTx: function(request) {
		//console.log('Call: CheckTx', request);   
		
		let obj = indexProtocol.parseTx( request.tx );
		
		if (obj !== false){
		
			if (obj.code === 'data.src.trades' || obj.code === 'data.src.index'){
				//first sign - by one of BP, other - by source 
				let nodeAcc = _.find(indexProtocol.accountsStore, function(v){
					if (v.type == 'node' && v.pubKey == obj.pubKey)
						return true;
				});
				
				if (!nodeAcc){
					//maybe dev 
					if (obj.pubKey == indexProtocol.node.pubKey){
						//check Signatures 
						let checkSign = secp256k1.verify(sha256( JSON.stringify(obj.data) ), Buffer.from(obj.sign, 'hex'), Buffer.from(indexProtocol.node.pubKey, 'hex'));
						
						if (checkSign === false){
							console.log( 'Wrong node signature' );
							return { code: 1, log: 'Wrong node signature' };
						}
					}
				}
				
				//check second signature of source 
				let provider = obj.data.provider;
				let providerPubKey = sourceKeys.keys[ provider ].pubKey;
				let dataHash = sha256( JSON.stringify(obj.data.data) );
				
				let checkProviderSign = secp256k1.verify(dataHash, Buffer.from(obj.data.sign, 'hex'), Buffer.from(providerPubKey, 'hex'));
				
				if (checkProviderSign === false){
					console.log( 'Wrong provider signature' );
					return { code: 1, log: 'Wrong provider signature' };
				}
				
				//all OK, signs is good
				//console.log('OK, data.src.trade Verify OK');
				return { code: 0 };
			}
			
			return { code: 1 };
		}
		
		
		
		let tx = request.tx.toString('utf8');
		
		if (!tx) return { code: 1, log: 'Wrong tx type' };
		
		//updated format: code:signature:pubkey:txbody	
		//@todo: rewrite structure as: code:hash:sign:pubkey:flags:data	 - flags how decode data	
		let z  = tx.split(':'); //format: CODE:<base64 transaction body>

		if (!z || z.length < 2) return { code: 1, log: 'Wrong tx type' };
		
		let txType = z[0].toUpperCase();
		
		switch ( txType ){
			case 'CET': {	//old type of tx 
				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				let x = JSON.parse( _x );
				
				if (x){
					//debug 
					if (x.excode && x.excode != 'rightbtc'){
						if (x.price < 0)
							return { code: 1, log: txType + ': Price can not be lover then 0'};
						
						if (x.amount <= 0)
							return { code: 1, log: txType + ': Amount can not be 0 or less'};
						
						if (x.total <= 0)
							return { code: 1, log: txType + ': Total can not be 0 or less'};
						
						if (!x.id || x.id == null || x.id == '')
							return { code: 1, log: txType + ': tradeID can not be empty'};  
					}
				}
				else
					return { code: 1, log: txType + ': Wrong data after parsing'};  
				
				break;
			}
			case 'AVG': {
				//console.log('AVG: CheckTx Rates');
			
				//@todo: rewrite structure as: hash:sign:pubkey:flags:data
				//check signature 
				if (!z[1])	return { code: 1, log: txType + ': wrong or empty hash'};  
				
				let hash = z[1];
				let data = JSON.parse( Buffer.from( z[(z.length-1)], 'base64').toString('utf8') );
//console.dir( data, {depth:8});
					
				if (!data)	return { code: 1, log: txType + ': wrong data after parsing'};     

				//fetch local copy of avg by height
				let localCopy = _.find(indexProtocol.latestAvgStore, function(v){
					if (v.height == data.blockHeight && v.symbol == data.symbol)
						return true;
					else
						return false;
				});
				
				
				if (!localCopy){	//we havent local data 
					//console.log('No local data from this height.');
					//@todo: if nothing data - what to do?
					return { code: 0 };
				}
				
				//check height: if current height more then N distance from quote, stop to propagate it 
				if (Math.abs(appState.blockHeight - data.blockHeight) >= maxDiffFromAppHeight){
					console.log( 'Quote from proposer and local has big difference by height: ' + appState.blockHeight + ' (app), ' + data.blockHeight + ' (tx)');
					
					return { code: 1 };
				}
				
				//simple check - hash only (?)
				if (hash == localCopy.hash){
					//console.log( 'Quote from proposer and local will eq by hash: ' + hash + ' === ' + localCopy.hash);
					//Quote are identical by hash 
					return { code: 0 };
				}
				
				
				/**
				console.log(' ');
				console.log('WARN: need a Fuzzy check, we not eq with hash');
				console.log(' ');
				
				console.log('Data from proposer: ' + hash);
				console.dir( data, {depth:0});
				console.log(' ');
				console.log('Data from local copy');
				console.dir( localCopy, {depth:1});
				console.log(' ');
				**/
				
				//@todo: use deep Fuzzy check, every field and scoring system to check eq						
				//check MerkleRoot 
				
				if (data.txMerkleRoot == localCopy.data.txMerkleRoot){
					return { code: 0 };
				}
				
								
				break;
			}
			case 'REG': {
				console.log('REG: checkTx of register new address');
				
				//console.dir( z, {depth:16});
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				//check signature 
				
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				var pubKey = z[3].toLowerCase();
				
				//simple check pubkey at local storage 
				return new Promise(function(resolve, reject){
					//lookup table pubkey to address
					//@todo: need to check all ids, name and use forbidden ids 
					stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
						console.log('Check avalability of pubKey at lookup tbl.');
					
						if (!err && val){
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							
							if (val && val != ''){
								console.log('Address already exists');
								
								return resolve({code: 0, log: 'Address already exists'});
							}
							
							return resolve( {code: 0} );
						}
						else
							return resolve( {code: 0} );
						
					});
				});
				
				break;
			}
			case 'NNM': {
				console.log('REG: checkTx of register new alt-name(s) for existing address');
				
//console.dir( z, {depth:16});
				
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				//let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log('NNM: Invalid signature');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				//check nonce and addresse
				let acc = indexProtocol.accountsStore[ data.address ];
					
				if (!acc || acc.address !== data.address){
					console.log('NNM: Invalid account at accountsStore');
					
					return { code: 0, log: 'Invalid account' };						
				} 
				
				if (acc.nonce >= data.nonce){
					console.log('NNM: Invalid account nonce');
					
					return { code: 0, log: 'Invalid account nonce' };
				}
								
				return { code: 0 };
			
				break;
			}
			case 'MSG': {
				console.log('MSG: checkTx of sending messages for existing address');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log('MSG: Invalid signature');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				//check message length 
				if (Buffer.byteLength(data.msg, 'utf8') > 8192){
					console.log('MSG: Invalid message length, max.: 8192');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				if (!data.to || data.to.length < 1){
					console.log('MSG: Invalid array of to');
					
					return { code: 0, log: 'Invalid recipients' };
				}
				
				//check account-author 
				let fromAddr = null;
				
				_.find(indexProtocol.accountsStore, function( acc ){
					if (acc.pubKey === pubKey || acc.pubKeyComp === pubKey){
						fromAddr = acc.address;
						return true;
					}
				});
				
				if (!fromAddr)
					return { code: 1, log: 'Invalid author\'s account' };
				else
					return { code: 0 };
			
				break;
			}
			case 'TRF': {
				console.log(txType + ': checkTx of transfer assets between accounts');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 1, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 1, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 1, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 1, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log(txType + ': Invalid signature');
					
					return { code: 1, log: 'Invalid signature' };   
				}
				
				/*
					symbol	: symbol.toUpperCase(), 
					amount  : amount, 
					txdate	: new Date().getTime(), //local UTC 
					toid	: toid,
					desc 	: '', //@todo: add any description
					nonce:	0 //@todo: add fetch current nonce from acc 
				*/
				//base check tx 
				if (!data.symbol || !data.amount || !data.txdate || !data.toid){
					console.log(txType + ': Invalid required field');
					
					return { code: 1, log: 'Invalid required field' }; 
				}
				
				if (!appState.assetStore[ data.symbol ]){
					console.log(txType + ': Invalid symbol');
					
					return { code: 1, log: 'Invalid symbol' };
				}
				
				let amount = parseFloat( data.amount );
				let ass = appState.assetStore[ data.symbol ];
				
				var realAmount = Math.trunc( amount * ass.divider );
				
				if (realAmount < 0 || realAmount < (ass.txFee + ass.txIssuerFee)){
					console.log(txType + ': Amount too small');
					
					return { code: 1, log: 'Amount too small' };
				}
				
				//including all fee
				var realAmountWithFees = realAmount + ass.txFee + ass.txIssuerFee;
				
				//check asset options
				if (ass.options && ass.options.isTransferrable === false){
					console.log(txType + ': Symbol ' + ass.symbol + ' isnt Transferrable by issuer');
					
					return { code: 1, log: 'Symbol isnt transferrable' };
				}
				
				//fetch account 
				//fetch account from storage 
				return new Promise(function(resolve, reject){
					//lookup table pubkey to address
					stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
						console.log('Check avalability of pubKey at lookup tbl.');
					
						if (!err && val && Buffer.isBuffer(val)){
							val = val.toString('utf8');								
													
							if (val && val != ''){
								console.log('Author address exists: ' + val);
								
								stateDb.get('tbl.accounts.' + val, function(err, acc){
									if (!err && acc && Buffer.isBuffer(acc)){
										acc = JSON.parse( acc.toString('utf8') );
										
										let _asset = acc.data.assets[ data.symbol ];
										
										if (_asset){
											//check amount (inc. fee)
											if (_asset.amount >= realAmountWithFees){
												return resolve( {code: 0} );
											}
											else
												return resolve( {code: 1, log: 'Account amount too small'} );
										}
										else
											return resolve( {code: 1, log: 'No asset at account'} );
										
										/**
										var _asset = _.find(acc.data.assets, function(x){
											if (x && x.symbol === data.symbol)
												return true;
										});
										
										if (_asset){
											//check amount (inc. fee)
											if (_asset.amount >= realAmountWithFees){
												return resolve( {code: 0} );
											}
											else
												return resolve( {code: 1, log: 'Account amount too small'} );
										}
										else
											return resolve( {code: 1, log: 'No asset at account'} );
										**/
									}
									else
										return resolve( {code: 1, log: 'Error while obtain account'} );
								});
							}	
							else
								return resolve( {code: 2, log: 'Error while obtain account'} );	
						}
						else
							return resolve( {code: 3, log: 'Error while obtain account'} );	
					});
				});
				
				return { code: 0 };
			
				break;
			}
			case 'CIT': {
				console.log(txType + ': checkTx of creating index token');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 1, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 1, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 1, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 1, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log(txType + ': Invalid signature');
					
					return { code: 1, log: 'Invalid signature' };   
				}
				
				if (!data.symbol || !data.name || !data.divider){
					console.log(txType + ': Invalid required field');
					
					return { code: 1, log: 'Invalid required field' }; 
				}
				
				let _symbol = data.symbol.toUpperCase();
				
				if (appState.assetStore[ _symbol ]){
					console.log(txType + ': Invalid symbol, MUST be unique');
					
					return { code: 1, log: 'Invalid symbol, MUST be unique' };
				}
				
				if (data.initialEmission != data.maxSupplyEmission){
					console.log(txType + ': For Index, initial and maxSupply emission MUST be eq.');
					
					return { code: 1, log: 'For Index, initial and maxSupply emission MUST be eq.' };
				}
				
				if (data.initialEmission < 100000 || data.maxSupplyEmission > 100000000000){
					console.log(txType + ': For Index, min emission 100K, max = 100B');
					
					return { code: 1, log: 'For Index, min emission 100K, max = 100B' };
				}
								
				//all base checks passed OK.
				//@todo: all check MUST be passed by Spec of asset
				return { code: 0 };			
				
				break;
			}
			case 'IND': {
				//console.log(txType + ': checkTx of third-parties indices');
				
				//@todo: check at normal tx 
				return { code: 0 }; 
				break;
			}
			case 'AIV': {
				//code:hash:sign:pubkey:flags:data
				//sign: sign1,sign2, pubkey: pk1,pk2
				//flag msig == multisig tx 
				//let tx = 'aiv:' + data.hash + ':' + data.sign + ',' + sign2 + ':' + data.pubKey + ',' + nodePrivKey.pubKey + ':msig:' + Buffer.from( JSON.stringify( data.data ), 'utf8').toString('base64');
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let forHeight = parseInt( flags );
				
				//check height: if current height more then N distance from quote, stop to propagate it 
				if (Math.abs(appState.blockHeight - forHeight) >= maxDiffFromAppHeight){
					//console.log( 'Quote from proposer and local has big difference by height: ' + appState.blockHeight + ' (app), ' + data.blockHeight + ' (tx)');
					
					return { code: 1 };
				}
				
				
				//@todo: check it
				return { code: 0 }; 
				break;
			}
			
			
			
			default: {	
				break;
			}			
		}
				
		return { code: 0 }; 
	},

	deliverTx: function(request) {
//try {
		//console.log('Call: DeliverTx');    
		let txHash 	= crypto.createHash('sha256').update(request.tx).digest('hex');
		let tx 		= request.tx.toString('utf8');
		
		let obj = indexProtocol.parseTx( request.tx );
//console.dir( obj );			
		if (obj !== false){
//console.log('Call: DeliverTx for ' + obj.code); 
			if (obj.code === 'data.src.trades' || obj.code === 'data.src.index'){
				let z = obj.data;
					z.txHash = txHash;
					z.height = appState.blockHeight;
				let key = obj.code + ':' + obj.data.data.symbol;
//console.dir( [z, key] );				
				if (!indexProtocol.dataTxQueue[ key ])	indexProtocol.dataTxQueue[ key ] = [];
				
				indexProtocol.dataTxQueue[ key ].push( JSON.stringify( z ) );
			}			
		}
		
		
		
		
		
		
		
		//updated format: code:hash:sign:pubkey:flags:data
		let z  = tx.split(':'); //format: CODE:<base64 transaction body>

		if (!tx) return { code: 0, log: 'Wrong tx type' };
		if (!z || z.length < 2) return { code: 0, log: 'Wrong tx type' }; 	 

		let txType = z[0].toUpperCase();
		let tags = {};

		switch ( txType ){
			
			case 'CET': {

				let _x = Buffer.from( z[1], 'base64').toString('utf8');
				
				tags[ 'tx.class' ] = 'cetx';
				
		//			console.log('CET: Cryptocurrency Exchange Trades :: ' + _x);
				
				var x = JSON.parse( _x );
				
				//@todo: remove from this, do this check at checkTx
				if (x){			
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
					
					/*
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
					*/
					delete x._hash;

					currentBlockStore.push( x );
				}
				
				
				// //ztag.push({'key': 'tx.year', 'value' : '2019'});
				//let ztag = [];
				//	ztag.push({key: 'year', value : '2019'}); 
				//	ztag.push({key: 'zear', value : 'test'}); 
				
				return { code: 0 }; 
				
				break;   
			}			
			case 'AVG': {
				//console.log('AVG: DeliverTx with average calc Rates');
				
				//@possinle optimize - do now double parse
				let data = JSON.parse( Buffer.from( z[(z.length-1)], 'base64').toString('utf8') );
				
				if (data){
					//all check prepared at checkTx (as i known)
					//save this as commited data 
					data.blockCommit = appState.blockHeight; 		

					saveOps.push({ type: 'put', key: 'tbl.block.'+data.blockHeight+'.avg', value: JSON.stringify(data) });
					
					console.log('AVG: Calc Rates commited for height ' + data.blockHeight + ' (diff: ' + (appState.blockHeight - data.blockHeight) + ')');
				}
			
				return { code: 0 }; 
						
				break;
			}
			case 'REG' : {				
				console.log('REG: deliverTx call');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase();
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});
				
				if (data){
					
					let _hash = sha256( rawData );
					
					if (_hash.toString('hex').toLowerCase() != hash){
						console.log('REG: Invalid hash, compute and stored/signed');
						
						return { code: 0, log: 'Invalid hash' };
					}
			
					let checkSign = secp256k1.verify(_hash, Buffer.from(sign, 'hex'), Buffer.from(pubk, 'hex'));
					
					if (checkSign != true){
						console.log('REG: Invalid signature');
						
						return { code: 0, log: 'Invalid signature' };   
					}
					
					if (!data.address || !data.ids || data.ids.length < 1){
						console.log('REG: Invalid or empty address');
						
						return { code: 0, log: 'Invalid or empty address' };
					}
					
					//fix to older addresses, without prefix 
					if (data.address.indexOf(appState.options.addressPrefix) !== 0){
						return { code: 0, log: 'Address at old format, invalid' };
					}
					
					data.createdBlockHeight = appState.blockHeight;
					data.updatedBlockHeight = appState.blockHeight;
					
					appState.accountStore.push( data.address );
					
					data.pubKeyComp = secp256k1.publicKeyConvert( Buffer.from(pubk, 'hex'), true ).toString('hex');
					
					//Save to systems accounts 
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+pubk, value: data.address});
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+data.pubKeyComp, value: data.address});
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+data.address, value: pubk});
					//saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+data.address, value: data.address});
					saveOps.push({type: 'put', key: 'tbl.accounts.'+data.address, value:JSON.stringify( data )});
					
					indexProtocol.accountsStore[ data.address ] = data;
					
					console.dir( data, {depth:8} );
					
					return { code: 0, log: 'REG:' + data.address }; //, log: 'REG:' + x.name + ';' + x.addr + ';OK' };
				}
				else
					return { code: 0, log: 'Invalid data of reg tx' };

			
				return { code: 0 };
				break;
			}
			case 'NNM' : {				
				console.log('NNM: deliverTx call');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!! 
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});
				
				if (data){
					
					let _hash = sha256( rawData );
					
					if (_hash.toString('hex') != hash){
						console.log('NNM: Invalid hash, compute and stored/signed');
						
						return { code: 0, log: 'Invalid hash' };
					}
					
					let acc = indexProtocol.accountsStore[ data.address ];
					
					if (!acc || acc.address !== data.address){
						console.log('NNM: Invalid account at accountsStore');
						
						return { code: 0, log: 'Invalid account' };						
					} 
			
					let checkSign = secp256k1.verify(_hash, Buffer.from(sign, 'hex'), Buffer.from(acc.pubKey, 'hex'));
					
					if (checkSign != true){
						console.log('NNM: Invalid signature');
						
						return { code: 0, log: 'Invalid signature' };   
					}
					
					if (!data.address || !data.ids || data.ids.length < 1){
						console.log('NNM: Invalid or empty address');
						
						return { code: 0, log: 'Invalid or empty address' };
					}
					
					if (!data.nonce || data.nonce < 1){
						console.log('NNM: Invalid nonce');
						
						return { code: 0, log: 'Invalid nonce' };
					}
					
					if (!acc || ( acc.pubKey !== pubk && acc.pubKeyComp !== pubk )){
						console.log('NNM: Invalid account public key');
						
						return { code: 0, log: 'Invalid account public key' };						
					} 
					
					if (acc.nonce >= data.nonce){
						console.log('NNM: Invalid account nonce');
						
						return { code: 0, log: 'Invalid account nonce' };
					}
					
					data.ids.forEach(function(_id){
						if (acc.ids.indexOf( _id ) === -1){
							//check forbidden
							//@todo: check full domain restriction
							if (appState.options.forbiddenIds.indexOf( _id ) === -1){
							
								indexProtocol.accountsStore[ acc.address ].ids.push( _id );
							
								saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + _id, value: acc.address});
							}
						}
					});

					//@todo add work with txFee 
					indexProtocol.accountsStore[ data.address ].nonce++;
					
					if (!indexProtocol.accountsStore[ data.address ].tx){
						indexProtocol.accountsStore[ data.address ].tx = [];
					}
					
					indexProtocol.accountsStore[ data.address ].tx.push( txHash );
					
					saveOps.push({type: 'put', key: 'tbl.accounts.' + acc.address, value: JSON.stringify( indexProtocol.accountsStore[ acc.address ] )});
					
					return { code: 0 }
					
				}
				else	
					return { code: 0, log: 'Invalid tx data' }
			}	
			case 'MSG': {
				console.log(txType + ': deliverTx of sending messages for existing address');
				
//console.dir( z, {depth:16});
			
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log(txType + ': Invalid signature');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				//check message length 
				if (Buffer.byteLength(data.msg, 'utf8') > 8192){
					console.log(txType + ': Invalid message length, max.: 8192');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				if (!data.to || data.to.length < 1){
					console.log(txType + ': Invalid array of to');
					
					return { code: 0, log: 'Invalid recipients' };
				}
				
				//fetch account from storage 
				return new Promise(function(resolve, reject){
					//lookup table pubkey to address
					//@todo: need to check all ids, name and use forbidden ids 
					stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
						console.log('Check avalability of pubKey at lookup tbl.');
					
						if (!err && val){
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
							
							if (val && val != ''){
								console.log('Author address exists: ' + val);
								
								let msg = {
									author			: val,
									authorPubKey	: pubKey,
									
									txHash			: txHash,
									sign			: sign,
									message			: data.msg,

									blockHeight		: appState.blockHeight,
									
									ts		: new Date().getTime()  //No actual time		
								};
								
								let asyncOpts = [];
								
								data.to.forEach(function(_id){
									asyncOpts.push( function(cb){
										
										stateDb.get('tbl.accounts.__lookup.' + _id, function(err, addr){
											console.log('Check avalability address of ' + _id);
										
											if (!err && addr && Buffer.isBuffer(addr)){
												addr = addr.toString('utf8');

												stateDb.get('tbl.accounts.' + addr, function(err, acc){
													if (!err && acc && Buffer.isBuffer(acc)){
														acc = JSON.parse( acc.toString('utf8') );

														acc.data.messages.unshift( msg );
														
														//add tx 
														if (!acc.tx)	acc.tx = [];
														
														acc.tx.push( txHash );
														
														if (!indexProtocol.accountsStore[ acc.address ])
															indexProtocol.accountsStore[ acc.address ] = acc;
														else{
															if (!indexProtocol.accountsStore[ acc.address ].tx)
																indexProtocol.accountsStore[ acc.address ].tx = [];
															
															indexProtocol.accountsStore[ acc.address ].tx.push( txHash );
															indexProtocol.accountsStore[ acc.address ].data.messages.unshift( msg );
														}
														
														saveOps.push({type: 'put', key: 'tbl.accounts.' + acc.address, value: JSON.stringify(indexProtocol.accountsStore[ acc.address ])});
														
														cb(null);														
													}
													else
														cb(null);
												});												
											}
											else
												cb(null);
										});	
										
									} );
								});
								
								if (asyncOpts.length > 0){
									async.series( asyncOpts /*, 2*/, function(err, results){
										
										if (!indexProtocol.accountsStore[ val ].tx)
											indexProtocol.accountsStore[ val ].tx = [];
										
										//modify author account 
										indexProtocol.accountsStore[ val ].tx.push( txHash );
										indexProtocol.accountsStore[ val ].nonce++;
										
										saveOps.push({type: 'put', key: 'tbl.accounts.' + val, value: JSON.stringify(indexProtocol.accountsStore[ val ])});
										
										return resolve( {code: 0} );
									} );
								}
								else 
									return resolve( {code: 0, log: 'Nothing to do'} );
							}
							else							
								return resolve( {code: 0, log: 'No author address'} );
						}
						else
							return resolve( {code: 0, log: 'No address associate with'} );
						
					});
				});
				
				break;
			}
			case 'TRF': {
				console.log(txType + ': deliverTx of transfer assets between accounts');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log(txType + ': Invalid signature');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				/*
					symbol	: symbol.toUpperCase(), 
					amount  : amount, 
					txdate	: new Date().getTime(), //local UTC 
					toid	: toid,
					desc 	: '', //@todo: add any description
					nonce:	0 //@todo: add fetch current nonce from acc 
				*/
				//base check tx 
				if (!data.symbol || !data.amount || !data.txdate || !data.toid){
					console.log(txType + ': Invalid required field');
					
					return { code: 0, log: 'Invalid required field' }; 
				}
				
				if (!appState.assetStore[ data.symbol ]){
					console.log(txType + ': Invalid symbol');
					
					return { code: 0, log: 'Invalid symbol' };
				}
				
				let amount = parseFloat( data.amount );
				let ass = appState.assetStore[ data.symbol ];
				
				var realAmount = Math.trunc( amount * ass.divider );
				
				if (realAmount < 0 || realAmount < (ass.txFee + ass.txIssuerFee)){
					console.log(txType + ': Amount too small');
					
					return { code: 0, log: 'Amount too small' };
				}
				
				//including all fee
				var realAmountWithFees = realAmount + ass.txFee + ass.txIssuerFee;
				
				let txFeeAddr = ass.txFeeAddress;
				let txFeeIssuerAddr = ass.txIsserFeeAddress;
				
				//check asset options
				if (ass.options && ass.options.isTransferrable === false){
					console.log(txType + ': Symbol ' + ass.symbol + ' isnt Transferrable by issuer');
					
					return { code: 1, log: 'Symbol isnt transferrable' };
				}
				
console.log('All check passed OK, try to change balances...');
				
				//lets do tx 
				return new Promise(function(resolve, reject){
					var zOps = {
						'fromAddr' 	: function(cb){
							stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
								if (!err && val && Buffer.isBuffer(val)){
									val = val.toString('utf8');								
															
									if (val && val != '')
										return cb(null, val);
								}
								
								cb(err);
							});									
						},
						'toAddr'	: function(cb){
							stateDb.get('tbl.accounts.__lookup.' + data.toid, function(err, val){
								if (!err && val && Buffer.isBuffer(val)){
									val = val.toString('utf8');								
															
									if (val && val != '')
										return cb(null, val);
								}
								
								cb(err);
							});
						}
					};
					
					async.parallel(zOps, function(err, results){
						if (!err && results.fromAddr && results.toAddr){
							//fetch both accounts and change balances on it
							var asyncOps = {
								'fromAcc' 	: function(cb){
									stateDb.get('tbl.accounts.' + results.fromAddr, function(err, val){
										if (!err && val && Buffer.isBuffer(val)){
											val = JSON.parse( val.toString('utf8') );					
																	
											if (val && val != '')
												return cb(null, val);
										}
										
										cb(err);
									});									
								},
								'toAcc' 	: function(cb){
									stateDb.get('tbl.accounts.' + results.toAddr, function(err, val){
										if (!err && val && Buffer.isBuffer(val)){
											val = JSON.parse( val.toString('utf8') );					
																	
											if (val && val != '')
												return cb(null, val);
										}
										
										cb(err);
									});									
								},
								'txFeeAcc' 	: function(cb){
									if (txFeeAddr === 'indxt0000000000000000000000000000'){
										return cb(null, null);
									}
									
									stateDb.get('tbl.accounts.' + txFeeAddr, function(err, val){
										if (!err && val && Buffer.isBuffer(val)){
											val = JSON.parse( val.toString('utf8') );					
																	
											if (val && val != '')
												return cb(null, val);
										}
										
										cb(err);
									});									
								},
								'txFeeIssuerAcc' 	: function(cb){
									if (txFeeIssuerAddr === 'indxt0000000000000000000000000000'){
										return cb(null, null);
									}
																		
									stateDb.get('tbl.accounts.' + txFeeIssuerAddr, function(err, val){
										if (!err && val && Buffer.isBuffer(val)){
											val = JSON.parse( val.toString('utf8') );					
																	
											if (val && val != '')
												return cb(null, val);
										}
										
										cb(err);
									});									
								}								
							};
							
							//@todo: calc fee before tx and include it to Tx
							async.parallel(asyncOps, function(err, res){
								if (!err && res){
									//add realAmount to 
									/**
									let _balance = _.find(res.toAcc.data.assets, function(a){
										if (a && a.symbol === data.symbol)
											return true;
									});
									*/
									let _balance = res.toAcc.data.assets[ data.symbol ];
									
									if (_balance){
										_balance.amount += realAmount;
										
										//add tx 
										if (!res.toAcc.tx)	res.toAcc.tx = [];
														
										res.toAcc.tx.push( txHash );
										res.toAcc.nonce++;
										
										if (!indexProtocol.accountsStore[ res.toAcc.address ])
											indexProtocol.accountsStore[ res.toAcc.address ] = res.toAcc;
										else {
											indexProtocol.accountsStore[ res.toAcc.address ].tx.push( txHash );
											
											indexProtocol.accountsStore[ res.toAcc.address ].nonce++;
											
											/*
											let _b = _.find(indexProtocol.accountsStore[ res.toAcc.address ].data.assets, function(ab){
												if (ab && ab.symbol === data.symbol)
													return true;
											});
											
											if (_b){
												_b.amount += realAmount;
											}
											*/
											let _b = indexProtocol.accountsStore[ res.toAcc.address ].data.assets[ data.symbol ];
											
											if (_b){
												_b.amount += realAmount;
											}
										}
										
										saveOps.push({type: 'put', key: 'tbl.accounts.' + res.toAcc.address, value: JSON.stringify(indexProtocol.accountsStore[ res.toAcc.address ])});
									}
									
									//add TxFee
									//add TxIssuerFee
									//dec realAmount + TxFee + TxIssuerFee
									/*
									let _balance2 = _.find(res.fromAcc.data.assets, function(a){
										if (a && a.symbol === data.symbol)
											return true;
									});
									*/
									let _balance2 = res.fromAcc.data.assets[ data.symbol ];
									
									if (_balance2){
										_balance2.amount -= realAmountWithFees;
										
										//add tx 
										if (!res.fromAcc.tx)	res.fromAcc.tx = [];
														
										res.fromAcc.tx.push( txHash );
										res.fromAcc.nonce++;
										
										if (!indexProtocol.accountsStore[ res.fromAcc.address ])
											indexProtocol.accountsStore[ res.fromAcc.address ] = res.fromAcc;
										else {
											indexProtocol.accountsStore[ res.fromAcc.address ].tx.push( txHash );
											
											indexProtocol.accountsStore[ res.fromAcc.address ].nonce++;
											
											/*
											let _b2 = _.find(indexProtocol.accountsStore[ res.fromAcc.address ].data.assets, function(ab){
												if (ab && ab.symbol === data.symbol)
													return true;
											});
											*/
											
											let _b2 = indexProtocol.accountsStore[ res.fromAcc.address ].data.assets[ data.symbol ]; 
											
											if (_b2){
												_b2.amount -= realAmountWithFees;
											}											
										}
										
										saveOps.push({type: 'put', key: 'tbl.accounts.' + res.fromAcc.address, value: JSON.stringify(indexProtocol.accountsStore[ res.fromAcc.address ])});
									}
								}
								
								return resolve( {code: 0} );
							});
						}

					});

				});
				
				return { code: 0 };
				break;
			}
			case 'CIT': {
				console.log(txType + ': deliverTx of creating index token');
				
				//Register new Index token and issue all of them 
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );

//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});				
				
				//check base structure of tx: code:hash:sign:pubkey:flags:data
				if (z.length != 6)		return { code: 0, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 0, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 0, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 0, log: txType + ': wrong public key'}; 
				
				let _hash = sha256( rawData );
				
				var pubKey = z[3]; //.toLowerCase();
//console.log( 'hash: ' + _hash.toString('hex') );				
				//check signature 
				let checkSign = secp256k1.verify(_hash, Buffer.from(z[2], 'hex'), Buffer.from(pubKey, 'hex'));
					
				if (checkSign != true){
					console.log(txType + ': Invalid signature');
					
					return { code: 0, log: 'Invalid signature' };   
				}
				
				if (!data.symbol || !data.name || !data.divider){
					console.log(txType + ': Invalid required field');
					
					return { code: 0, log: 'Invalid required field' }; 
				}
				
				let _symbol = data.symbol.toUpperCase();
				
				if (appState.assetStore[ _symbol ]){
					console.log(txType + ': Invalid symbol, MUST be unique');
					
					return { code: 0, log: 'Invalid symbol, MUST be unique' };
				}
				
				if (data.initialEmission != data.maxSupplyEmission){
					console.log(txType + ': For Index, initial and maxSupply emission MUST be eq.');
					
					return { code: 0, log: 'For Index, initial and maxSupply emission MUST be eq.' };
				}
				
				if (data.initialEmission < 100000 || data.maxSupplyEmission > 100000000000){
					console.log(txType + ': For Index, min emission 100K, max = 100B');
					
					return { code: 0, log: 'For Index, min emission 100K, max = 100B' };
				}
				
				//@todo: use dedicated Spec to create Asset 
				var indexToken = {
					symbol				: _symbol,
					dividedSymbol		: '', //symbol for divided assets
					type				: 'index',
					family				: 'IND', //as Bloomber code
					standart			: 'IDX42', //@todo: use spec file for validation and stored contract
					
					name				: data.name.substring(0, 128),
					desc				: 'Standart index token for tracking performance and issues derivative', 
					
					spec				: data.spec, //link to asset specification
					newsfeed			: data.newsfeed, //link to RSS feed for news related to asset
					
					underlayerSymbol	: '', //for contract - base asset 
					divider				: data.divider,
					
					txFeePaymentBy		: 'IDX',
					txFee				: 0, //default fee, payed for validators 
					txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
					
					//fill by data from account
					issuerAddress		: '',	//special default address for native coin ONLY
					issuerName			: '', //alt-name, one of registered at account
					
					txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
					txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
					
					actionsAllowed		: [], //actions, reserved for future
					
					//addition data for token. e.g. index value for index
					initDataValue		: 0,
					latestDataValue		: 0,
					changesByPrevios	: 0, //unsigned
					latestUpdateHeight	: appState.blockHeight,	
					
					//@todo: use block counter to update this
					dataUpdatesFreq		: data.dataUpdatesFreq, //data updating declared
					
					//valueHistory		: [], //latest N values
					
					emission			: {
						initial			: data.initialEmission, 
						maxSupply		: data.maxSupplyEmission,
						
						issueHeight		: appState.blockHeight,
						maturityHeight	: 0,
						callableMaturityHeight: 0	
					},
					
					multisig: [], //for multisig action 
				
					options				: {
						isTradable			: new Boolean(data.options.isTradable), 
						isBurnable			: new Boolean(data.options.isBurnable),
						isMintable			: new Boolean(data.options.isMintable),
						isCallableMaturity	: new Boolean(data.options.isCallableMaturity),
						isFrozen			: new Boolean(data.options.isFrozen),
						isTransferrable		: new Boolean(data.options.isTransferrable),
						isUniqe				: new Boolean(data.options.isUniqe), 
						isMassPayable		: new Boolean(data.options.isMassPayable),
						isMultisigble		: new Boolean(data.options.isMultisigble),
						isContractAllowed	: new Boolean(data.options.isContractAllowed) 
					},
					
					//total summ is CurculationSupply
					holders	: {},  //map of all holders (address => amount)
					txCounter: 0
				};
				
//console.dir( indexToken, {depth:16});	
				
				return new Promise(function(resolve, reject){
					let asyncOps = [
						//fetch address of issuer
						function(cb){
							stateDb.get('tbl.accounts.__lookup.' + pubKey, function(err, val){
								if (!err && val && Buffer.isBuffer(val)){
									val = val.toString('utf8');								
															
									if (val && val != '')
										return cb(null, val);
									else
										cb(1);
								}
								
								cb(err);
							});
						},
						//fetch account 
						function(addr, cb){
							if (addr && addr.indexOf('indxt') === 0){
								stateDb.get('tbl.accounts.' + addr, function(err, val){
									if (!err && val && Buffer.isBuffer(val)){
										val = JSON.parse( val.toString('utf8') );					
																
										if (val && val != '')
											return cb(null, addr, val);
									}
									
									cb(err);
								});
							}
							else
								cb(false);
						}, 
						//process new asset
						function(addr, acc, cb){
							
							if (addr && addr.indexOf('indxt') === 0 && acc.address === addr){
								indexToken.issuerAddress = acc.address;
								indexToken.issuerName = acc.name;
								
								if (indexToken.txFee > 0){
									indexToken.txFeeAddress = acc.address;
								}
								
								if (indexToken.txIssuerFee > 0){
									indexToken.txIsserFeeAddress = acc.address;
								}
								
								//add initial allocation 
								indexToken.holders[ acc.address ] = indexToken.emission.initial;
								
								acc.data.assets[ indexToken.symbol ] = { amount: indexToken.emission.initial };
																
								appState.assetStore[ indexToken.symbol ] = indexToken;
								
								//save to Db 
								saveOps.push({type: 'put', key: 'tbl.assets.' + indexToken.symbol.toUpperCase(), value: JSON.stringify(indexToken)});
								saveOps.push({type: 'put', key: 'tbl.accounts.' + acc.address, value: JSON.stringify(acc)});
								
								console.log('New INDEX Token issued OK. Symbol: ' + indexToken.symbol);	

								cb(null);
							}
							else
								cb( 3 );
						}				
					];
					
					
					async.waterfall( asyncOps, function(err, results){
						
						if (!err){						
							resolve({code: 0, log: 'New INDEX Token issued OK. Symbol: ' + indexToken.symbol});
						}						
					});
					
					
				});
				
				
				
				
				
				
				
				
			}	
			case 'IND': {
				//for old version
				if (z.length != 6) return { code: 0 };
								
				//console.log(txType + ': deliverTx of third-parties indices');
				
				//@todo: check at normal tx 
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );
				
				let tmp = appState.dataSource[ data.type + ':' + data.excode + ':' + data.symbol ];
				
				if (!tmp || (tmp && (tmp.ts != data.ts || tmp.price != data.price))){
					
					let x = {
						pubKey: pubk,
						sign  : sign,
						data  : data
					};	
					
					/*
						{ id: 185,
						  symbol: 'BTC/USD',
						  asset: 'BTC',
						  cur: 'USD',
						  type: 'IND',
						  side: '',
						  ts: 1551891925000,
						  excode: 'cryptocompare',
						  amount: 1000000,
						  total: 3874370000,
						  price: 3874370000 }
					*/					
					appState.dataSource[ data.type + ':' + data.excode + ':' + data.symbol ] = x;
				}
				
				return { code: 0 };
								
				break;
			}
			case 'AIV': {
				//code:hash:sign:pubkey:flags:data
				//sign: sign1,sign2, pubkey: pk1,pk2
				//flag msig == multisig tx 
				//let tx = 'aiv:' + data.hash + ':' + data.sign + ',' + sign2 + ':' + data.pubKey + ',' + nodePrivKey.pubKey + ':msig:' + Buffer.from( JSON.stringify( data.data ), 'utf8').toString('base64');
				
				//@todo: check it
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase(); //Compress key!!
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );
				
//console.dir( [hash, sign, pubk, flags, rawData, data], {depth:16});

				let symbol = data.symbol;
				
				if (appState.assetStore[ symbol ] && appState.assetStore[ symbol ].type == 'index'){
					let ass = appState.assetStore[ symbol ];
					
					if (ass.tx.indexOf( txHash ) != -1)
						return { code: 0 };
					
					
					let prev = ass.latestDataValue;
						
						ass.latestDataValue = data.data.price;
						ass.changesByPrevios = ass.latestDataValue - prev;
						ass.latestUpdateHeight = appState.blockHeight;
						
						ass.tx = [];
						//ass.tx.push( txHash );
						
						if (!indexProtocol.indexValuesHistory[ symbol ]){
							indexProtocol.indexValuesHistory[ symbol ] = [];
						}
						
						if (indexProtocol.indexValuesHistory[ symbol ].length == appState.options.historyPoints){
							indexProtocol.indexValuesHistory[ symbol ].shift();
						}
						
						//store off-chain
						indexProtocol.indexValuesHistory[ symbol ].push({   
							v: data.data.price,
							c: ass.changesByPrevios,
							h: appState.blockHeight,
							t: appState.blockTime,
							x: txHash
						});
					
					console.log('INDEX: updated ' + ass.symbol + ' to new value: ' + data.data.price + '('+ass.changesByPrevios+')'); 
					
					saveOps.push({type: 'put', key: 'tbl.assets.' + ass.symbol.toUpperCase(), value: JSON.stringify(ass)});
				}
				
				
				return { code: 0 }; 
				break;
			}
			
			
			
			default: {	//DEBUG
				return { code: 0, log: 'Unknown tx type' };
			}
		}

/*		
}catch(e){
	console.log('Erroro while deliverTx app handler');
	console.dir( e, {depth:16, colors: true});
	
	return { code: 0 };
}					
finally {
	return { code: 0 }; 	
}*/		
		
		return { code: 0 }; //, log: 'tx succeeded' };
	},
  
	endBlock: function(request){
		let hx = parseInt( request.height.toString() );
		
		if (hx != appState.blockHeight){
			console.log('PANIC! endBlock.height !== beginBlock.height and !== appSate.height');
			process.exit(1);
		}
		
//console.dir( indexProtocol.dataTxQueue, {depth:16, colors: true});
		/*
		_.each(indexProtocol.dataTxQueue, function(sq, k){
			if (sq.length > 0 && k){
				indexProtocol.ssdb.qpush_back(k, sq, function(err){
					console.log(k + ' -> OK');
				});
			}
		});
		*/
		indexProtocol.dataTxQueue = {};
		
	
		
		
		
		
		if (appState.blockStore.length == storeLatestBlocks){
			appState.blockStore.pop();
		}
		
		//lets calc some avg stat of block 
		let avgQuote = {
			blockHeight	: appState.blockHeight, 
			blockHash	: appState.blockHash,
			blockTime	: appState.blockTime,
			
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
				
				vwap = vwap + (v.total);
				
				p.push( parseInt( v.price ) );
				
				if (v.excode && exchangesIncluded.indexOf(v.excode) == -1)
					exchangesIncluded.push( v.excode );
			});
			
			//@todo: USE INTEGERS and Math.trunc
			
			if (x > 0) avgQuote.avgPrice 	= parseInt( x / currentBlockStore.length );
			if (y > 0) avgQuote.totalAmount = parseInt( y );
			if (z > 0) avgQuote.totalVolume = parseInt( z );
			
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
		
		appState.previousAppHash = appState.appHash;
		appState.appHash = '';

		//console.log(hx + ' EndBlock, tx count: ' + currentBlockStore.length ); 

		return { code: 0 };
	},

	//Commit msg for each block.
	commit: function(){
//try {
const time = process.hrtime();
const t1 = process.hrtime();
		let delayTasks = delayedTaskQueue.length;
		//events.emit('blockCommit', appState.blockHeight);
		if (delayedTaskQueue.length > 0){
			indexProtocol.processDelayedTask( appState.blockHeight ); //
			
			delayedTaskQueue = [];
		}
const _delayTaskTs = process.hrtime(t1);
const t2 = process.hrtime();				
		indexProtocol.blockCommitHandler( appState.blockHeight );
const _blockCommitTs = process.hrtime(t2);
const t3 = process.hrtime();		
		//Unnormal case
		if (appState.appHash != '')  process.exit(42);
		
		//create full string
		let jsonAppState = JSON.stringify( appState );//stringify
const _JSONTs = process.hrtime(t3);	
const t4 = process.hrtime();		
		//calc actual hash
		appState.appHash = indexProtocol.calcHash( jsonAppState, false);
	
const _calcHashTs = process.hrtime(t4);
const t5 = process.hrtime();	
		let jsonAvg = JSON.stringify(indexProtocol.lastAvg);
const _jsonAvgTs = process.hrtime(t5);	
	
		saveOps.unshift({ type: 'put', key: 'appHash', 		value: appState.appHash });
		saveOps.unshift({ type: 'put', key: 'blockHeight', 	value: appState.blockHeight });
		saveOps.unshift({ type: 'put', key: 'appState', 	value: jsonAppState });
		saveOps.unshift({ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.avg', value: jsonAvg });
		
		/**
		let ops = [
			,
			,
			,
			//{ type: 'put', key: 'tbl.system.lastavg', value: JSON.stringify( indexProtocol.lastAvg ) }, 
			// @todo: more db size 
			//save state history to fast revert 
			//{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.appstate', value: appState.appHash + '::' + jsonAppState },
			//TEST{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.tx', value: JSON.stringify(appState.blockStore[0])}
		];
		
		**/
			
		//if I Proposer - lets send Tx 
		if (indexProtocol.isProposer(appState.blockProposer, appState.blockHeight) == true && indexProtocol.node.rpcHealth === true){
/**			
			//check index tokens
			
			//indexProtocol.updateIndexTokens();


			//const t1 = process.hrtime();
			//const tx = 
			indexProtocol.prepareCalculatedRateTx( indexProtocol.lastAvg );
				
			if (indexProtocol.txQueue.length > 0){
				//todo: use async to run all				
				console.log('\n\nAt txHTTP queue: ' + indexProtocol.txQueue.length + '\n\n');
				
				let asyncq = indexProtocol.txQueue;	
				
				asyncq.forEach(function(tx){
					http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:indexProtocol.rpcHttpAgent}, 
					function(resp){
						//console.log('http responce code: ' + resp.statusCode + ' with time: ' + tdiff);
					}).on('error', (e) => {
					  //console.error(`Got error: ${e.message}`);
					});
				});
				
				indexProtocol.txQueue = [];			
			} 
			
**/
			indexProtocol.txQueue = [];				
			
			/**
			if (tx){
				http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:indexProtocol.rpcHttpAgent}, 	function(resp){
					const tdiff = process.hrtime(t1);
								
					console.log('http responce code: ' + resp.statusCode + ' with time: ' + tdiff);
				}).on('error', (e) => {
				  console.error(`Got error: ${e.message}`);
				});
			}
			else {
				console.log('ERROR while building tx');
				process.exit(1);	
			}
			**/
		}
		
		currentThrottleCounter++; 
		
		if (currentThrottleCounter === dbSyncThrottle){
			const time2 = process.hrtime();
			
			return new Promise(function(resolve, reject){
				
				const diff = process.hrtime(time);
				
				//save ops reorder and compactify
				let compactSaveOps = [];
				let _ikeys = [];
				
				saveOps.reverse().forEach(function(s){
					if (s.type == 'put' && s.key){
						if (_ikeys.indexOf( s.key ) === -1){
							_ikeys.push( s.key );
							compactSaveOps.push( s );
						}
					}
				});
				
				
				stateDb.batch(compactSaveOps/*saveOps*/, function (err){
					if (!err){
						let so = saveOps.length; 
						saveOps = []; //reset all planned writes to main db
						currentThrottleCounter = 0;
						
						const diff2 = process.hrtime(time2);
						endBlockTs = process.hrtime( beginBlockTs );
										
						console.log( appState.blockHeight + ' block, dTx: ' + appState.blockStore[0].tx.length + ', time: ' +moment.utc(appState.blockTime).format('HH:mm:ss DD/MM/YYYY')+', proposer: ' + appState.blockProposer + ' (me: ' + (appState.blockProposer == indexProtocol.node.address) + '), save to disc ('+compactSaveOps.length+'/'+so+' ops) - OK. (commit: '+prettyHrtime(diff)+', s: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
					
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
		
		const diff = process.hrtime(time);
		endBlockTs = process.hrtime( beginBlockTs );
		
		console.log( appState.blockHeight + ' block, dTx: ' + appState.blockStore[0].tx.length + ', time: ' +moment.utc(appState.blockTime).format('HH:mm:ss DD/MM/YYYY')+', proposer: ' + appState.blockProposer + ' (me: ' + (appState.blockProposer == indexProtocol.node.address) + '), save queue '+saveOps.length+' ops., (commit: '+prettyHrtime(diff)+', block: '+ prettyHrtime(endBlockTs)+')');
		


	/*

		console.log('Performance. delayTask: ' + prettyHrtime(_delayTaskTs) + 
								', commitHandler: ' + prettyHrtime(_blockCommitTs) + 
								', jsonAppState: ' + prettyHrtime(_JSONTs) + 
								', calcHash: ' + prettyHrtime(_calcHashTs) + 
								', jsonAvg: ' + prettyHrtime(_jsonAvgTs));
	*/	
		
	// Buffer.from(appState.appHash, 'hex')
		return { code: 0 }
	
		
/**		
}catch(e){
	console.log( e );
	
	console.log('ERROR while save state to DB');
	process.exit(1);	
	 
	return { code: 1 }    
} **/
	} 

});


//Quick fix for RocksDB/LevelDOWN, no set option to delete OLD.log.ХХХХ files
setInterval(function(){
	//delete older then 1h
	let ts = new Date().getTime() - (3600 * 1000);
	
	console.log('- ');
	console.log('WARN: Deleting old RocksDB log files (older then 1h, from: ' + moment.unix(Math.trunc(ts/1000)).format('HH:mm DD/MM/YYYY'));
	console.log('WARN: stateDb path: ' + stateDbPath);
	
	if (fs.existsSync( stateDbPath )){
		
		fs.readdir( stateDbPath, function(err, file){
			
			_.each(file, function(f){
				//check file name as LOG.old.XXXX
				if (f.indexOf('LOG.old') === 0){
					let tmp = fs.statSync( stateDbPath + '/' + f );
					let mtime = moment.unix( Math.trunc( tmp.mtime / 1000 ) );
					
					if (moment().diff( mtime, 'minutes') > 60){
						console.log('file: ' + f + ' deleting....');
						
						fs.unlinkSync( stateDbPath + '/' + f );
					}
				}
			});
		} );
	}
	
	console.log('- ');
	
}, 15 * 60 * 1000);

//initial subscribe to events
indexProtocol.eventsSubscribe();

