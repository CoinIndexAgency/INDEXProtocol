//var level = require('level');
var leveldown 	= require('leveldown');
var v8 = require('v8');
const os = require('os');
var rocksdown 	= require('rocksdb');

//let stringify 		= require('fast-json-stable-stringify');

console.dir( rocksdown, {depth:4, colors: true });




//process.exit();

const db = rocksdown('/opt/tendermint/app/indexapp/db/app_state_rocksdb');

db.open({
	createIfMissing: true,
	errorIfExists: false,
	compression: true,
	
	target_file_size_base: 4 * 1024 * 1024
	
	/**
	cacheSize: 1 * 1024 * 1024,
	
	//writeBufferSize
	maxOpenFiles: 4096,
	
	paranoidChecks: true,
	
	maxFileSize: 4 * 1024 * 1024
	//blockRestartInterval**/
}, function(err){
	if (!err)
		console.log('DB opened OK');
});

console.dir( db, {depth:4, colors: true });


setInterval(function(){
	
	//console.log('DB status: ' + db.status);
	
	if (db.status == 'open')
		db.put('app-key-' + new Date().getTime(),  
				JSON.stringify({
					env						: process.env,
					HeapSpaceStatistics		: v8.getHeapSpaceStatistics(),
					HeapStatistics			: v8.getHeapStatistics(),
					net 					: os.networkInterfaces()
				}), {sync: true}, function(err){
					//console.log('.');
					process.stdout.write('.');
				});
	else
		console.log('DB status: ' + db.status);
		
	
}, 10);


setInterval(function(){
	//console.dir( db, {depth:4, colors: true });
	
	console.log('\n');
	console.debug( db.getProperty('rocksdb.stats') );
	console.log('\n\n');
	console.debug( db.getProperty('rocksdb.iostats') );
	//console.debug( db.getProperty('rocksdb.sstables') );
	console.log('\n');
	
}, 60000);