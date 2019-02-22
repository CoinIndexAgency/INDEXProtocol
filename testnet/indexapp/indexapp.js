//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const crypto 		= require('crypto');
//const { spawn } 	= require('child_process');
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
let manualRevertOneBlock = false;

let dbSyncThrottle = 1; //how many block per db dics sync
let currentThrottleCounter = 0;

var rpcHttpAgent = new http.Agent({
	keepAlive: true,
	timeout: 15000
});


	if (process.argv.indexOf('cleandb') != -1){
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
		
		console.log('All app DB cleared and removed... OK\n\n');
	}
	
	//reverto <nubblock>
	if (process.argv.indexOf('revertone') != -1){
		console.log( 'WARN:  Manual revert appState to height-1');
		
		manualRevertOneBlock = true;				
	}
	
	//save throttle
	if (process.argv.indexOf('savesync') != -1){
		console.log( 'INFO:  Manual save sync ');
		
		let _t = Math.abs( parseInt( process.argv[ process.argv.indexOf('savesync')+1 ] ) );
		
		if (_t > 100)
			_t = 99;
		
		dbSyncThrottle = _t;				
	}	
	
	
	
//Try to open private Key of node or create if no exists
let nodePrivKey = null;

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

//test version of lib
let indexProtocol = {   
	node:{
		configDir: '/opt/tendermint/config', 
		address: '', 
		
		//@todo: decode from config
		pubKey: '',	//tendermint/PrivKeyEd25519
		privKey: '',
		
		rpcHost: 'http://localhost:8080', //'http://127.0.0.1:26657', // 'http://localhost:8080',
		rpcHealth: false, //check if local rpc up
	},
	
	accountsStore : {}, //local in-memory account storage 
/**	
		'MCPqykgZUJPb72vC9kgPRC6vvZm' : {
			ids					:['MCPqykgZUJPb72vC9kgPRC6vvZm', 'token@indexprotocol.network', 'token@indexprotocol.online','indx.coin@indexprotocol.network'], 	//array of any string-based ids (global uniq!) associate with account
			name				: 'token@indexprotocol.network',		//main name, if associated		
			address				: 'MCPqykgZUJPb72vC9kgPRC6vvZm',
			createdBlockHeight	: 1,
			updatedBlockHeight  : 1,
			type				: 'system',
			nonce				: 0, //count tx from this acc
			data				: {
				assets				: [
					{ symbol : 'INDX', amount: 9007199254740991, nonce: 0 }
				],
				messages			: [],
				storage				: []
			},
			pubKey				: '04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179'
		}
	}, 
**/	
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
				'nativeSymbol'				: 'IDXT',  //tiker for native coin at this network
				'initialNativeCoinBalance'	: 1000,
				'defaultSystemAccount'		: 'testnet@indexprotocol.network',
				
				//full reward = rewardPerBlock + (rewardPerDataTx * DataTxCount) + SUMM(TxFee)
				'rewardPerBlock'				: 1000, //reward to Validator for block (base value, for any tx at block)
				'rewardPerDataTx'				: 10
			},
			
			'dataSource': {},
			
			'validatorStore':{}, //state of validators balances, emission of each block. Balances ONLY at nativeSymbol
			
			// !!!!!!!!!!! prototype 
			//@todo: replace as user storages
			'assetStore'	:	{
				'IDXT': {
					emissionBlockHeight	: 1,
					initial				: 9007199254740991,
					type				: 'coin', //coin for native coin, token for user assets, contract - for derivative contracts
					divider				: 1000,
					maxSupply			: 9007199254740991,
					emission			: 0, //emission per block
					owner				: 'MCPqykgZUJPb72vC9kgPRC6vvZm', //address of emitent
										
					tx: []
				}
			}, //symbols registry DB
			
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

					nodePrivKey.pubKey = _ecdh.getPublicKey('hex');
				}
			}

			if (!nodePrivKey){
				console.log('***** WARNING! No account key (file: .account.json) *****');
				console.log('New account key (private key) will be created and store');

				let 	_ecdh = crypto.createECDH('secp256k1');
						_ecdh.generateKeys();
					
				let privKey = _ecdh.getPrivateKey();
				let pubKey 	= _ecdh.getPublicKey();
				
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
					
					if (manualRevertOneBlock === true){
						
						console.log('\n');
						console.log('WARN: appState.blockHeight at db: ' + appState.blockHeight);
						console.log('WARN: manual rollback state (todo: height only) to -1, for: ' + (appState.blockHeight - 1));
						console.log('\n');
						
						appState.blockHeight = appState.blockHeight - 1;
						
						events.emit('appStateRestored');
						
						return;
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
							
//@todo DISABLE FOR DEV
							if (loadedAppHash === calcAppHash){
								appState.appHash = calcAppHash;
								
								console.log('State loaded OK\n');
								events.emit('appStateRestored');
								/**
								stateDb.get('tbl.system.lastavg', function(err, val){
									if (!err && val && Buffer.isBuffer(val)){
										val = JSON.parse( val.toString('utf8') );
										
										if (val){
											
											indexProtocol.lastAvg = val;
											
											console.log('Latest stored calcs AVG loaded OK');
											
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

		server.listen('/opt/tendermint/tendermint.socket'/*26658*/, function(){
			console.log('ABCI server started OK');
			
			//run periodical check local RPC 
			setInterval(function(){
				fetch(indexProtocol.node.rpcHost + '/health', {agent: rpcHttpAgent})
					.then(res => res.json())
					.then(function(json){
						if (json && json.result && !json.error){
							if (indexProtocol.node.rpcHealth === false){
								indexProtocol.node.rpcHealth = true;
								
								console.log('');
								console.log('[INFO] local node RPC interface now online at: ' + indexProtocol.node.rpcHost);
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
	
	/**
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
	**/
	
	//need to replace !
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
		return tx;		
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
			
			let aBuf = Buffer.from(request.appStateBytes.toString('utf8'), 'base64').toString('utf8');
			let genesisAppState = JSON.parse( aBuf );
			
			//assign options 
			if (genesisAppState.options){
				appState.options = _.extend( appState.options, genesisAppState.options );
			}
			
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
						
						//save to global lookup tbl
						//@todo: check it't uniques
						saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.pubKey, value: data.address});
						saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.address, value: data.pubKey});
						saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.' + data.address, value: data.address}); //self to search with any field
						
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
						
						if (data.data.assets.length == 0){
							//fix native currency balance 
							data.data.assets.push({symbol: appState.options.nativeSymbol, amount: 0});
						}
						
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
						
						indexProtocol.accountsStore[ v.to ].data.assets.push( {symbol: v.symbol, amount: v.amount} );
						
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
			/**
			
			console.dir( genesisAppState, {depth: 16, color: true});
		
			console.log(' ');
		
			process.exit();
			***/
			
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
			
			lastBlockHeight: appState.blockHeight 
			//lastBlockAppHash: appState.appHash  //now disable for debug
		};
		
		//console.log('Restored from DB latest snapshot');
		//console.dir( [appState.version, appState.appVersion, appState.blockHeight], {depth:4} );

		return  responce;
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
					
					http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:rpcHttpAgent}, function(resp){
						
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
						if (!err && val){
							console.log('Query fetch: latest appState');
							
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
			if (path === 'getallaccounts'){
				let maxCountAddr = 1000; //maximum of addresses
				let _res = [];
				
				_.each(indexProtocol.accountsStore, function(v, addr){
					if (_res.length > maxCountAddr) return;
					
					let _amount = 0;
					
					//find balance at IDXT 
					if (v.data.assets.length > 0){
						let obj = _.find(v.data.assets, function(bal){
							
							//console.log( [bal, bal.symbol, appState.options.nativeSymbol, (bal.symbol == appState.options.nativeSymbol)]  );
							
							if (bal.symbol == appState.options.nativeSymbol)
								return true;
						});
					
						if (obj && obj.amount){
							_amount = parseInt( obj.amount );
							
							let dvd = appState.assetStore[ appState.options.nativeSymbol ].divider;
							
							if (dvd > 1){
								_amount = Number(_amount / dvd).toFixed(2);
							}
						}
					}
					
					_res.push({
						address	:	v.address,
						name	:	v.name,
						height	:	v.createdBlockHeight,
						type	:	v.type,
						nonce	: 	v.nonce,
						balance :	_amount, //balance of native coin
						pubKey	: 	v.pubKey,
						
						_ts		: new Date().getTime()
					});
					
				});
	
				return {code: 0, value: Buffer.from(JSON.stringify( _res ), 'utf8').toString('base64')};
			}
			else
			if (path === 'tbl.assets.all'){
				let maxCountAssets = 1000; //maximum of asset
				let _res = [];
				
				_.each(appState.assetStore, function(v){
					if (_res.length > maxCountAssets) return;
					
					_res.push( v );
					
				});
	
				return {code: 0, value: Buffer.from(JSON.stringify( _res ), 'utf8').toString('base64')};
			}
		}
		
		return { code: 1 };
	},
  
	checkTx: function(request) {
		//console.log('Call: CheckTx', request);   
		
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
					console.log('No local data from this height.');
					//@todo: if nothing data - what to do?
					return { code: 1 };
				}
				
				//check height: if current height more then N distance from quote, stop to propagate it 
				if (Math.abs(appState.blockHeight - data.blockHeight) >= maxDiffFromAppHeight){
					console.log( 'Quote from proposer and local has big difference by height: ' + appState.blockHeight + ' (app), ' + data.blockHeight + ' (tx)');
					
					return { code: 1 };
				}
				
				//simple check - hash only (?)
				if (hash == localCopy.hash){
					console.log( 'Quote from proposer and local will eq by hash: ' + hash + ' === ' + localCopy.hash);
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
				
				if (z.length != 6)		return { code: 1, log: txType + ': wrong tx length'};
				if (!z[(z.length-1)]) 	return { code: 1, log: txType + ': empty data'}; 
				if (!z[1])				return { code: 1, log: txType + ': wrong or empty hash'}; 
				if (!z[3])				return { code: 1, log: txType + ': wrong public key'}; 
				
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
								
								return resolve({code: 1, log: 'Address already exists'});
							}
							
							return resolve( {code: 0} );
						}
						else
							return resolve( {code: 0} );
						
					});
				});
				
				break;
			}
			
			default: {	
				break;
			}			
		}
				
		return { code: 0 }; 
	},

	deliverTx: function(request) {
try {
		//console.log('Call: DeliverTx');    
		let tx = request.tx.toString('utf8'); //'base64'); //Buffer 
		
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
			
			//new account register action 
			//code:hash:sign:pubkey:flags:data
			case 'REG' : {				
				console.log('REG: deliverTx call');
				
				let hash = z[1].toLowerCase(); 
				let sign = z[2].toLowerCase(); 
				let pubk = z[3].toLowerCase();
				let flags = z[4].toLowerCase();
				let rawData = Buffer.from( z[(z.length-1)], 'base64').toString('utf8');
				
				let data = JSON.parse( rawData );
				
				if (data){
					let _hash = sha256( rawData );
					
					if (_hash.toString('hex').toLowerCase() != hash){
						console.log('REG: Invalid hash, compute and stored/signed');
						
						return { code: 1, log: 'Invalid hash' };
					}
			
					let checkSign = secp256k1.verify(_hash, Buffer.from(sign, 'hex'), Buffer.from(pubk, 'hex'));
					
					if (checkSign != true){
						console.log('REG: Invalid signature');
						
						return { code: 1, log: 'Invalid signature' };   
					}
					
					if (!data.address || !data.ids || data.ids.length < 1){
						console.log('REG: Invalid or empty address');
						
						return { code: 1, log: 'Invalid or empty address' };
					}
					
					//fix to older addresses, without prefix 
					if (data.address.indexOf(appState.options.addressPrefix) !== 0){
						return { code: 1, log: 'Address at old format, invalid' };
					}
					
					data.createdBlockHeight = appState.blockHeight;
					data.updatedBlockHeight = appState.blockHeight;
					
					appState.accountStore.push( data.address );
					
					//Save to systems accounts 
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+pubk, value: data.address});
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+data.address, value: pubk});
					saveOps.push({type: 'put', key: 'tbl.accounts.__lookup.'+data.address, value: data.address});
					saveOps.push({type: 'put', key: 'tbl.accounts.'+data.address, value:JSON.stringify( data )});
					
					indexProtocol.accountsStore[ data.address ] = data;
					
					console.dir( data, {depth:8} );
					
					return { code: 0, log: 'REG:' + data.address }; //, log: 'REG:' + x.name + ';' + x.addr + ';OK' };
				}
				else
					return { code: 1, log: 'Invalid data of reg tx' };
		
				break;
			}
			
			default: {	//DEBUG
				return { code: 0, log: 'Unknown tx type' };
			}
		}

		
}catch(e){
	console.log('Erroro while deliverTx app handler');
	console.dir( e, {depth:16, colors: true});
	
	return { code: 0 };
}					
finally {
	return { code: 0 }; 	
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
		
		
		beginBlockTs = process.hrtime();
		indexProtocol.curTime = new Date().getTime(); //local node's time
		//initial current block store
		currentBlockStore = [];
		
		
//	console.dir( request.header.time, {depth:8, colors: true} );
		
		//block time - UTC
		appState.blockTime = parseInt( request.header.time.seconds + '' + Math.trunc(request.header.time.nanos/1000000) ); 
		
//console.dir( appState.blockTime, {depth:8, colors: true} );
		
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
  
	endBlock: function(request){
		let hx = parseInt( request.height.toString() );
		
		if (hx != appState.blockHeight){
			console.log('PANIC! endBlock.height !== beginBlock.height and !== appSate.height');
			process.exit(1);
		}
		
		
//console.dir( request, {depth:16, colors: true});		
		
		
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
try {
		const time = process.hrtime();
		//events.emit('blockCommit', appState.blockHeight);
		if (delayedTaskQueue.length > 0){
			indexProtocol.processDelayedTask( appState.blockHeight ); //
			
			delayedTaskQueue = [];
		}
				
		indexProtocol.blockCommitHandler( appState.blockHeight );
		
		endBlockTs = process.hrtime( beginBlockTs ); 

		if (appState.appHash == ''){
						
			//create full string
			let jsonAppState = JSON.stringify( appState );//stringify
			
			//calc actual hash
			appState.appHash = indexProtocol.calcHash( jsonAppState, false);
			
			saveOps.unshift({ type: 'put', key: 'appHash', 		value: appState.appHash });
			saveOps.unshift({ type: 'put', key: 'blockHeight', 	value: appState.blockHeight });
			saveOps.unshift({ type: 'put', key: 'appState', 	value: jsonAppState });
			saveOps.unshift({ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.avg', value: JSON.stringify(indexProtocol.lastAvg) });
			
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
			
			if (saveOps.length > 0){
				ops = ops.concat( saveOps );
			}
			**/
			
			const diff = process.hrtime(time);	
			const time2 = process.hrtime();
			const diff2 = process.hrtime(time2);
						
			//if I Proposer - lets send Tx 
			if (indexProtocol.isProposer(appState.blockProposer, appState.blockHeight) == true && indexProtocol.node.rpcHealth === true){
							
				const t1 = process.hrtime();
				const tx = indexProtocol.prepareCalculatedRateTx( indexProtocol.lastAvg );

				if (tx){
					http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:rpcHttpAgent}, 	function(resp){
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
			}
			
			currentThrottleCounter++; 
			
			if (currentThrottleCounter === dbSyncThrottle){
				
				return new Promise(function(resolve, reject){
					stateDb.batch(saveOps, function (err){
						if (!err){
							let so = saveOps.length; 
							saveOps = []; //reset all planned writes to main db
							currentThrottleCounter = 0;
											
							console.log( appState.blockHeight + ' block, dTx: ' + appState.blockStore[0].tx.length + ', time: ' +moment.utc(appState.blockTime).format('HH:mm:ss DD/MM/YYYY')+', proposer: ' + appState.blockProposer + ' (me: ' + (appState.blockProposer == indexProtocol.node.address) + '), save to disc ('+so+' op) - OK. (commit: '+prettyHrtime(diff)+', s: '+prettyHrtime(diff2)+/*', tx_async: '+prettyHrtime(tdiff)+*/', b: '+ prettyHrtime(endBlockTs)+')');
						
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
			
			console.log( appState.blockHeight + ' block, dTx: ' + appState.blockStore[0].tx.length + ', time: ' +moment.utc(appState.blockTime).format('HH:mm:ss DD/MM/YYYY')+', proposer: ' + appState.blockProposer + ' (me: ' + (appState.blockProposer == indexProtocol.node.address) + '), save queue '+saveOps.length+' ops., (commit: '+prettyHrtime(diff)+', s: '+prettyHrtime(diff2)+', b: '+ prettyHrtime(endBlockTs)+')');

		// Buffer.from(appState.appHash, 'hex')
			return { code: 0 }
		}
		else 
			process.exit(42);
		
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


/**
//@todo: optimize this, mybe explode to dedicated rocksdb base for accounts only
//save accounts store every minute 
setInterval(function(){
	console.log('CheckPoint: save all Accounts from memory to db as snapshot');
	
	var _tmp = JSON.stringify( indexProtocol.accountsStore );
	
	if (_tmp){
		
		stateDb.put('accountsStore', _tmp, function(err){
			if (!err)
				console.log('CheckPoint OK: successfull store accounts to rocksDb at disk');
		});
	}
	else
		console.log('Error at checkpoit accounts save');
	
}, 1 * 60 * 1000); 
**/


//

//===

//initial subscribe to events
indexProtocol.eventsSubscribe();

