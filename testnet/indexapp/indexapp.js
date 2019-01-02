//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('abci');
const crypto 		= require('crypto');
const { spawn } 	= require('child_process');
const fs			= require('fs');
let _				= require('underscore');
let stringify 		= require('fast-json-stable-stringify');
var emitter			= require('events');
const events 		= new emitter();
var prettyHrtime 	= require('pretty-hrtime');
const zlib 			= require('zlib');

const storeLatestBlocks = 900; //how many blocks decoded and stored


//APP state
let appState = {
	'version'		: 'testnet-1',
	'appVersion'	: 1,	
	'appHash'		: '', 	//current AppHash (sha-256)
	'blockHeight'	: 0,	//current height

	'blockStore' : [],  //decoded transactions from latest N block
	
	'dataStore'	: []	//filled by transactions	
};

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
				
				twapPrice: 0,
				vwapPrice: 0,
				
				timeFrom: 0,
				timeTo: 0,
				
				trxIncluded: 0,
				exchangesIncluded: []
			};
			
			let txHashes = []; //hashes of all tx 
			let calcAvgHash = ''; //sha256 of quote
			
			var _tx = [];
			
			_.each(appState.blockStore, function(v){
				if (v.tx.length > 1){
					_tx = _tx.concat( v.tx );
				}
			});
			
			//openPrice - avg from open block 
			var tmp = _.last( appState.blockStore, 1);
				tmp = tmp.tx;
				
			var x = 0, y = 0, z = 0;
				
				_.each(tmp, function(v){
					x = x + v.price;
					y = y + v.amount;
					z = z + v.total;					
				});
				
			if (x > 0) calcAvg.openPrice = parseFloat( x / tmp.length );
			if (y > 0) calcAvg.openAmount = parseFloat( y );
			if (z > 0) calcAvg.openVolume = parseFloat( z );
			
			//closePrice - avg from head of store 
			var tmp = _.first( appState.blockStore, 1);
			
			var x = 0, y = 0, z = 0;
				
				_.each(tmp, function(v){
					x = x + v.price;
					y = y + v.amount;
					z = z + v.total;					
				});
				
			if (x > 0) calcAvg.closePrice = parseFloat( x / tmp.length );
			if (y > 0) calcAvg.closeAmount = parseFloat( y );
			if (z > 0) calcAvg.closeVolume = parseFloat( z );
			
			
			//avgPrice 
			var x = 0, y = 0, z = 0;
			
			_.each(_tx, function(v){
				x = x + v.price;
				y = y + v.amount;
				z = z + v.total;

				txHashes.push( v._hash );				
			});
			
			if (x > 0) calcAvg.avgPrice = parseFloat( x / _tx.length );
			if (y > 0) calcAvg.totalAmount = parseFloat( y );
			if (z > 0) calcAvg.totalVolume = parseFloat( z );
			
			
			
			
			
			
			console.debug( calcAvg );
		}
	}
	
}


let server = createServer({
	
	//Global initialize network
	//Called once upon genesis
	initChain: function(request){
		console.log('Call: InitChain');
		
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
    console.log('INFO request called', request);
	
	return {
		data: 'Node.js INDEX Protocol app',
		lastBlockHeight: appState.blockHeight,  
		//lastBlockAppHash: appState.appHash  //now disable for debug
	}; 
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
	let txType = z[0].toUpperCase();
	
	//console.log( tx );
	//console.debug( z );
	
	switch ( txType ){
		
		case 'CET': {
			let x = Buffer.from( z[1], 'base64').toString('utf8');
			
			console.log('CET: Cryptocurrency Exchange Trades :: ' + x);
			
			x = JSON.parse( x );
			
			if (x)			
				currentBlockStore.push( x );
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
		
	console.log('Call: BeginBlock. Height: ' + request.header.height);  
	
	//initial current block store
	currentBlockStore = [];
	  
    return { code: 0, log: 'beginBlock succeeded' }
  },
  
  endBlock: function(request){
	//let req = request.toString(
	//console.log('Fuck');
	//	console.debug( request );    
	//console.log('ass');
	
	let hx = parseInt( request.height.toString() );
	console.log('Call: EndBlock. Height: ' + hx + ', tx count: ' + currentBlockStore.length); 
	//console.debug( request ); 
	
	if (appState.blockStore.length == storeLatestBlocks){
		var tmp = appState.blockStore.pop();
	}
	
	//update only non-empty block
	if (currentBlockStore.length > 0)
		appState.blockStore.unshift( { Height: hx, tx: currentBlockStore } );
	
	appState.blockHeight = hx;
	
	appState.previousAppHash = appState.appHash;
	appState.appHash = '';
	
	return { code: 0, log: 'endBlock succeeded' };
	
	/**
	if (BlockTx.length > 0){
		console.log('At block commited: ' + BlockTx.length + ' tx.');
		
		//BlockTx.unshift({Height: hx});
		if (TX.length >= 3 * 3600)	//save to memory only last 3h blocks
			TX.pop();
		
		TX.unshift( { Height: hx.toString(), tx: BlockTx } );

		//save state 
		redix.hset('TX', hx.toString(), stringify( BlockTx ));
		
		TXHash = '';
		BlockTx = []; //clearing new buffer		
	}	

	Height = hx;
	
	//Run contracts here!
	contracts.run( parseInt( hx.toString() ) );
	
		
	return { code: 0, log: 'endBlock succeeded' }
	**/
  },
  
  //Commit msg for each block.
  commit: function(){
	//console.log('Call: Commit block'); 
	
	events.emit('blockCommit', appState.blockHeight);
	
	if (appState.appHash == ''){
		const time = process.hrtime();
		
		let hash = crypto.createHash('sha256');
		let jsonAppState = stringify( appState );
		
			hash.update( jsonAppState, 'utf8' );
		let appHashHex = hash.digest('hex');
		
		appState.appHash = appHashHex; 
		
		//let gzip = zlib.createGzip({level: 6});
		
		/** gzip version
		//Sync store 
		fs.writeFileSync( stateFilePath,
			zlib.gzipSync(Buffer.from(jsonAppState, 'utf8'), {level: 6}), {encoding: 'binary', flag: 'w'});
		**/
		
		fs.writeFileSync( stateFilePath, jsonAppState, {encoding: 'utf8', flag: 'w'});
				
		const diff = process.hrtime(time);		
		
		console.log('New appState hash: ' + appHashHex + ', appState save OK to disc ('+prettyHrtime(diff)+')');
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
		
		console.log( data );
		
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