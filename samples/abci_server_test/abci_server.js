//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('abci');
const crypto 		= require('crypto');


//Global state of APP
var STATE 	= {};
var STATEHash = '';//hash of the app states

//All transactions, decoded and grouped by block, 0 - latest (current)
var TX		= [];
var TXHash  = ''; //hash of the transactions state

//Global APP state hash (Merkle root of state) returns at Commit call. SHA-256 or 512
var AppHash = ''; 

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
		AppHash = hash.update( TXHash, 'utf8' ).update( STATEHash, 'utf8' ).digest('hex');
		
		console.log('App hash: ' + AppHash);
		console.log('Network and Application ready to Go!');
		console.log('\n\n');
		
		return {
			code: 0,
			validators: [] //use validators list, defined by genesis.json
		};		
	},	
	
  
  info: function(request) {
    console.log('got info request', request);
    
	
	return {
	data: 'Node.js INDEX Protocol app' }; 
	
	/*,
      version: '0.0.1',
	  appVersion: 'testnet-1',
	  lastBlockHeight: 0,
     // lastBlockAppHash: Buffer.alloc(0)
    }; */
  }, 
  
  checkTx: function(request) {
	console.log('Call: CheckTx');   
	console.debug( request );  
	  
	  
    let tx = request.tx;
   // let number = tx.readUInt32BE(0)
   // if (number !== state.count) {
   //   return { code: 1, log: 'tx does not match count' }
   // }
    return { code: 0, log: 'tx succeeded' }
  },

  deliverTx: function(request) {
	console.log('Call: DeliverTx');    
	console.debug( request );  
	  
    let tx = request.tx
    //let number = tx.readUInt32BE(0)
    //if (number !== state.count) {
    //  return { code: 1, log: 'tx does not match count' }
    //}

    // update state
   // state.count += 1

    return { code: 0, log: 'tx succeeded' }
  },
  
  beginBlock: function(request) {
	console.log('Call: BeginBlock');  
	console.debug( request );  
	  
    return { code: 0, log: 'beginBlock succeeded' }
  },
  
  endBlock: function(request){
	console.log('Call: EndBlock'); 
	console.debug( request );  
	
	return { code: 0, log: 'endBlock succeeded' }
  },
  
  commit: function(request){
	console.log('Call: Commit'); 
	console.debug( request );  
	
	return { code: 0, log: 'commit succeeded' }
  } 

});

console.log('ABCI Server starting...');

//Connect to localhost
server.listen(26658, function(){
	console.log('Server started OK');
});