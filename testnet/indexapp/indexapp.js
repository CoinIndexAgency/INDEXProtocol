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
const zlib 			= require('zlib');


const storeLatestBlocks = 900; //how many blocks decoded and stored
const storeAvgQuotes = 1 * 3600;
const fixedExponent = 1000000000;
const saveAvgStatePeriod = 1; //how blocke before save to disk state

//APP state
let appState = {
	'version'		: 'testnet-1',
	'appVersion'	: 1,	
	'appHash'		: '', 	//current AppHash (sha-256)
	'blockHeight'	: 0,	//current height

	'blockStore' : [],  //decoded transactions from latest N block
	
	'dataStore'	: []	//filled by transactions	
};

let saveStateCounter = 0;

let queueToChainStore = []; //local queue to store aggregated quote

let stateFilePath = './indexapp.state.db';

let currentBlockStore = []; //current unconfirmed block tx

let tendermint 		= null; //Tendermint core process

//test version of lib
let indexProtocol = {
	getDefaultState: function(){
		return {
			'version'		: 'testnet-1',
			'appVersion'	: 1,	
			'appHash'		: '', 	//current AppHash (sha-256)
			'previousAppHash' : '',
			'blockHeight'	: 0,	//current height
			
			'blockStore' 	: [],  //decoded transactions from latest N block
			
			'dataStore'		: []	//filled by transactions	
		};
	},
	
	clearState: function(){
		if (fs.existsSync( stateFilePath ) === true){		
			fs.unlinkSync(stateFilePath);		
		}
	},
	
	eventsSubscribe: function(){
		events.on('blockCommit', indexProtocol.blockCommitHandler);
	},
	
	
	
	//some handlers
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
				exchangesIncluded: []
			};
			
			let txHashes = []; //hashes of all tx 
			let calcAvgHash = ''; //sha256 of quote
			
			var _tx = [];
			var _avg = [];
			
			_.each(appState.blockStore, function(v){
				if (v.tx.length > 1){
					_tx = _tx.concat( v.tx );
					
					_avg.push( v.avgQuote );
				}
			});
			
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
			
			if (appState.dataStore.length == storeAvgQuotes){
				var tmp = appState.dataStore.pop();
				delete tmp;
			}
			
			//todo: store full history to disk db
			
			appState.dataStore.unshift( calcAvg );
						
			//console.debug( calcAvg );
		}
	}
	
}

let beginBlockTs = 0; // process.hrtime();
let endBlockTs = 0;

let server = createServer({
	
	//Global initialize network
	//Called once upon genesis
	initChain: function(request){
		console.log('Call: InitChain');
		console.debug( request );
		
		if (fs.existsSync( stateFilePath ) === true){		
			console.log('Old state file exists. Try to delet it');
			
			indexProtocol.clearState();
		}
		
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
		lastBlockHeight: appState.blockHeight,  
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
	//return { code: 1 };

    let tx = request.tx.toString('utf8'); //'base64'); //Buffer 
	let z  = tx.split(':'); //format: CODE:<base64 transaction body>
	
	if (!tx) return { code: 1, log: 'Wront tx type' };
	if (!z || z.length != 2) return { code: 1, log: 'Wront tx type' }; 	 
	
	let txType = z[0].toUpperCase();
	
	//console.debug( txType );
	//console.debug( z );
	
	switch ( txType ){
		
		case 'CET': {
			let x = Buffer.from( z[1], 'base64').toString('utf8');
			
//			console.log('CET: Cryptocurrency Exchange Trades :: ' + x);
			
			x = JSON.parse( x );
			
			if (x){			
				if (x.price < 0)
					return { code: 1, log: 'CET: Price can not be lover then 0' };
				
				if (x.amount <= 0)
					return { code: 1, log: 'CET: Amount can not be 0 or less' };
				
				if (x.total <= 0)
					return { code: 1, log: 'CET: Total can not be 0 or less' };
				
				if (!x.id || x.id == null || x.id == '')
					return { code: 1, log: 'CET: ID can not be empty' };
				
				delete x._hash;
				
				//all passed OK
				currentBlockStore.push( x );
			}
		}
		
		default: {
			return { code: 1, log: 'Unknown tx type' };
		}
    }
	
    //let number = tx.readUInt32BE(0)
    //if (number !== state.count) {
    //  return { code: 1, log: 'tx does not match count' }
    //}

    // update state
   // state.count += 1

    return { code: 0, log: 'tx succeeded' }
  },
  
  beginBlock: function(request) {
		
	//console.log('Call: BeginBlock. Height: ' + request.header.height);  
	
	//initial current block store
	currentBlockStore = [];
	
	beginBlockTs = process.hrtime();
	  
    return { code: 0 }
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
		
		fs.writeFileSync( stateFilePath, jsonAppState, {encoding: 'binary', flag: 'w'});
				
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
	return { code: 0, data: Buffer.from(appState.appHash, 'hex'),  log: 'Commit succeeded' }
  } 

});

//=== Debug
setInterval(function(){
	
	console.log('\n');
	
	console.dir( appState , {depth:4, colors: true });
	
	console.log('\n');
	
	
}, 30000);
//===


console.log('ABCI Server starting...');

server.listen(26658, function(){
	console.log('Reading latest app state from disk snapshot (file: ./indexapp.state.db)');
	
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
	
	//initial subscribe to events
	indexProtocol.eventsSubscribe();
		
	console.log('ABCI Server started OK');
	
	console.log('Tendermint node (full-node, not a Validator) starting...');
	
	tendermint = spawn('/opt/tendermint/tendermint', ['node', '--home=/opt/tendermint']);
		
	tendermint.stdout.on('data', (data) => {
	  console.log('TC:' + data);
	});

	tendermint.on('close', (code) => {
	  console.log('tCore: child process exited with code: ' + code);
		  
	  process.exit(1);
	});	
});