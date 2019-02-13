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
const storeLatestAvgBlocks = 99; //how many blocks stored for check AVG tx.
const maxDiffFromAppHeight = 30; // avg quote from proposer - how much difference

const fixedExponent = 1000000;
let manualRevertOneBlock = false;

var rpcHttpAgent = new http.Agent({
	keepAlive: true,
	timeout: 15000
});

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
	if (process.argv.indexOf('revertone') != -1){
		console.log( 'WARN:  Manual revert appState to height-1');
		
		manualRevertOneBlock = true;				
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
	node:{
		configDir: '/opt/tendermint/config', 
		address: '', 
		
		//@todo: decode from config
		pubKey: '',	//tendermint/PrivKeyEd25519
		privKey: '',
		
		rpcHost: 'http://localhost:8080', //'http://127.0.0.1:26657', // 'http://localhost:8080',
		rpcHealth: false, //check if local rpc up
	},
	
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
			'options'		: {
				//'blockBeforeConfirmation' 	: 10, //how blocks we need to wait before
				
				'nativeSymbol'				: 'IDXT',  //tiker for native coin at this network
				'initialNativeCoinBalance'	: 1000,
				'defaultSystemAccount'		: 'testnet@indexprotocol.network',
				
				//full reward = rewardPerBlock + (rewardPerDataTx * DataTxCount) + SUMM(TxFee)
				'rewardPerBlock'				: 1000, //reward to Validator for block (base value, for any tx at block)
				'rewardPerDataTx'				: 10,
				
				//add all app options to appState
				//'app'							: {}
			},
			
			dataSource: {},
			
			
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

		server.listen(26658, function(){
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
		console.log(' ************** IMPORTANT!   CLEAN DB ************** ');		
		
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
				console.log('AVG: CheckTx Rates');
				
				//console.dir( z, {depth:8});
				
				//console.log( z[(z.length-1)] );
			
				//@todo: rewrite structure as: hash:sign:pubkey:flags:data
				//check signature 
				if (!z[1])	return { code: 1, log: txType + ': wrong or empty hash'};  
				
				let hash = z[1];
				let data = JSON.parse( Buffer.from( z[(z.length-1)], 'base64').toString('utf8') );
//console.dir( data, {depth:8});
					
				if (!data)	return { code: 1, log: txType + ': wrong data after parsing'};  
/**
console.log('');
console.log('');
console.log('');
console.dir( indexProtocol.latestAvgStore, {depth:64});
console.log('');
		
console.log('indexProtocol.latestAvgStore.length: ' + indexProtocol.latestAvgStore.length);
**/	

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
				
				console.log(' ');
				console.log('WARN: need a Fuzzy check, we not eq with hash');
				console.log(' ');
				
				console.log('Data from proposer: ' + hash);
				console.dir( data, {depth:0});
				console.log(' ');
				console.log('Data from local copy');
				console.dir( localCopy, {depth:1});
				console.log(' ');
				
				
				//@todo: use deep Fuzzy check, every field and scoring system to check eq						
				//check MerkleRoot 
				/*
				if (data.txMerkleRoot == localCopy.data.txMerkleRoot){
					return { code: 0 };
				}
				*/
								
				break;
			}
			
			default: {	
				break;
			}			
		}
		
				
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
		
		//updated format: code:signature:pubkey:txbody		
		let z  = tx.split(':'); //format: CODE:<base64 transaction body>

		if (!tx) return { code: 0, log: 'Wrong tx type' };
		if (!z || z.length < 2) return { code: 0, log: 'Wrong tx type' }; 	 

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
				
				//@todo: remove from this, do this check at checkTx
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
				console.log('AVG: DeliverTx with average calc Rates');
				
				//@possinle optimize - do now double parse
				let data = JSON.parse( Buffer.from( z[(z.length-1)], 'base64').toString('utf8') );
				
				if (data){
					//all check prepared at checkTx (as i known)
					//save this as commited data 
					saveOps.push({ type: 'put', key: 'tbl.block.'+data.blockHeight+'.avg', value: JSON.stringify(data) });
					
					console.log('AVG: Calc Rates commited for height ' + data.blockHeight + ' (diff: ' + (appState.blockHeight - data.blockHeight) + ')');
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
		
		
		beginBlockTs = process.hrtime();
		indexProtocol.curTime = new Date().getTime(); //local node's time
		//initial current block store
		currentBlockStore = [];
		
		
//console.dir( request, {depth:64, colors: true} );
		
		//block time
		appState.blockTime = parseInt( request.header.time.seconds ); 
		
		//console.log( request.header.height + ' block proposerAddress: ' + request.header.proposerAddress.toString('hex') ); 
		appState.blockHash = request.hash.toString('hex');
		appState.blockProposer = request.header.proposerAddress.toString('hex').toLowerCase();
		appState.blockHeight = parseInt( request.header.height.toString() );
		
		console.log('Call: BeginBlock. Height: ' + request.header.height + ', proposer: ' + appState.blockProposer + ', me: ' + (appState.blockProposer == indexProtocol.node.address));  
		
		let numTx = parseInt( request.header.numTxs.toString() );
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
				{ type: 'put', key: 'tbl.system.lastavg', value: JSON.stringify( indexProtocol.lastAvg ) }
				/** @todo: more db size 
				//save state history to fast revert 
				{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.appstate', value: appState.appHash + '::' + jsonAppState },
				**/
				//store only comitted
				//{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.avg', value: JSON.stringify(indexProtocol.lastAvg) },
				//TEST{ type: 'put', key: 'tbl.block.'+appState.blockHeight+'.tx', value: JSON.stringify(appState.blockStore[0])}
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
//console.log('RPC Health: ' + indexProtocol.node.rpcHealth);						
						//if I Proposer - lets send Tx 
						if (indexProtocol.isProposer(appState.blockProposer, appState.blockHeight) == true && indexProtocol.node.rpcHealth === true){
							
							const t1 = process.hrtime();
							const tx = indexProtocol.prepareCalculatedRateTx( indexProtocol.lastAvg );
//console.log( indexProtocol.lastAvg );
//console.log( tx );							
							if (tx){
								
								http.get(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime(), {agent:rpcHttpAgent}, function(resp){
									const tdiff = process.hrtime(t1);
									
									console.log('http responce code: ' + resp.statusCode + ' with time: ' + tdiff);
									//console.dir( resp, {depth: 16} );
									
									
								}).on('error', (e) => {
								  console.error(`Got error: ${e.message}`);
								});
								
								console.log( appState.blockHeight + ' block, data tx: ' + appState.blockStore[0].tx.length + ', appState hash: ' + appState.appHash + ', save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+/*', tx_async: '+prettyHrtime(tdiff)+*/', block: '+ prettyHrtime(endBlockTs)+')');
						
								return resolve( {code: 0} );
								
								
								/**
								
								fetch(indexProtocol.node.rpcHost + '/broadcast_tx_async?tx="' + tx + '"&_=' + new Date().getTime()).then(function(rq){
	console.log( rq );								
									const tdiff = process.hrtime(t1);
									
									console.log( appState.blockHeight + ' block, data tx: ' + appState.blockStore[0].tx.length + ', appState hash: ' + appState.appHash + ', save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', tx_async: '+prettyHrtime(tdiff)+', block: '+ prettyHrtime(endBlockTs)+')');
						
									return resolve( {code: 0} );										
									
								}).catch(function(err){ console.error(err);  return reject( {code:1} ); });
								
								**/
							}
							else {
								console.log('ERROR while building tx');
								process.exit(1);	
							}
							
						}
						else {					
						
							console.log( appState.blockHeight + ' block, data tx: ' + appState.blockStore[0].tx.length + ', appState hash: ' + appState.appHash + ', save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
							
							return resolve( {code: 0} );
						}
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

