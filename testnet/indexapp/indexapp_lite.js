//Simple test ABCI server for INDEX Protocol Testnet

let createServer 	= require('js-abci');
const { spawn } 	= require('child_process');

let server = createServer({
  
	initChain: function(request){
		console.log('Call: InitChain');

		return { code: 0, validators: [] };
	},

	info: function(request) {
		console.log('got info request', request);
		
		return {	data: 'Node.js INDEX Protocol app', version: 'indx-testnet-01', appVersion: '1' }; 
			//lastBlockHeight: 0,
			// lastBlockAppHash: Buffer.alloc(0)
	}, 
  
	checkTx: function(request) {
		return { code: 0, log: 'tx succeeded' }
	},

	deliverTx: function(request) {
		return { code: 0, log: 'tx succeeded' }
	},

	beginBlock: function(request) {
		return { code: 0, log: 'beginBlock succeeded' }
	},

	endBlock: function(request){
		return { code: 0, log: 'endBlock succeeded' }
	},

	commit: function(request){
		return { code: 0, log: 'commit succeeded' }
	},
  
	setOption: function(request){
		return { code: 0 };	
	},

	query: function(request){
		return { code: 0 };
	}
});

console.log('ABCI Server starting...');

//Connect to localhost
server.listen(26658, function(){
	console.log('ABCI Server started OK');
	/**
	console.log('Tendermint node (full-node, not a Validator) starting...');
	
	var moniker = process.argv[2];
	
	if (!moniker)	moniker = 'unk-testnet';
		
	// tendermintLogDebug
	tendermint = spawn('/opt/tendermint/tendermint', ['node', '--home=/opt/tendermint', '--moniker=' + moniker]);
		
	tendermint.stdout.on('data', (data) => {
	  console.log('TC:' + data);
	});

	tendermint.on('close', (code) => {
	  console.log('TC: child process exited with code: ' + code);
	  console.log('');
		  
	  process.exit(1);
	});	
	**/
	// Here we send the ready signal to PM2
	if (process.send)
		process.send('ready');
});