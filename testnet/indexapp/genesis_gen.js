const crypto			= require('crypto');
const bs58				= require('bs58');
const secp256k1			= require('secp256k1');
const _					= require('underscore');
const fs				= require('fs');

console.log("\n");
console.log('INDEXProtocol testnet Genesis.json generator tools');
//console.log('WARNING: used default TEST private key!');
console.log("\n");

var genesis = fs.readFileSync('../config/genesis.json', {encoding: 'utf8'});

if (genesis){
	genesis = JSON.parse( genesis );
}

var genesisAppState = {
	accounts	: [],
	assets		: [],
	options		: {
		'nativeSymbol'				: 'IDXT',  //tiker for native coin at this network
		'initialNativeCoinBalance'	: 1000000000,	//for any new account TEST balance 
		'defaultEmitent'			: 'emitent@indexprotocol.network',
		'addressPrefix'				: 'indxt', //prefix fro all addresses (INDX-Test)
		'forbiddenIds'				: [
			'@indexprotocol.ltd', 
			'emitent@indexprotocol.network', 
			'info@indexprotocol.network', 
			'token@indexprotocol.network', 
			'idxt@indexprotocol.network', 
			'ico@indexprotocol.network', 
			'admin@indexprotocol.network', 
			'support@indexprotocol.network',
			'dex@indexprotocol.network',
			'partner@indexprotocol.network',
			'exchange@indexprotocol.network'
		], //only at genesis will be created
		
		'initialValidatorStake'		: 250000000,
				
		//full reward = rewardPerBlock + (rewardPerDataTx * DataTxCount) + SUMM(TxFee)
		'rewardPerBlock'			: 1000, //reward to Validator for block (base value, for any tx at block)
		'rewardPerDataTx'			: 10,
		
		//any of account-initials tx
		'baseTxFee'					: 1
	},
	validatorsKeys		:		[], //TEST - private keys of validators 
	initialAllocation	: 		[]
};

console.log('Create native address-es for each initial validator');

var _valPrivateKeys = [];

_.each(genesis.validators, function(v){
	let tAddr = v.address.toLowerCase(); //tendermint address 
	let tName = v.name;
	
	
	let 	ecdh 	= 	crypto.createECDH('secp256k1');
			ecdh.generateKeys();
		
	let privKey = ecdh.getPrivateKey();
	let pubKey = ecdh.getPublicKey();
	
	let sha256 = crypto.createHash('sha256');
	let ripemd160 = crypto.createHash('ripemd160');

	//IDXT - GlobalCode, 01 - version (e.g. ate chain-id), TEST - codename of network
	
	let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest();
	
	//native address of network
	let address = genesisAppState.options.addressPrefix + bs58.encode( hash );

	let acc = {
		ids					:[tAddr], //add native address from Tendermint as alt
		name				: tName + '@indexprotocol.network',		//main name, if associated		
		address				: address,
		createdBlockHeight	: 0,
		updatedBlockHeight  : 0,
		type				: 'node',
		nonce				: 0, //count tx from this acc
		data				: {
			assets				: [],
			messages			: ['This is a test'],
			storage				: []
		},
		pubKey				: pubKey.toString('hex')
	};

	let axHash = crypto.createHash('sha256').update( JSON.stringify( acc ) ).digest();
	let sign   = secp256k1.sign(axHash, privKey).signature;
	
	/*
	genesisAppState.validatorsKeys.push({ 'address' : tAddr, 'name' : tName, 'privKey' : privKey.toString('hex') });
	*/
	_valPrivateKeys.push({ 'address' : address, 'taddress' : tAddr, 'name' : tName, 'privKey' : privKey.toString('hex') });
	
	genesisAppState.accounts.push({
		addr: address,
		hash: axHash.toString('hex'),
		sign: sign.toString('hex'),
		pubk: pubKey.toString('hex'),
		data: Buffer.from(JSON.stringify(acc), 'utf8').toString('base64')
	});
});

console.log('Validators accounts (TEST)');
console.log('Store it PRIVACY');
console.dir( _valPrivateKeys, {depth: 4, color:true} );

//create some Initial acc for devs 
var _devAccounts = {
	'raiden' 			: 'b283ef6aadd9fd8fcb838a2f7f13ac85c8f2dda4460ab62dbfa31a72bd1830a0',
	'aleks_raiden'  	: '96acfd8678524f7b17f618d27161be2f28d862800406aa73de38243fc0895a41',
	'yuliya'  			: 'dfdcdd4e3d839a1b59acb9c71e18c020659009fadf5ecf608046c5f4d754a358',
	'v.naydonov' 		: 'b208e88eb8a564d68396655ffe90b8ef1a877d2bf45c05db71427643c9ddf10d',
	'coolsiu'  			: '2563daa38757496406d5e880e879d63923d980070580ca762a12c7ef961d662e',
	'testnet'  			: '434c81c0adeb3a9856b692867fbe8ae82315780b49423befe5f157a196f585bc',
	'torwig'  			: '9a0c4516a7ed8c38b4702a26e7c47a7a9bdef6df1435dd75147416c582fcd828',
	'irina'  			: 'ca2449c781e6f2afafe40fd0a61dbb6e879fceba3b8566920df1ac6f2de45d9a',
	'andrii.senkovych' 	: '03af5ae85c86b345ae5db5fc3d5ffa973d3a6fcd1c2ab52ec9b8e90d287b8eb7'
};

var _devAddr = [];

_.each(_devAccounts, function(p, v){
	let ecdh 	= 	crypto.createECDH('secp256k1');
	let privKey = 	Buffer.from(p, 'hex');
		ecdh.setPrivateKey( privKey );
		
	let pubKey = ecdh.getPublicKey();
	
	
	let sha256 = crypto.createHash('sha256');
	let ripemd160 = crypto.createHash('ripemd160');

	//IDXT - GlobalCode, 01 - version (e.g. ate chain-id), TEST - codename of network
	let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest();
	
	//native address of network
	let address = genesisAppState.options.addressPrefix + bs58.encode( hash );
	
	_devAddr.push( address );

	let acc = {
		ids					:[v + '@coinindex.agency', v + '@indexprotocol.ltd'], 
		name				: v + '@indexprotocol.network',		//main name, if associated		
		address				: address,
		createdBlockHeight	: 0,
		updatedBlockHeight  : 0,
		type				: 'user',
		nonce				: 0, //count tx from this acc
		data				: {
			assets				: [],
			messages			: ['This is a test'],
			storage				: []
		},
		pubKey				: pubKey.toString('hex')
	};

	let axHash = crypto.createHash('sha256').update( JSON.stringify( acc ) ).digest();
	let sign   = secp256k1.sign(axHash, privKey).signature;

	//
	genesisAppState.accounts.push({
		addr: address,
		hash: axHash.toString('hex'),
		sign: sign.toString('hex'),
		pubk: pubKey.toString('hex'),
		data: Buffer.from(JSON.stringify(acc), 'utf8').toString('base64')
	});

});

//create initial assets 
genesisAppState.assets.push({
	symbol				: 'IDXT',
	type				: 'coin', //coin for native coin, token for user assets, contract - for derivative
	genesisBlockHeight	: 0,
	initial				: genesisAppState.accounts.length * genesisAppState.options.initialNativeCoinBalance,
	allows				: ['transfer', 'hold', 'burn', 'buy', 'sell', 'loan', 'payment', 'exchanged'],
	divider				: 1000,
	maxSupply			: Math.trunc( 9007199254740991 / 1000 ),
	emission			: genesisAppState.options.rewardPerBlock, //emission per block
	owner				: 'emitent@indexprotocol.network', //address of emiten - FORBIDDEN IDS
});

//add initial distribution 
_.each(_devAddr, function(v){
	genesisAppState.initialAllocation.push({
		to		: v,
		symbol	: genesisAppState.options.nativeSymbol,
		amount	: genesisAppState.options.initialNativeCoinBalance
	});
});

let app_state = Buffer.from( JSON.stringify( genesisAppState ), 'utf8' ).toString('base64');

console.log('\n\n');

console.dir( genesisAppState, {depth: 16, color: true} );

console.log('\n\n');

console.log( app_state );

console.log('\n\n');

//save as genesis.json 
genesis.app_state = app_state;

fs.writeFileSync( '../config/genesis.json', JSON.stringify( genesis ), {encoding: 'utf8'});

/** only for test gen
//create private key file for each validators 
_.each(_valPrivateKeys, function(v){
	fs.writeFileSync( v.name + '.validatorkey.json', JSON.stringify( v ), {encoding: 'utf8'});
});
**/

console.log('Genesis.json successful rewritten!');
console.log('To take effect: restart your indexapp.js with cleandb option');
