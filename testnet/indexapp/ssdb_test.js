let net				= require('net');

console.log('SSDB test');

const SSDBObj			= require('nodessdb');


var ssdb = SSDBObj.connect({host:'127.0.0.1', port:8888}, function(err, _ssdb){
	console.log('Connected!');
});



 console.dir( ssdb );

  //ssdb.info('', function(err, val){ console.dir([err,val]); });


  ssdb.hset('test', 'k1', 'val', function(e){ console.log( e ); });
  ssdb.hset('test', 'k2', 'val22', function(e){ console.log( e ); });
  
  //ssdb.hexists('test', 'k2', function(e, val){ console.log( val ); });
  //ssdb.hexists('test', 'k9999', function(e, val){ console.log( val ); });
  
  //ssdb.hincr('test2', 'v1', function(e, val){ console.log( val ); });
  
  
  //ssdb.hkeys('test', '', '', function(e, val){ console.log( val ); });
  
  //ssdb.hrscan('test', '', '', function(e, val){ console.log( val ); });
   
   ssdb.multi_hset('test', {'k3' : new Date().getTime(), 'knn' : 'vvvvv'}, function(e){ console.log(e);});
   
   
   
   ssdb.multi_hdel('test', ['k1', 'k2'], function(e){ console.log( e ); });
  
   ssdb.hgetall('test', function(e, v){ console.log( e ); console.dir( v ); });
  

  
   
  /**
  ssdb.hsize('test', function(e, v){ console.log( e ); console.dir( v ); });
  
  var z = ssdb.hgetall('test', function(e, v){ console.log( e ); console.dir( v ); });
  
  ssdb.hclear('test', function(e){ console.log( e ); });
  
  ssdb.hsize('test', function(e, v){ console.log( e ); console.log( v ); });
  **/
  
/**
  get: [Function],
  set: [Function],
  setx: [Function],
  ttl: [Function],
  del: [Function],
  scan: [Function],
  keys: [Function],
  zget: [Function],
  zsize: [Function],
  zset: [Function],
  zdel: [Function],
  zscan: [Function],
  zlist: [Function],
  zsum: [Function],
  
  hget: [Function],
  hset: [Function],
  hdel: [Function],
  hscan: [Function],
  hlist: [Function],
  hsize: [Function] 
  
  
  auth password Authenticate the connection.
dbsize Return the approximate size of the database.
flushdb [type] Delete all data in ssdb server.
info [opt] Return the information of server.
slaveof id host port [auth last_seq last_key] Start a replication slave.

**/




setInterval(function(){
	//fff
	console.log('.');
}, 5000);

