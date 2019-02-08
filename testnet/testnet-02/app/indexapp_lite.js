//Simple test ABCI server for INDEX Protocol Testnet
let createServer 	= require('js-abci');
const fs			= require('fs');
var rocksdown 		= require('rocksdb');
var emitter			= require('events');
const events 		= new emitter();
let stringify 		= require('fast-json-stable-stringify');




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

const stateDb 	= rocksdown( stateDbPath );

//options for RocksDB
const rocksOpt = {
	createIfMissing: true,
	errorIfExists: false,
	compression: true,
	
	target_file_size_base: 4 * 1024 * 1024
};

//Default app state
var appState = {
	data: 'Node.js INDEX Protocol app', 
	version: 'indx-testnet-01', 
	appVersion: '1',
	lastBlockHeight: 0
};

stateDb.open(rocksOpt, function(err){
	if (!err){
		//waiting for status
		var t = setInterval(function() {
			if (stateDb.status != 'open') return;
			
			console.log('stateDb opened and ready');
			clearInterval( t );	
			
			//OK, all DB ready to work
			
			stateDb.get('appState', function(err, val){
				if (!err && val){
					console.log('Recover appState from disk... OK');
					
					if (Buffer.isBuffer(val)){
						val = val.toString('utf8');								
					}
					
					val = JSON.parse( val );
					
					if (val && val.appVersion){
						appState = val;
					
						console.log( val );
						console.log( '\n' );
					}
				}
				
				events.emit('dbReady');
				//else
				//	process.exit(1);
			});
		
		}, 100);
	}
	else {
		console.log('stateDb opening error: ' + err);
		process.exit(0);
	}
});




let server = createServer({
  
	initChain: function(request){
		console.log('Call: InitChain');

		return { code: 0, validators: [] };
	},

	info: function(request) {
		console.log('got info request', request);
		
		return appState; //{	data: 'Node.js INDEX Protocol app', version: 'indx-testnet-01', appVersion: '1' }; 
			//lastBlockHeight: 0,
			// lastBlockAppHash: Buffer.alloc(0)
	}, 
  
	checkTx: function(request) {
		//console.log('got checkTx request');
		return { code: 0 }
	},

	deliverTx: function(request) {
		//console.log('got deliverTx request');
		return { code: 0 }
	},

	beginBlock: function(request) {
		console.log(request.header.height + ' :: got beginBlock request');
		return { code: 0 }
	},

	endBlock: function(request){
		//console.log('got endBlock request');
		appState.lastBlockHeight = parseInt( request.height.toString() );

		return { code: 0 }
	},

	commit: function(request){
		//console.log('got commit request');
		
		let ops = [ { type: 'put', key: 'appState', value: stringify( appState ) } ];
		
		return new Promise(function(resolve, reject){
			stateDb.batch(ops, function (err){
				if (!err){
					console.log( 'Commit block - OK');
					
					return resolve( {code: 0} );
				}
				else {
					console.log('ERROR while save state to DB');
					process.exit(1);						
				}
			});
		});
	},
  
	setOption: function(request){
		return { code: 0 };	
	},

	query: function(request){
		return { code: 0 };
	}
});


events.on('dbReady', function(){
	console.log('ABCI Server starting...');

	//Connect to localhost
	server.listen(26658, function(){
		console.log('ABCI Server started OK');

		// Here we send the ready signal to PM2
		if (process.send)
			process.send('ready');
	});
	
});

