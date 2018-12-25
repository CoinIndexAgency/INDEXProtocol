//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('abci');
const crypto 		= require('crypto');
const v8 			= require('v8');
const { spawn } 	= require('child_process');
let _				= require('underscore');
let stringify 		= require('fast-json-stable-stringify');
let redis 			= require('redis');
var deasync 		= require('deasync');
var emitter			= require('events');
const events = new emitter();


//debug   
// opt/tendermint/redix -storage /opt/tendermint/data/redix -workers 2 -verbose 

var APP_VERION = 'testnet-1';
var VERION = '0.0.1';

//Global state of APP
var STATE 	= {};
var STATEHash = '';//hash of the app states

//All transactions, decoded and grouped by block, 0 - latest (current)
var TX		= [];
var TXHash  = ''; //hash of the transactions state
//var TXHashCache = []; //cache last trx hashes

var BlockTx = []; //current block tx
var Height 	= 0;

//Global APP state hash (Merkle root of state) returns at Commit call. SHA-256 or 512
var AppHash = ''; 

var lastSaveState = {
		'appHash' 		: '',
		'blockHeight' 	: 0, 
		'version'		: VERION, 
		'appVersion' 	: APP_VERION
	};

var tendermint 	= null; //Tendermint core process
var redix 		= redis.createClient({host:'localhost', port: 6380});
	
	redix.on('error', function (err){
		console.log('Redix error!');
		console.debug(err);
		
		process.exit(1);
	});
	
let server = createServer({
	
	//Global initialize network
	//Called once upon genesis
	initChain: function(request){
		console.log('Call: InitChain');
		
		let chainId = request.chainId;
		
		console.log('Staring new chain with ID: ' + chainId);
		console.log('Try to initialize clear evn for contracts and registry');
		
		TX = [];
		TXHash = '';
		
		STATE = {};
		STATEHash = '';
		
		//clear Redix store 
		redix.hdel('TX');
		redix.hdel('appState');		
		
		let hash = crypto.createHash('sha256');
		
		//calc initial App state 
		AppHash = hash.update( TXHash, 'utf8' ).update( STATEHash, 'utf8' ); //.digest('hex');
		
		console.log('App hash: ' + AppHash.digest('hex'));
		console.log('Network and Application ready to Go!');
		console.log('\n\n');
		
		return {
			code: 0,
			validators: [] //use validators list, defined by genesis.json
		};		
	},	
	
  
  info: function(request) {
    console.log('got info request', request);
    
	//todo: store and restore state if need
	contracts.init(); 
	
	
	//redix.hgetall('appState', function(err, data){}); 
	//console.debug( lastSaveState );
	
	return {
		data: 'Node.js INDEX Protocol app',
		lastBlockHeight: lastSaveState.blockHeight,    //870
		//lastBlockAppHash: lastSaveState.appHash  //now disable for debug
	}; 
	
	/*,
      version: '0.0.1',
	  appVersion: 'testnet-1',
	  lastBlockHeight: 0,
     // lastBlockAppHash: Buffer.alloc(0)
    }; */
  }, 
  
  checkTx: function(request) {
	
	//console.log('Call: CheckTx');   
	//console.debug( request );  
	  
	  
   // let tx = request.tx;
   // let number = tx.readUInt32BE(0)
   // if (number !== state.count) {
   //   return { code: 1, log: 'tx does not match count' }
   // }
    return { code: 0, log: 'tx succeeded' }
  },

  deliverTx: function(request) {
	console.log('Call: DeliverTx');    
	//console.debug( request );  
	  
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
			
			BlockTx.push( x );
			
			//TXHashCache.push( x._hash );
			
			//console.debug( x );
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
	//
	  
    return { code: 0, log: 'beginBlock succeeded' }
  },
  
  endBlock: function(request){
	//let req = request.toString(
	//console.log('Fuck');
	//	console.debug( request ); 
	//console.log('ass');
	
	let hx = request.height;
	console.log('Call: EndBlock. Height: ' + hx); 
	//console.debug( request ); 
	
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
  },
  
  //Commit msg for each block.
  commit: function(){
	//console.log('Call: Commit block'); 
	
	let hash = crypto.createHash('sha256');
	let appHashHex = '';
	
	if (AppHash == false){ //changed by this block
	
		//calc App state 
		AppHash = hash.update( TXHash, 'utf8' ).update( STATEHash, 'utf8' );
		
		appHashHex = AppHash.digest('hex');

		console.log('New app hash: ' + appHashHex);
	}
	
	//фиксируем хеш и номер блока
	redix.hmset(['appState', 'appHash', appHashHex, 'blockHeight', Height.toString(), 'version', VERION, 'appVersion', APP_VERION]);
	
	return { code: 0, data: AppHash, log: 'Commit succeeded' }
  } 

});

console.log('ABCI Server starting...');

setInterval(function(){
	let z = v8.getHeapStatistics();
	
	console.log('\n');
	console.log('TX length: ' + TX.length);
	console.debug( z );
	console.log('\n');
	console.debug(TX);
	console.log('\n');
	
	
}, 3*60000);

//=================================================================
let contracts = {
	_store: {
		'9db7eb6d85d0e5d9baa94ea861a92e5c': {
			'id'	: '9db7eb6d85d0e5d9baa94ea861a92e5c',
			'name'  : 'test-contract-z',
			'enabled'	: true, //false for disable
			'precheck': function(height, name, _this){
				return true; //return True to run contract of false if no
			},
			'contract' : function(height, name){
				//contract code her
				console.log('Contract [' + name + '] at block ' + height);
				
				return true;
			}
		},
		'1db7eb': {
			'id'	: '1db7eb',
			'name'  : '5minBTCUSDBenchmarkPrice',
			'enabled'	: true, //false for disable
			'precheck': function(height, name, _this){
				
				console.log('Counter: ' + _this._counter[ name ]);
				
				if (_this._counter[ name ] != 300){
					_this._counter[ name ]++;
					return false;
				}
				
				_this._counter[ name ] = 0;
				
				return true;
			},
			'contract' : function(height, name){
				//contract code her
				console.log('Call contract fn!');
			}
		}		
	},
	
	//counter for contracts runner
	_counter: {
		'5minBTCUSDBenchmarkPrice': 0
	},
	
	//initialize states and counters
	init: function(){
		_.each(this._store, function(v){
			
			console.log( v.name );
		
			this._counter[ v.name ] = 0;
		}, contracts);
	},
	
	// start scheduller of contracts by rule
	run: function( height ){
		
		//console.log( height );
		//console.log( this._counter );
		
		_.each(this._store, function(v){
			
			//console.debug( v );
			
			if (v.enabled === true && (_.isFunction( v.precheck )) && (_.isFunction( v.contract ))){
				if ( v.precheck(height, v.name, this) === true ){
					
					let res = v.contract( height, v.name  );
						
					if (res === true){
						this._counter[ v.name ] = 0;
					}
				}
			}
		}, contracts);			
	}
};


//=================================================================



redix.on('ready', function (err){
	console.log('Redix connected OK!');
	
	//lastSaveState
	redix.hgetall('appState', function(err, data){
		if (!err && data){
			
			lastSaveState = data;
			lastSaveState.appHash = Buffer.from(lastSaveState.appHash, 'hex');
			
			console.log('Restored last save state....');
			console.debug( lastSaveState );

			//all passed ok
			events.emit('startABCIServerApp');			
		}
		else
		{
			console.log('ERROR while starting node');
			process.exit(1);
		}			
	});	
});



events.on('startTendermintNode', function(){
	//@todo: add starting Redix server node too
	console.log('Tendermint core starting...');
		
	tendermint = spawn('/opt/tendermint/tendermint', ['node', '--home=/opt/tendermint']);
		
	tendermint.stdout.on('data', (data) => {
	  console.log('TC:' + data);
	});

	tendermint.on('close', (code) => {
	  console.log('tCore: child process exited with code: ' + code);
		  
	  process.exit(1);
	});	
});


events.on('startABCIServerApp', function(){
	server.listen(26658, function(){
		console.log('Server started OK');
		
		events.emit('startTendermintNode');
	});
});
