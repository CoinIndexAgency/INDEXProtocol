/** Simple script for aggregators data **/

const crypto 		= require('crypto');
const _				= require('underscore');
const prettyHrtime 	= require('pretty-hrtime');
const async 		= require('async');
const secp256k1		= require('secp256k1');
const fs 			= require('fs');
const EventEmitter 	= require('events');
const moment 		= require('moment');
global.fetch 		= require('node-fetch');



const dataConn = {
	coinMarketCap 	: require('coinmarketcap-api'),
	cryptoCompare 	: require('cryptocompare'),
	coinGecko		: require('coingecko-api'),
	bitcoinAverage 	: require('bitcoinaverage'),
	coinDesc		: require('node-coindesk-api')
}



/*
const worldCoinIndex 	= require('worldcoinindex-api');
const coinLib			= require('coinlib-api');
const coinRanking 		= require('coinranking-api');
const cryptonator		= require('cryptonator');
const coinPaprika 		= require('coinpaprika-js');
const coinBasePro   	= require('coinbase-pro-feed'); //WS realtime module
const bitcoinCharts 	= require('bitcoincharts-promise');
*/

//add Nomics
//add Brave New coin spot and liqudity index
//add zloadr
//add nexchange
//add messari if available(https://messari.io/api/docs)
//add CME & cryptofacilities
//add localbitcoins if possible

//Open datasource keys 
const sourceKeys	= JSON.parse( fs.readFileSync('./datasource.keys.json', {encoding:'utf8') );

const dataFeed	= {
	coinMarketCap	: {
		"email"		:	"indexprotocol@coinindex.agency",
		"apikey"	:	"ef188838-e4dd-4e47-8fb0-113c80bbbbe6",
		"interval"	:	5 * 60 * 1000 //5 min
	},
	
	cryptoCompare	: {
		"email"		:	"indexprotocol@coinindex.agency",
		"apikey"	:	"d333f8c2fd912718229a9b6c52a8d5ab60b76917167f186ba4777e8927756c5f",
		"interval"	:	1 * 60 * 1000 //1 min	
	},
	
	coinGecko		: {
		"interval"	:	3 * 1000 //3 sec	
	},
	
	bitcoinAverage	: {
		"apikey"		:	"NDA5M2M5M2U2NTBjNGVlMWE1YjE0MmRlYzg1NmJhM2M",  //pubKey	
		"secret"		:	"ZTMwYzNiZWVhNzU4NGI0Y2JiYTRlODkzZmE3YTExZjZkMzZhYWFjMGU0Mzk0YTYxOTk1OTdmNWVlZjg3NjM0OA",
		
		"interval"	:	10 * 60 * 1000	//10 min
	},
	
	coinDesc		: {
		"interval"	:	3 * 1000 //3 sec	
	}
};

//==========
EventEmitter.on('fetchData:coinMarketCap', function(src){
	console.log(new Date().'fetchData: ' + src);
});

//===========



console.log('Starting feed...');

_.each(dataFeed, function(v, source){
	//create timer for each 
	dataFeed[ source ]._timer = setInterval(function(src){
		EventEmitter.emit('fetchData:' + src, src);
	}, v.interval, source);
});






console.log('');