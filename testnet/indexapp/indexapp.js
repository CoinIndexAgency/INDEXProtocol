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


const storeLatestBlocks = 900; //how many blocks decoded and stored
const storeAvgQuotes = 1 * 3600;
const fixedExponent = 1000000;
const saveAvgStatePeriod = 1; //how blocke before save to disk state

var startTendermintNode = true; 
const stateDbPath 	= '/opt/tendermint/app/indexapp/db/state'; //stateDb
const tradesDbPath 	= '/opt/tendermint/app/indexapp/db/trades'; //source quotes
const dataDbPath  	= '/opt/tendermint/app/indexapp/db/data'; //avg calced quotes

const stateDb 	= rocksdown( stateDbPath ); //stateDb
const tradesDb 	= rocksdown( tradesDbPath ); //source quotes
const dataDb  	= rocksdown( dataDbPath ); //avg calced quotes

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
		},
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
		}
	}, function(err, results) {
		// results is now equals to: {one: 1, two: 2}
		if (err){
			console.log('Error while opening rocksdb instance. Panic error!');
			process.exit(1);
		}
		else {
			
			if (process.argv.indexOf('cleandb') != -1){
				//fs.unlinkSync( stateFilePath );
				console.log('\n     *** WARNING ***     \n');
				console.log('Destroy ALL data from application db. All data will be losted!');
				console.log('Clearing app state...');
				
				async.parallel([
					function(callback){
						stateDb.destroy( stateDbPath, function(){
							console.log('stateDb removed at ' + stateDbPath);
							
							callback(null);
						});
					},
					function(callback){
						tradesDb.destroy( tradesDbPath, function(){
							console.log('tradesDb removed at ' + tradesDbPath);
							
							callback(null);
						});
					},
					function(callback){
						dataDb.destroy( dataDbPath, function(){
							console.log('dataDb removed at ' + dataDbPath);
							
							callback(null);
						});
					}],
					function(err, res){
						
						console.log('All app DB cleared and removed... OK');
						console.log('By!\n');
						
						process.exit();
				});
			}
			
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
			
			'blockStore' 	: [],  //decoded transactions from latest N block
			
			'dataStore'		: []	//filled by transactions	
		};
	},
	
	eventsSubscribe: function(){
		events.on('blockCommit', indexProtocol.blockCommitHandler);
		
		events.on('dbReady', indexProtocol.loadState);
	},
	
	//some handlers
	loadState: function(){
		console.log('Reading latest app state from db: ' + stateDbPath);
	
		if (stateDb.status == 'open'){
			//reads All data by separate key
			let tasks = {};
			
			_.each(appState, function(v, i){
				
				tasks[ i ] = function(cb){
					stateDb.get(i, function(err, val){
						if (!err && val){
							console.debug( val );
							
							cb(null, {i : val});
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
				
				console.debug( res );
			});
		}
		else {
			console.log('Error, stateDb not ready to work. Status: ' + stateDb.status + '\n');
			process.exit(1);		
		}
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
				blocksIncluded: [],
				exchangesIncluded: []
			};
			
			let txHashes = []; //hashes of all tx 
			let calcAvgHash = ''; //sha256 of quote
			
			var _tx = [];
			var _avg = [];
			//var _blocks = []; //ids of blocks, included in
			
			_.each(appState.blockStore, function(v){
				if (v.tx.length > 0){
					_tx = _tx.concat( v.tx );
					
					_avg.push( v.avgQuote );
					
					calcAvg.blocksIncluded.push( v.Height );
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

					txHashes.push( v._hash );	
					
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
			
			if (appState.dataStore.length == storeAvgQuotes){
				var tmp = appState.dataStore.pop();
				delete tmp;
			}
			
			//todo: store full history to disk db
			
			appState.dataStore.unshift( calcAvg );
						
			//console.debug( calcAvg );
		}
	},
	
	//todo: store at dedicated worker
	saveResultAsTx: function(txType, data){
		return;
		//console.log('SAVE to chain avg data');
		
		var _tx = txType + ':' + Buffer.from(data, 'utf8').toString('base64');
		let _ = new Date().getTime();
		
		var _url = 'http://localhost:26657/broadcast_tx_sync?tx="'+_tx+'"&_='+_;
		
		//console.log( _url );
		
		http.get(_url, {agent: keepAliveAgent}, function(res){  //
			if (res.statusCode != 200){
				console.log('Error while AVG broadcast tx (http:' + res.statusCode + ': ' + res.statusMessage + ')');
			}
			
			//console.log( res );
			
			//console.log(`STATUS: ${res.statusCode}`);
			//console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
			
		}).on('error', (e) => {
		  console.error(`Http save Got error: ${e.message}`);
		});
		
		return true;
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
		console.log('Please, destroy ALL older data, call <node app.js cleandb>');
		
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
		//console.log('Call: CheckTx');   
		//console.debug( request );  

		//return { code: 1 };
		  
		// let tx = request.tx;
		// let number = tx.readUInt32BE(0)
		// if (number !== state.count) {
		//   return { code: 1, log: 'tx does not match count' }
		// }
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
		
		//async save latest data 
		if (appState.dataStore.length > 0){
			var data = appState.dataStore[0];
			
			//console.log('\n\n');
			//console.log( data );
			//console.log( ' data.blockHeight == appState.blockHeight ); 
			//console.log('\n\n');
			
			if (data && data.blockHeight == appState.blockHeight){
				indexProtocol.saveResultAsTx('avg', JSON.stringify(data));
			}
		}
		  
		return { code: 0 };
	},
  
  endBlock: function(request){
	//let req = request.toString(
	//console.log('Fuck');
	//	console.debug( request );    
	//console.log('ass');
	
	let hx = parseInt( request.height.toString() );
	
	//console.debug( request ); 
	
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
		
		let hash = crypto.createHash('sha256');
		let jsonAppState = JSON.stringify( appState ); //stringify( appState );
		
			hash.update( jsonAppState, 'utf8' );
		let appHashHex = hash.digest('hex');
		
		appState.appHash = appHashHex; 
		
		//let gzip = zlib.createGzip({level: 6});
		
		/** gzip version
		//Sync store 
		fs.writeFileSync( stateFilePath,
			zlib.gzipSync(Buffer.from(jsonAppState, 'utf8'), {level: 6}), {encoding: 'binary', flag: 'w'});
		**/
		const diff = process.hrtime(time);	
		const time2 = process.hrtime();
		
		//test fs.writeFileSync( stateFilePath, jsonAppState, {encoding: 'utf8', flag: 'w'});
				
		const diff2 = process.hrtime(time2);
		
		console.log('New appState hash: ' + appHashHex + ', appState save OK to disc (calc: '+prettyHrtime(diff)+', save: '+prettyHrtime(diff2)+', block: '+ prettyHrtime(endBlockTs)+')');
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

//=== Debug
setInterval(function(){
	/*
	console.log('\n');
	
	console.dir( appState , {depth:4, colors: true });
	
	console.log('\n');
	*/
	
}, 60000);
//===

//initial subscribe to events
indexProtocol.eventsSubscribe();

console.log('ABCI Server starting...');

server.listen(26658, function(){
	
	

/***	
	//read sync from disc
	if (fs.existsSync( stateFilePath ) === true){
		console.log('State file exists.');
		
		let data = fs.readFileSync(stateFilePath, {encoding:'utf8'});
		
		//console.log( data );
		
		if (!data){
			console.log('Error while reading state file. Please, delete and restart process');
			process.exit(1);
		}

		try {
			
			let hash = crypto.createHash('sha256');
				hash.update( data, 'utf8' );
			let appHashHex = hash.digest('hex');
			
				appState = JSON.parse( data );
				appState.appHash = appHashHex;
			
			
		}catch(e){
			console.log('Error while parse JSON from readed state file. Please, delete and restart process');
			console.debug( e );
			
			process.exit(1);
		}
		
	}
	else {
		console.log('State file NOT exists! May be first run? ');
		console.log('All App state restore from chain (maybe loang time!)');
	}
*/	
	

/**	
	console.log('ABCI Server started OK');	
	
	if (startTendermintNode != false){	
	
		console.log('Tendermint node (full-node, not a Validator) starting...');
		// tendermintLogDebug
		tendermint = spawn('/opt/tendermint/tendermint', ['node', '--home=/opt/tendermint']); // , "--log_level='*:debug'"
			
		tendermint.stdout.on('data', (data) => {
		  console.log('TC:' + data);
		});

		tendermint.on('close', (code) => {
		  console.log('tCore: child process exited with code: ' + code);
		  console.log('');
			  
		  process.exit(1);
		});	
	
	}
	else
		console.log('Running in ABCI-only mode\n');
**/
});