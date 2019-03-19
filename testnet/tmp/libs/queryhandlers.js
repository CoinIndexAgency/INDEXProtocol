/** Processor for abci-query **/

const _				= require('underscore');

/*
const crypto 		= require('crypto');
const fs			= require('fs');
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


exports.Handlers = {
	doQuery: function(path, data, appState, indexProtocol){
		
		path = path.toLowerCase();
		
		console.log('Fetch all account (path: ' + path );
		
		switch( path ) {
			case 'tbl.accounts.all' : {
				return this._tblAccountsAll(data, appState, indexProtocol);
				break;
			}
			case 'tbl.assets.all' : {
				return this._tblAssetsAll(data, appState, indexProtocol);
				break;
			}
			case 'tbl.assets.info' : {
				return this._tblAssetInfo(data, appState, indexProtocol);
				break;
			}
			default: {
				return {code: 1};
			}
		}
	},
	
	/******************************************************************************/
	
	_tblAccountsAll: function(data, appState, indexProtocol){
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
	},
	
	_tblAssetsAll: function(data, appState, indexProtocol){
		let maxCountAssets = 1000; //maximum of asset
		let _res = [];
				
		_.each(appState.assetStore, function(v){
			if (_res.length > maxCountAssets) return;
			
			/**
			let x = v;	
				x.txCounter = x.tx.length; 
				x.tx = [];
			**/
			_res.push( v );
			
		});

		return {code: 0, value: Buffer.from(JSON.stringify( _res ), 'utf8').toString('base64')};
	},
	
	_tblAssetInfo: function(data, appState, indexProtocol){
		let symbol = data.toString('utf8').toUpperCase();
				
		console.log('Request info symbol: ' + symbol);
					
		if (!appState.assetStore[ symbol ]){
			return {code: 1};
		}
				
		let ass = appState.assetStore[ symbol ];				
			ass.valuesHistory = [];
					
		if (ass.type === 'index'){
			//todo: maybe latest N
			if (_.isArray(indexProtocol.indexValuesHistory[ symbol ])){
				ass.valuesHistory = indexProtocol.indexValuesHistory[ symbol ].slice( indexProtocol.indexValuesHistory[ symbol ].length - 32);
			}
		}
			
		return {code: 0, value: Buffer.from(JSON.stringify( ass ), 'utf8').toString('base64')};
	}
};