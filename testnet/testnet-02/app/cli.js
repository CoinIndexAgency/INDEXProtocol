//let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');

console.log("\n");
console.log('INDEXProtocol testnet cli tools');
console.log('WARNING: used default TEST private key!');
console.log("\n");

//default private key
let privKey = Buffer.from('178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33', 'hex');

console.log("Private key: " + privKey.toString('hex'));

const 	ecdh = crypto.createECDH('secp256k1');

		ecdh.setPrivateKey( privKey );

let pubKey = ecdh.getPublicKey('hex');


//let pubKey = secp256k1.publicKeyCreate(privKey, false);

console.log("Public key: " + pubKey.toString('hex'));

let address = '';

const sha256 = crypto.createHash('sha256');
const ripemd160 = crypto.createHash('ripemd160');

let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

	address = bs58.encode( hash );
	
	console.log('\n');
	console.log( 'Address (base58 encoded): ' + address );
	console.log('\n');
	
	
	
	console.log('Step 1: create account transaction (mnemonic code: CAT)');
	
	
	
	console.log('Step 2: register new coin (mnemonic code: RNA :: RegisterNewAsset)');
	
	console.log('Step 3: emission (initial) of registered coin (mnemonic code: CGE :: CoinGenerationEvent)');
	
	
	console.log('Step 4: create another account transaction (mnemonic code: CAT)');
	
	
	console.log('Step 5: Transfer coin from acc 1 to acc 2 (mnemonic code: CTE :: CoinTransferEvent)');
	
//=======================
/*	
	
Private key: 178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33
Public key: 04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179



Address (base58 encoded): MCPqykgZUJPb72vC9kgPRC6vvZm
Real hash of pubkey: 18fe93bfc9f4dfea3d9f55f941b7d1a060f6c358
	
	
	

//=======================
const ecdh = crypto.createECDH('secp256k1');
//let keyPair =  ecdh.generateKeys();

//console.debug( keyPair.toString('hex') );

//console.debug( ecdh );

ecdh.setPrivateKey( privKey );

let pubk = ecdh.getPublicKey('hex');

console.log( pubk );
*/

