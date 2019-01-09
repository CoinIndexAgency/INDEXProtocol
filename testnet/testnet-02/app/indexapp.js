//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const crypto 		= require('crypto');
const { spawn } 	= require('child_process');
const fs			= require('fs');
let _				= require('underscore');
//let stringify 		= require('fast-json-stable-stringify');
var emitter			= require('events');
const events 		= new emitter();
var prettyHrtime 	= require('pretty-hrtime');
var rocksdown 		= require('rocksdb');
var async 			= require('async');
//const zlib 			= require('zlib');
//const http 			= require('http');
//const keepAliveAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 300*1000 });

process.on('uncaughtException', (err) => {
  console.log('\n     *** ERROR ***   \n ' + err);
  
  if (stateDb && stateDb.status == 'open')	stateDb.close(function(){});
  if (tradesDb && tradesDb.status == 'open')	tradesDb.close(function(){});
  //if (dataDb && dataDb.status == 'open')	dataDb.close(function(){});
  
  console.log('\n');  
  
  process.exit(0);
});

process.on('exit', (code) => {
	if (code > 0){
		console.log('App exit with code: ' + code);
		
		if (stateDb && stateDb.status == 'open')	stateDb.close(function(){});
		if (tradesDb && tradesDb.status == 'open')	tradesDb.close(function(){});
		//if (dataDb && dataDb.status == 'open')	dataDb.close(function(){});
		
		console.log('\n');
	}
});



const storeLatestBlocks = 900; //how many blocks decoded and stored
//const storeAvgQuotes = 1 * 3600; //from last hour
const fixedExponent = 1000000;

var startTendermintNode = false; 
const stateDbPath 	= '/opt/tendermint/app/db/state.db'; //stateDb
const tradesDbPath 	= '/opt/tendermint/app/db/trades.db'; //source quotes
//const dataDbPath  	= '/opt/tendermint/app/indexapp/db/data'; //avg calced quotes

	if (process.argv.indexOf('cleandb') != -1){
		console.log('\n     *** WARNING ***     \n');
		console.log('Destroy ALL data from application db. All data will be losted!');
		console.log('Clearing app state...');
				
		fs.rmdirSync( stateDbPath );
		fs.rmdirSync( tradesDbPath );
				
		console.log('All app DB cleared and removed... OK\n\n');
	}

const stateDb 	= rocksdown( stateDbPath ); //stateDb
const tradesDb 	= rocksdown( tradesDbPath ); //source quotes
//const dataDb  	= rocksdown( dataDbPath ); //avg calced quotes

//options for RocksDB
const rocksOpt = {
	createIfMissing: true,
	errorIfExists: false,
	compression: true,
	
	target_file_size_base: 4 * 1024 * 1024
};

	async.parallel({
		stateDb: function(callback) {
			stateDb.open(rocksOpt, function(err){
				if (!err){
					//waiting for status
					var t = setInterval(function() {
							if (stateDb.status != 'open') return;
							
							console.log('stateDb opened and ready');
							clearInterval( t );								
							callback(null, 1);
						}, 250);
				}
				else
					callback('stateDb opening error: ' + err, 0);
			});
		},
		tradesDb: function(callback) {
			tradesDb.open(rocksOpt, function(err){
				if (!err){
					//waiting for status
					var t = setInterval(function() {
							if (tradesDb.status != 'open') return;
							
							console.log('tradesDb opened and ready');
							clearInterval( t );								
							callback(null, 1);
						}, 250);
				}
				else
					callback('tradesDb opening error: ' + err, 0);
			});
		}/**,
		dataDb: function(callback) {
			dataDb.open(rocksOpt, function(err){
				if (!err){
					//waiting for status
					var t = setInterval(function() {
							if (dataDb.status != 'open') return;
							
							console.log('dataDb opened and ready');
							clearInterval( t );								
							callback(null, 1);
						}, 250);
				}
				else
					callback('dataDb opening error: ' + err, 0);
			});
		} **/
	}, function(err, results) {
		// results is now equals to: {one: 1, two: 2}
		if (err){
			console.log('Error while opening rocksdb instance. Panic error!');
			process.exit(1);
		}
		else {
			//OK, all DB ready to work
			events.emit('dbReady');
		}
	});
	

if (process.argv[2] == 'app')
	startTendermintNode = false;

var tendermintLogDebug = '';

if (process.argv[2] == 'debug'){
	
	tendermintLogDebug = "--log_level='*:debug'"; 
	
	console.log('Clearing app state... OK\n');
}

let currentBlockStore = []; //current unconfirmed block tx
let tendermint 		= null; //Tendermint core process

//test version of lib
let indexProtocol = {
	getDefaultState: function(){
		return {
			'version'		: 'indx-testnet-01',
			'appVersion'	: '1',	//for testnet app only!
			'appHash'		: '', 	//current AppHash (sha-256)
			'previousAppHash' : '',
			'blockHeight'	: 0,	//current height
			
			'blockStore' 	: [],  //filled by transactions (by 900 block)
			
			'dataStore'		: null	//latest avg data	
		};
	},
	
	eventsSubscribe: function(){
		events.on('blockCommit', indexProtocol.blockCommitHandler);
		
		events.on('dbReady', indexProtocol.loadState);
		
		events.on('appStateRestored', indexProtocol.startTendermintNode);
		
		events.on('nodeStarted', indexProtocol.startAbciServer);
	},
	
	//some handlers
	loadState: function(){
		console.log('Reading latest app state from db: ' + stateDbPath + '\n');
	
		if (stateDb.status == 'open'){
			//reads All data by separate key
			let tasks = {};
						
			_.each(appState, function(v, i){
				
				tasks[ i ] = function(cb){
					stateDb.get(i, function(err, val){
						//console.dir( err, {depth:4, colors: true } );
						
						if (!err && val){
							
							if (Buffer.isBuffer(val)){
								val = val.toString('utf8');								
							}
													
							//console.debug( [i, val] );
							
							cb(null, val);
						}
						else
						if (err && err.toString() == 'Error: NotFound: '){
							console.log('appState.' + i + ' revert to default val: '+appState[i]+'');
							
							cb(null, appState[i]);
						}
						else
							cb(err, null);
					});
				};		
			});
			
			
			async.parallel(tasks, function(err, res){
				if (err) {
					console.log('Ooops!', err);
					
					process.exit(1);
				}
				
				_.each(res, function(val, i){
					if (['blockStore', 'dataStore'].indexOf( i ) != -1){
						
						if (!_.isEmpty(val))
							val = JSON.parse( val );
					} 
					
					if (['appVersion', 'blockHeight'].indexOf( i ) != -1){
						val = parseInt( val );
					}
					
					appState[ i ] = val;
				});
				
				//calc new state
				appState.appHash = indexProtocol.calcStateHash(); 
				
				console.log('hash: ' + appState.appHash + '\nprev: ' + appState.previousAppHash);
				console.log('appState restored... OK');			
				
				events.emit('appStateRestored');
				
				//console.debug( res );
			});
		}
		else {
			console.log('Error, stateDb not ready to work. Status: ' + stateDb.status + '\n');
			process.exit(1);		
		}
	},
	
	calcStateHash: function(){
		let hash = crypto.createHash('sha256');
			hash.update( /*JSON.stringify(appState)*/ '', 'utf8' );
		let appHashHex = hash.digest('hex');
			
		return appHashHex;
	},
	
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
	
	startAbciServer: function(){
		console.log('ABCI Server starting...');

		server.listen(26658, function(){
			console.log('ABCI server started OK');
			
			events.emit('AbciServerStarted');
		});
	},
	
	blockCommitHandler: function(height){
		//if length of blocks more then 900
		if (appState.blockStore.length == 900){
			
			let calcAvg = {
				symbol: 'BTC/USD',
				
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
				
				timeFrom: 0,
				timeTo: 0,
				
				trxIncluded: 0,
				//blocksIncluded: [], test performance
				exchangesIncluded: []
			};
			
			//let txHashes = []; //hashes of all tx 
			let calcAvgHash = ''; //sha256 of quote
			
			var _tx = [];
			var _avg = [];
			//var _blocks = []; //ids of blocks, included in
			
			_.each(appState.blockStore, function(v){
				if (v.tx.length > 0){
					_tx = _tx.concat( v.tx );
					
					_avg.push( v.avgQuote );
					
					//calcAvg.blocksIncluded.push( v.Height );
				}
			});
			
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

					//txHashes.push( v._hash );	
					
					//vwap = vwap + v.total
					
					if (v.excode)
						calcAvg.exchangesIncluded.push( v.excode );
				});
				
				if (x > 0) calcAvg.avgPrice = parseInt( x / _tx.length );
				if (y > 0) calcAvg.totalAmount = parseInt( y );
				if (z > 0) calcAvg.totalVolume = parseInt( z );
				
				if (z > 0 && y > 0)
					calcAvg.vwapPrice = parseInt( ( calcAvg.totalVolume / calcAvg.totalAmount ) * fixedExponent );
				
				var min = Number.MAX_SAFE_INTEGER, max = 0;
				
				_.each(_avg, function(v){
					if (v.minPrice < min)
						min = v.minPrice;
					
					if (v.maxPrice > max)
						max = v.maxPrice;
				});
				
				calcAvg.minPrice = min;
				calcAvg.maxPrice = max;
				
				calcAvg.trxIncluded = _tx.length;			
				calcAvg.exchangesIncluded = _.uniq( calcAvg.exchangesIncluded, false );
			}
			
			/*
			if (appState.dataStore.length == storeAvgQuotes){
				var tmp = appState.dataStore.pop();
				delete tmp;
			}
			*/
			
			appState.dataStore = calcAvg;
		}
	},
	
	//save new data 
	saveDataResult: function(data, fromHeight){
		if (stateDb.status == 'open'){
			stateDb.put('block.' + fromHeight, JSON.stringify( data ), function(err){});
		}
	},
	
	//save 15min (900 block) avg quote 
	saveAvgResult: function(data, fromHeight){
		if (stateDb.status == 'open'){
			stateDb.put('block.avg.' + fromHeight, JSON.stringify( data ), function(err){});
		}
	},
	
	//tbd    
	saveTradeResult: function(data, fromHeight){
		if (tradesDb.status == 'open'){
			tradesDb.put('block.' + fromHeight, JSON.stringify( data ), function(err){});
		}
	}
}

//APP state
let appState = indexProtocol.getDefaultState();
let beginBlockTs = 0; // process.hrtime();
let endBlockTs = 0;

//var _queueToCommit = [];

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

		return { code: 0 };
	},
  
	checkTx: function(request) {
		//console.log('Call: CheckTx', request);   
		// let tx = request.tx;
		return { code: 0, log: 'tx succeeded' }
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

		return { code: 0, log: 'tx succeeded' };
	},
  
	beginBlock: function(request) {
		//console.log('Call: BeginBlock. Height: ' + request.header.height);  

		//initial current block store
		currentBlockStore = [];

		beginBlockTs = process.hrtime();
		
		/**
		//async save latest data 
		if (appState.dataStore){
			//save latest block to db
			indexProtocol.saveAvgResult( appState.dataStore, appState.dataStore.blockHeight );
		}
		*/
		return { code: 0 };
	},
  
	endBlock: function(request){
		let hx = parseInt( request.height.toString() );

		if (appState.blockStore.length == storeLatestBlocks){
			var tmp = appState.blockStore.pop();
		}

		//update only non-empty block
		if (currentBlockStore.length > 0){
			//lets calc some avg stat of block 
			let avgQuote = {
				blockHeight: hx, 
				
				avgPrice: 0,
				minPrice: 0,
				maxPrice: 0,
				
				vwapPrice: 0,
				
				totalVolume: 0,
				totalAmount: 0,
				
				totalTx: currentBlockStore.length,
				exchangesIncluded: []
			}
			
			var x = 0, y = 0, z = 0, vwap = 0;
			var p = [];
				
			_.each(currentBlockStore, function(v){
				x = x + v.price;
				y = y + v.amount;
				z = z + v.total;
				
				vwap = vwap + (v.total); // / fixedExponent);
				
				p.push( parseFloat( v.price ) );
				
				if (v.excode)
					avgQuote.exchangesIncluded.push( v.excode );
			});
			
			if (x > 0) avgQuote.avgPrice = parseInt( x / currentBlockStore.length );
			if (y > 0) avgQuote.totalAmount = parseFloat( y );
			if (z > 0) avgQuote.totalVolume = parseFloat( z );
			
			avgQuote.minPrice = _.min( p );
			avgQuote.maxPrice = _.max( p );
			avgQuote.vwapPrice = parseInt( (vwap / avgQuote.totalAmount ) * fixedExponent );
			
			avgQuote.exchangesIncluded.sort();			
			avgQuote.exchangesIncluded = _.uniq( avgQuote.exchangesIncluded, true );
			
			//console.debug( avgQuote );		
			appState.blockStore.unshift( { Height: hx, tx: currentBlockStore, avgQuote: avgQuote } );
		}
		else
			appState.blockStore.unshift( { Height: hx, tx: currentBlockStore, avgQuote: null } );

		appState.blockHeight = hx;

		appState.previousAppHash = appState.appHash;
		appState.appHash = '';

		console.log('EndBlock. Height: ' + hx + ', tx count: ' + currentBlockStore.length ); 

		return { code: 0, log: 'endBlock succeeded' };
	},

	//Commit msg for each block.
	commit: function(){
		//console.log('Call: Commit block'); 

		events.emit('blockCommit', appState.blockHeight);

		endBlockTs = process.hrtime( beginBlockTs ); 

		if (appState.appHash == ''){
			const time = process.hrtime();
			
			let hash = indexProtocol.calcStateHash();
			
			/* test speed
			let hash = crypto.createHash('sha256');
			let jsonAppState = JSON.stringify( appState ); //stringify( appState );
			
				hash.update( jsonAppState, 'utf8' );
			let appHashHex = hash.digest('hex');
			*/
			
			appState.appHash = hash; //appHashHex; 
			
			//let gzip = zlib.createGzip({level: 6});
			
			/** gzip version
			//Sync store 
			fs.writeFileSync( stateFilePath,
				zlib.gzipSync(Buffer.from(jsonAppState, 'utf8'), {level: 6}), {encoding: 'binary', flag: 'w'});
			**/
			const diff = process.hrtime(time);	
			const time2 = process.hrtime();
   
			//indexProtocol.saveTradeResult(  appState.blockStore[0].avgQuote, appState.blockHeight);
			
			//for restart, use -900 blocks as state 
			
			var  tmp = JSON.stringify(appState.dataStore);
			
			var ops = [
				{ type: 'put', key: 'appHash', value: appState.appHash },
				{ type: 'put', key: 'previousAppHash', value: appState.previousAppHash },
				{ type: 'put', key: 'blockHeight', value: appState.blockHeight },
				
				{ type: 'put', key: 'blockStore', value: JSON.stringify(appState.blockStore) },
				{ type: 'put', key: 'dataStore', value: tmp}, //possible to optimize

				{ type: 'put', key: 'block.avg.' + appState.blockHeight, value: tmp},
				{ type: 'put', key: 'block.txa.' + appState.blockHeight, value: JSON.stringify(appState.blockStore[0].avgQuote) }
			];
			
			stateDb.batch(ops, function (err){
				if (!err){
					const diff2 = process.hrtime(time2);
			
					console.log('New appState hash: ' + hash + ', appState save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
				}
				else {
					console.log('ERROR while save state to DB');
					process.exit(1);						
				}
			});
			
			
			
			//test fs.writeFileSync( stateFilePath, jsonAppState, {encoding: 'utf8', flag: 'w'});
					
			
	}

	/**
	let hash = crypto.createHash('sha256');
	let appHashHex = '';

	if (AppHash == false){ //changed by this block

		//calc App state 
		AppHash = hash.update( TXHash, 'utf8' ).update( STATEHash, 'utf8' );
		
		appHashHex = AppHash.digest('hex');

		console.log('New app hash: ' + appHashHex);
	}

	//фиксируем хеш и номер блока
	//redix.hmset(['appState', 'appHash', appHashHex, 'blockHeight', Height.toString(), 'version', VERION, 'appVersion', APP_VERION]);
	*/

	// Buffer.from(appState.appHash, 'hex')
	return { code: 0, log: 'Commit succeeded' }
	} 

});

/**
//=== Debug
setInterval(function(){
	
	console.log('\n');
	
	console.dir( appState , {depth:4, colors: true });
	
	console.log('\n');
	
	
}, 60000);
**/
//===

//initial subscribe to events
indexProtocol.eventsSubscribe();

