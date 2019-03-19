const crypto			= require('crypto');
const bs58				= require('bs58');
const secp256k1			= require('secp256k1');
const _					= require('underscore');
const fs				= require('fs');
const moment			= require('moment');

console.log("\n");
console.log('INDEXProtocol testnet Genesis.json generator tools');
//console.log('WARNING: used default TEST private key!');
console.log("\n");

var genesis = fs.readFileSync('../config/genesis.json', {encoding: 'utf8'});

if (genesis){
	genesis = JSON.parse( genesis );
}

//Open datasource keys 
const sourceKeys	= JSON.parse( fs.readFileSync('./datasource.keys.json', {encoding:'utf8'}) );

var genesisAppState = {
	accounts	: [],
	assets		: [],
	options		: {
		'nativeSymbol'				: 'IDX',  //tiker for native coin at this network
		'initialNativeCoinBalance'	: 1000000000,	//for any new account TEST balance 
		'defaultEmitent'			: 'emitent@indexprotocol.network',
		'addressPrefix'				: 'indxt', //prefix fro all addresses (INDX-Test)
		'forbiddenIds'				: [
			'@indexprotocol.ltd', 
			'indx*',
			'idx*',
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
		
		'indicesFreq'	: {
			'rt'	:	1, 
			'1min'  :	20,
			'5min'  :	100,
			'15min' :	300,
			'1h'    :	1200,
			'3h'	:	3600, 
			'12h'	:	14400,
			'eod'	:	null,	//@todo realize it
			'eow'	: 	null	//@todo realize it
		},
		
		datafeedDxDy 	: 1000000, //multiplexer for float to int 
		
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
		pubKey = secp256k1.publicKeyConvert( pubKey, true ); //compress key
	
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
			assets				: {},
			messages			: [],
			storage				: []
		},
		tx					: [], //@todo: separate with in/out tx, maybe?
		pubKey				: pubKey.toString('hex')
	};

	let axHash = crypto.createHash('sha256').update( JSON.stringify( acc ) ).digest();
	let sign   = secp256k1.sign(axHash, privKey).signature;
	
	/*
	genesisAppState.validatorsKeys.push({ 'address' : tAddr, 'name' : tName, 'privKey' : privKey.toString('hex') });
	*/
	_valPrivateKeys.push({ 'address' : address, 'taddress' : tAddr, 'name' : tName, 'privKey' : privKey.toString('hex'), pubKey: pubKey.toString('hex'), generate: 'genesis', genDate: moment().toISOString()  });
	
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
	'tester01'			: '71a818282b4288c9db7eaf7ed0a2f3ba992796815442c0e0c753095dac155f28',
	'tester02'			: '0ad0200c4aa3b5295fed1c53b258f04929db954994a403462db1dc2126f9881f',
	'tester03'			: '3acf08075429f8a2a75e15dddca1f1ae822fe4bb7fe33601f11508fa2d496e7c',
	'tester04'			: '692e9512e82d85705944abb8b627cf7f28c7208698b52b87a865ec725ca2c50d',
	'tester05'			: '288bd00d0c45379d3fd858db4e27bc937af9b6bb3980d433bc44cb62d9ed100f',
	'tester06'			: 'f4f53fc8d7030a406d5aabe978be3df25936ce9daefabc22429d1a6812c5bdbc',
	'tester07'			: 'f73d7dab4a1de98863a93dedc267ab6c9d7c3a94a4d07650dbac783d7b48b49d',
	'tester08'			: 'dd7226d351881248a919a45c2e2d9d22b80af7aeb6bf09f882c796231d62795d',
	'tester09'			: '582f84f40dd2eea4a69f096d1e42b834978f7ae3fd0b896d8dec8d8c14b59a09',
	'tester10'			: '630ef1136c81bcf80e6274d8a794439d855e25b5aca602160f321d672a8eae3f', 
		
	'raiden' 			: 'b283ef6aadd9fd8fcb838a2f7f13ac85c8f2dda4460ab62dbfa31a72bd1830a0',
	'aleks_raiden'  	: '96acfd8678524f7b17f618d27161be2f28d862800406aa73de38243fc0895a41',
	'yuliya'  			: 'dfdcdd4e3d839a1b59acb9c71e18c020659009fadf5ecf608046c5f4d754a358',
	'v.naydonov' 		: 'b208e88eb8a564d68396655ffe90b8ef1a877d2bf45c05db71427643c9ddf10d',
	'coolsiu'  			: '2563daa38757496406d5e880e879d63923d980070580ca762a12c7ef961d662e',
	'testnet'  			: '434c81c0adeb3a9856b692867fbe8ae82315780b49423befe5f157a196f585bc',
	'torwig'  			: '9a0c4516a7ed8c38b4702a26e7c47a7a9bdef6df1435dd75147416c582fcd828',
	'irina'  			: 'ca2449c781e6f2afafe40fd0a61dbb6e879fceba3b8566920df1ac6f2de45d9a',
	'andrii.senkovych' 	: '03af5ae85c86b345ae5db5fc3d5ffa973d3a6fcd1c2ab52ec9b8e90d287b8eb7',
	'sandris.murins'	: '4f1ee365af2bedd0aece07325798ebc54812e410dcadcd1fddf2b501d42f42a4',
	'a.kosenko'			: '12eacbef822a89708d5dbb434e38c372af76a373f7beca98a3836a374669a54f',
	'denny.do'			: '62a9f49148c2b70a92215b1a028b92660dbebb87e06a4ccaf729e2c9b5849532',
	'akhavr'			: '41b0c89acd0af4232ae84fa25c9be504d3bd3e8b62f73dd58b5a7fd45d6610af',
	'ksu.zhytomirsky'	: '59f1087fffdc7bc8a68db8eaaf654a00716374c8e4b22de6ded5063fe2725039',
	'ikohut'			: '52fede79f4a6195eb7b8077b151286eb37554148d76070cc112576cf3eb6a1fb',
	'trdata'			: 'a98d5789f0e624d621a323f9fb3ebf6fcb5cea01ac4fbf99f6901c6ea13945d8',
	'vkh'				: '0e4b55e69c5a8e19197cfcf8fd0cf34ebf5d9441a27bc483fcea00d247b2a5b4',
	'omykolaichyk'		: 'ea80f6122175367bb2ef200813b4d8d31ff153fca56cdba9631f2675723daa4c',
	'anna.romasheva'	: 'e998780b2d9e90d62e7abc781f22fbc40b3505c775ffb96f9abc3dfd1e801ccc',
	'elena'				: '0a86af4f2aa0659591dfaa6bfaea88a2cf3a21759bd10aaed340ac6bfbf71c20',
	'julia.trofimchuk'	: '79fbda05bbf63a0bcbcfa7ab613002dc4cbc2949db5c18f734b9727575f0a8e0',
	
	'dex'				: '6892b547bc4c45374f9e2d7a425a365f696a8b27628fc56691217545608fc26e',
	'ddex'				: 'f19343e7d40cbf7fb6cc5fb33fe6734f1a132e25ea900cca2e5aa9b31d04f1f9',
	
	'indexprotocol'		: 'bf135aba2110926c205f28865181c287d2b8304574d8737bcf87ced2aa6199dc',
	'indx.exchange'		: '284f95b176836013a7e344690f1f428bb46a107c3029fe81dc6f30b5f0f7e3d7',
	'openfxmarket'		: '5dc6101928ef5afbf1e6cc90c134efb1c04f9a6ac99658b7fd396f9d00dd077a'	
	
};

var _devAddr = [];

_.each(_devAccounts, function(p, v){
	let ecdh 	= 	crypto.createECDH('secp256k1');
	let privKey = 	Buffer.from(p, 'hex');
		ecdh.setPrivateKey( privKey );
		
	let pubKey = ecdh.getPublicKey();
		pubKey = secp256k1.publicKeyConvert( pubKey, true );
	
	
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
			assets				: {},
			messages			: [],
			storage				: {}
		},
		//tx					:[],
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
	symbol				: 'IDX',
	dividedSymbol		: 'mIDX', //symbol for divided assets
	type				: 'coin', //coin for native coin, token for user assets, contract - for derivative, index - for index
	family				: 'FX',
	standart			: 'IDX20', //reserved for standart class realization
	
	name				: 'IndexCoin',
	desc				: 'Native coin of INDEXProtocol Network', 
	
	//for index and contract - required
	spec				: '', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1000, //possible: 1, 10, 100, 1000, 10000, 100000, 1000000
	
	txFeePaymentBy		: 'IDX', //symbol for pay any fee
	txFee				: 1, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	issuerAddress		: 'indxt0000000000000000000000000000',	//special default address for native coin ONLY
	issuerName			: 'token@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt3LeXXFJqNSTvC4MkrQXfnVcRC8sh', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	dataUpdatesFreq		: 'rt', //data updating declared
	
	emission			: {
		initial			: 	_devAddr.length * genesisAppState.options.initialNativeCoinBalance,
		maxSupply		: 	Number.MAX_SAFE_INTEGER,
		
		issueHeight		: 0,
		maturityHeight	: 0, //0 if unlimited, number of block
		callableMaturityHeight: 1000	
	},
	
	multisig: [], //for multisig action 
	
	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: true,
		isCallableMaturity	: false,
		isFrozen			: false,
		isTransferrable		: true,
		isUniqe				: false, //если каждый токен уникальный (ассоцирован с уникальной строкой)
		isMassPayable		: true,
		isMultisigble		: false,
		isContractAllowed	: true //can be as base assets for other contract
	},
	
	//total summ is CurculationSupply
	holders	: {},  //map of all holders (address => amount)
	txCounter: 0
});

//add initial distribution 
_.each(_devAddr, function(v){
	genesisAppState.initialAllocation.push({
		to		: v,
		symbol	: genesisAppState.options.nativeSymbol,
		amount	: genesisAppState.options.initialNativeCoinBalance
	});
	
	let ass = _.find(genesisAppState.assets, function(v){ if (v.symbol == genesisAppState.options.nativeSymbol) return true; else return false;});
	
	if (ass){
		ass.holders[ v ] = genesisAppState.options.initialNativeCoinBalance;
	}
});

let assets	= [{	symbol				: 'BTCUSD_COININDEX',
	'dividedSymbol'		: '', 
	'type'				: 'index',
	'family'				: 'IND', 
	'standart'			: 'IDX42', 
	
	'name'				: 'BTC/USD Trusted Reference Rate by CoinIndex',
	'desc'				: 'Standart index token for tracking performance and issues derivative', 
	
	'spec'				: 'https://coinindex.agency/indices/spec/BTCUSD_COININDEX.pdf', 
	'newsfeed'			: 'https://feed.coinindex.agency/indices/BTCUSD_COININDEX', 
	
	'underlayerSymbol'	: '', 
	'divider'			: 1,
	
	'txFeePaymentBy'	: 'IDX',
	'txFee'				: 0, 
	'txIssuerFee'		: 0, 

	'issuerAddress'		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	
	'issuerName'		: 'indexprotocol@indexprotocol.network', 
	
	'txFeeAddress'		: 'indxt0000000000000000000000000000', 
	'txIsserFeeAddress'	: 'indxt0000000000000000000000000000', 
	
	'actionsAllowed'	: [], 
	
	'initDataValue'		: 0,
	'latestDataValue'	: 0,
	'changesByPrevios'	: 0,
	'latestUpdateHeight': 0,	
	
	'dataUpdatesFreq'	: 1, 
	
	'emission'			: {
		'initial'			: 10000000, 
		'maxSupply'		: 10000000,
		
		'issueHeight'		: 0,
		'maturityHeight'	: 0,
		'callableMaturityHeight': 0	
	},
	
	'multisig': [],

	'options'				: {
		'isTradable'			: true, 
		'isBurnable'			: true,
		'isMintable'			: false,
		'isCallableMaturity'	: false,
		'isFrozen'			: true,
		'isTransferrable'		: true,
		'isUniqe'				: false, 
		'isMassPayable'		: false,
		'isMultisigble'		: false,
		'isContractAllowed'	: true 
	},

	'holders'	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	'txCounter': 0
},
{
	'symbol'				: 'BTCUSD_BPI',
	'dividedSymbol'		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'Bitcoin Price Index (BPI) by CoinDesc',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.coindesk.com/price/bitcoin', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'BTCUSD_CF_RTI',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'XBT/USD Real-Time Index by CryptoFacilities/CME',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/XBT/USD/RTI', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'BTCUSD_CF_RR',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'XBT/USD Reference Rate Index by CryptoFacilities/CME',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/XBT/USD/RR', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'ETHUSD_CF_RR',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'ETH/USD Reference Rate Index by CryptoFacilities/CME',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/ETH/USD/RR', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'ETHUSD_CF_RTI',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'ETH/USD Real-Time Index by CryptoFacilities/CME',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/ETH/USD/RTI', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'XRPUSD_CF_RR',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'XRP/USD Reference Rate Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/XRP/USD/RR', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'BCHUSD_CF_RR',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'BCH/USD Reference Rate Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/BCH/USD/RR', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'LTCUSD_CF_RR',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'LTC/USD Reference Rate Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/LTC/USD/RR', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'XRPUSD_CF_RTI',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'XRP/USD Real-Time Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/XRP/USD/RTI', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'BCHUSD_CF_RTI',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'BCH/USD Real-Time Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/BCH/USD/RTI', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'LTCUSD_CF_RTI',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'LTC/USD Real-Time Index by CryptoFacilities',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: 'https://www.cryptofacilities.com/indices/LTC/USD/RTI', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
},
{
	symbol				: 'BTCUSD_CG',
	dividedSymbol		: '', //symbol for divided assets
	type				: 'index',
	family				: 'IND', //as Bloomber code
	standart			: 'IDX42', //@todo: use spec file for validation and stored contract
	
	name				: 'BTC/USD Price Index by CoinGecko',
	desc				: 'Standart index token for tracking performance and issues derivative', 
	
	spec				: '', //link to asset specification
	newsfeed			: '', //link to RSS feed for news related to asset
	
	underlayerSymbol	: '', //for contract - base asset 
	divider				: 1,
	
	txFeePaymentBy		: 'IDX',
	txFee				: 0, //default fee, payed for validators 
	txIssuerFee			: 0, //fee, payed to issuer from any tx with this asset 
	
	//fill by data from account
	issuerAddress		: 'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da',	//special default address for native coin ONLY
	issuerName			: 'indexprotocol@indexprotocol.network', //alt-name, one of registered at account
	
	txFeeAddress		: 'indxt0000000000000000000000000000', //address for collected tx fee
	txIsserFeeAddress	: 'indxt0000000000000000000000000000', //address for collected Issuer fee (licensed) or 000000 default address
	
	actionsAllowed		: [], //actions, reserved for future
	
	//addition data for token. e.g. index value for index
	initDataValue		: 0,
	latestDataValue		: 0,
	changesByPrevios	: 0, //unsigned
	latestUpdateHeight	: 0,	
	
	//@todo: use block counter to update this
	dataUpdatesFreq		: 1, //data updating declared
	
	emission			: {
		initial			: 10000000, 
		maxSupply		: 10000000,
		
		issueHeight		: 0,
		maturityHeight	: 0,
		callableMaturityHeight: 0	
	},
	
	multisig: [], //for multisig action 

	options				: {
		isTradable			: true, 
		isBurnable			: true,
		isMintable			: false,
		isCallableMaturity	: false,
		isFrozen			: true,
		isTransferrable		: true,
		isUniqe				: false, 
		isMassPayable		: false,
		isMultisigble		: false,
		isContractAllowed	: true 
	},
	
	//total summ is CurculationSupply
	//map of all holders (address => amount)
	holders	: { 
		'indxt3pSjMK9v1fF1v4Hoo1YtLtFj38Da' : 10000000
	},  
	txCounter: 0
}];

assets.forEach(function(a){
	genesisAppState.assets.push( a );
	
	_.each(a.holders, function(ua, uz){
		genesisAppState.initialAllocation.push({
			to		: ua,
			symbol	: a.symbol,
			amount	: uz
		});
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

/** only for test gen **/
//create private key file for each validators 
_.each(_valPrivateKeys, function(v){
	fs.writeFileSync( v.name + '.account.json', JSON.stringify( v ), {encoding: 'utf8'});
});


console.log('Genesis.json successful rewritten!');
console.log('To take effect: restart your indexapp.js with cleandb option');
