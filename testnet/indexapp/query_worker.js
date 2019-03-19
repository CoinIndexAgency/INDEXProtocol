/** Processor for abci-query **/
/*
const crypto 		= require('crypto');
const fs			= require('fs');
const _				= require('underscore');
const emitter		= require('events');
const events 		= new emitter();
const prettyHrtime 	= require('pretty-hrtime');
const rocksdown 	= require('rocksdb');
const async 		= require('async');
const secp256k1		= require('secp256k1');
const bs58			= require('bs58');
const stringify 	= require('fast-json-stable-stringify');
const moment		= require('moment');
const fetch			= require('node-fetch');
const http			= require('http');
const https			= require('https');
*/


exports.queryHandlers = {
	doQuery: function(path, data, appState, stateDb){
		
		path = path.toLowerCase();
		
		console.log('Module queryHandlers, call path: ' + path);
		
		switch( path ) {
			case 'tbl.accounts.all' : {
				return this.tblAccountsAll(path, data, appState, stateDb);
				break;
			}
			default: {
				return {code: 1};
			}
		}
	},
	
	/******************************************************************************/
	
	tblAccountsAll: function(path, data, appState, stateDb){
		let maxCountAddr = 1000; //maximum of addresses
		let _res = [];
				
		_.each(indexProtocol.accountsStore, function(v, addr){
			if (_res.length > maxCountAddr) return;
					
			let _amount = 0;
					
			//find balance at IDX
			if (v.data.assets[ appState.options.nativeSymbol ]){
				_amount = parseInt( v.data.assets[ appState.options.nativeSymbol ].amount );
				
				let dvd = appState.assetStore[ appState.options.nativeSymbol ].divider;
					
				if (dvd > 1){
					_amount = Number(_amount / dvd).toFixed(2);
				}
			}
					
			_res.push({
				address	:	v.address,
				name	:	v.name,
				height	:	v.createdBlockHeight,
				type	:	v.type,
				nonce	: 	v.nonce,
				balance :	_amount, //balance of native coin
				pubKey	: 	v.pubKey,
				
				_ts		: new Date().getTime()
			});
			
		});
	
		return {code: 0, value: Buffer.from(JSON.stringify( _res ), 'utf8').toString('base64')};
	}
};