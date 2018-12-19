//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('abci');
const crypto 		= require('crypto');
const v8 			= require('v8');
const { spawn } 	= require('child_process');
let _				= require('./underscore-min.js');


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

var tendermint = null; //Tendermint core process

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
	
	return {
		data: 'Node.js INDEX Protocol app',
		lastBlockHeight: 870
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
		TX.unshift( { Height: hx.toString(), tx: BlockTx } );		
		
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
	
	if (AppHash == false){ //changed by this block
	
		//calc App state 
		AppHash = hash.update( TXHash, 'utf8' ).update( STATEHash, 'utf8' );
		//.digest('hex');
		console.log('New app hash: ' + AppHash.digest('hex'));
	}
	
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
var contracts = {
	_store: {
		{
			'id'	: '9db7eb6d85d0e5d9baa94ea861a92e5c',
			'name'  : 'test-contract-z',
			'enabled'	: true, //false for disable
			'precheck': function(height, name){
				return true; //return True to run contract of false if no
			},
			'contract' : function(height, name){
				//contract code her
				console.log('Contract: ' + name + ' at block ' + height);
				
				return true;
			}
		},
		{
			'id'	: '1db7eb',
			'name'  : '5minBTCUSDBenchmarkPrice',
			'enabled'	: true, //false for disable
			'precheck': function(height, name){
				
				if (this._counter[ name ] != 300){
					this._counter[ name ]++;
					return false;
				}
				
				this._counter[ name ] = 0;
				
				return true;
			},
			'contract' : function(height, name){
				//contract code her
				console.log('Call contract!');
			}
		}		
	},
	
	//counter for contracts runner
	_counter: {
		'5minBTCUSDBenchmarkPrice': 0
	},
	
	//initialize states and counters
	init: function(){
		_.each(_store, function(v){
			this._counter[ v.name ] = 0;
		}, contracts);
	},
	
	// start scheduller of contracts by rule
	run: function( height ){
		
		_.each(_store, function(v){
			
			if (v.enabled === true && (_.isFunction( v.precheck )) && (_.isFunction( v.contract ))){
				if ( v.precheck(height) === true ){
					
					let res = v.contract( height, v.name  );
						
					if (res === true){
						contracts._counter[ v.name ] = 0;
					}
				}
			}
		});			
	}
};


//=================================================================






//Connect to localhost
server.listen(26658, function(){
	console.log('Server started OK');
	
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