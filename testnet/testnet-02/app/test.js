let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');


console.debug( secp256k1 );


console.log("\n");

do {
	privKey = crypto.randomBytes(32);
} 
while (!secp256k1.privateKeyVerify(privKey));
  

console.log("Private key: " + privKey.toString('hex'));


let pubKey = secp256k1.publicKeyCreate(privKey, false);

console.log("Public key: " + pubKey.toString('hex'));

let address = '';


const sha256 = crypto.createHash('sha256');
const ripemd160 = crypto.createHash('ripemd160');

let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

	address = bs58.encode( hash );
	
	console.log('\n\n');
	console.log( 'Address (base58 encoded): ' + address );
	console.log( 'Real hash of pubkey: ' + hash.toString('hex') );
	console.log('\n');
	
//=======================
/*	
	
Private key: 178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33
Public key: 04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179



Address (base58 encoded): MCPqykgZUJPb72vC9kgPRC6vvZm
Real hash of pubkey: 18fe93bfc9f4dfea3d9f55f941b7d1a060f6c358
	
	
	
*/
//=======================
const ecdh = crypto.createECDH('secp256k1');
//let keyPair =  ecdh.generateKeys();

//console.debug( keyPair.toString('hex') );

//console.debug( ecdh );

ecdh.setPrivateKey( privKey );

let pubk = ecdh.getPublicKey('hex');

console.log( pubk );



/*
coins.secp256k1Account.getAddress({ pubkey }) 
		addressHash(input.pubkey)
		
		
		let sha256 = hashFunc('sha256')
let ripemd160 = hashFunc('ripemd160')

function addressHash (data) {
  let hash = ripemd160(sha256(data))
  return hashToAddress(hash)
}

function hashToAddress (hash) {
  return base58check.encode(hash)
}


*/