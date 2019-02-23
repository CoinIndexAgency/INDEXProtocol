let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');

do {
	privKey = crypto.randomBytes(32);
} 
while (!secp256k1.privateKeyVerify(privKey));
  

console.log("Private key: " + privKey.toString('hex'));

let pubKey = secp256k1.publicKeyCreate(privKey, false);

console.log("Public key: " + pubKey.toString('hex'));

