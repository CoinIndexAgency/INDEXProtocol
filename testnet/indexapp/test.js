let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');

var B = bn => Buffer.from(('00000000'+bn.toString('hex')).slice(-64), 'hex');


console.debug( secp256k1 );


console.log("\n");
/**
do {
	privKey = crypto.randomBytes(32);
} 
while (!secp256k1.privateKeyVerify(privKey));
  

console.log("Private key: " + privKey.toString('hex'));
**/

let privKey = Buffer.from('71a818282b4288c9db7eaf7ed0a2f3ba992796815442c0e0c753095dac155f28', 'hex');
let pubKey = secp256k1.publicKeyCreate(privKey, false);

console.log("Public key: " + pubKey.toString('hex'));
console.log("Privat key: " + privKey.toString('hex'));


let msg = crypto.createHash('sha256').update( 'test' ).digest();
let signObj   = secp256k1.sign(msg, privKey);
let sign   = signObj.signature;

console.log('Hash (sha256):' + msg.toString('hex') );
console.log("Signature: " + sign.toString('hex'));
//console.dir( msg );

let verif = secp256k1.verify(msg, sign, pubKey);
console.log("Verify sign: " + verif);

let expSign = secp256k1.signatureExport( sign );

console.log("Exported sign: " + Buffer.from(expSign).toString('hex'));

let normalSign = secp256k1.signatureNormalize( sign );

console.log("Normalize sign: " + Buffer.from(normalSign).toString('hex'));

console.log("\n\n");
//console.dir( Buffer.from(expSign).toString('hex'), {depth:32, colors: true} );

console.log('Verify browser signature');
console.log("\n\n");

let browserSignDER = '30440220395423ae13fa3d0cc059064c8b393854ad8d56122328607358ec1c7750f2142e022064a36b9b5ccaa41c88372163bce3deedbca6b77db73536c1a31c89fe0c7fd25e';

let b_importedSign = secp256k1.signatureImport( Buffer.from(browserSignDER, 'hex') );

let b_normalSign = secp256k1.signatureNormalize( b_importedSign );

console.dir(b_importedSign, {depth:8, colors: true});
console.dir(b_normalSign, {depth:8, colors: true});

let bVerify = secp256k1.verify(msg, b_normalSign, pubKey);

console.log('DER signature (imported and normalized) test result: ' + bVerify);

process.exit();











let bSign = {
	r: '977cdabd794694a97568c12056ac1d1b4f9a9b3796b2141ab009d19507621e1c',
	s: '0c037629f25614780b0d827f563a219802da4c1ddf6ba2dbfb189ba0b571ea7e'
};

let sNorm = secp256k1.signatureNormalize( Buffer.concat([ Buffer.from(bSign.r, 'hex'), Buffer.from(bSign.s, 'hex') ]) );

//console.dir( sNorm, {depth:4} );

/**
let bSign = Buffer.from('30440220395423ae13fa3d0cc059064c8b393854ad8d56122328607358ec1c7750f2142e022064a36b9b5ccaa41c88372163bce3deedbca6b77db73536c1a31c89fe0c7fd25e', 'hex');
**/
let pubKeyComp = crypto.ECDH.convertKey( pubKey,
										 'secp256k1',
										 'hex',
										 'hex',
										 'compressed');



let verif2 = secp256k1.verify( msg, sNorm, Buffer.from(pubKeyComp, 'hex') );
				
//				Buffer.concat([ Buffer.from(bSign.r, 'hex'), Buffer.from(bSign.s, 'hex') ]), 
// pubKey);
console.log("Verify browser sign: " + verif2);

/**


Public key: 045f91bfe2a8dba5782ec29547f9b6e8bdf28d30d7f0802bb69b387006ac4bcce802f850ea464b05f84a6f0077738ee9fc7ea0486658bc3e8aae9148d14d88f93d
Privat key: 71a818282b4288c9db7eaf7ed0a2f3ba992796815442c0e0c753095dac155f28
Hash (sha256):9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
Signature: a8d0665368ec7e792590d91a49d8fa15631fbe526eb87da36e7d3f1e00a3db701885c9adb017d62826e8d91c35a593c1fceeae8486be83753f3f1e6b29d7ff84




71a818282b4288c9db7eaf7ed0a2f3ba992796815442c0e0c753095dac155f28
Hash: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
Sign: 5c77a59ee0994ba9e89362e6731807632ad85920e78c52683d9fca4bf82cc9bc1655f6c8497700e236040e7492052d1f833f7154632a7515d0e294a896c1174b


b5b37869abddb4e30fa1bc9d9bf3b1f28a565676cc7bd1cd236dff68348447880ea7727ea1e79ac5e5732deaaf8f0e8c0aa256e00714089e70d45e99d6ca5a58

r: "b5b37869abddb4e30fa1bc9d9bf3b1f28a565676cc7bd1cd236dff6834844788"
s: "0ea7727ea1e79ac5e5732deaaf8f0e8c0aa256e00714089e70d45e99d6ca5a58"
v: 1

3cbdca4c91ae19598dd874e9d8311603bebddd45594f44fc04c32c6b3ce880a6
**/

//045f91bfe2a8dba5782ec29547f9b6e8bdf28d30d7f0802bb69b387006ac4bcce802f850ea464b05f84a6f0077738ee9fc7ea0486658bc3e8aae9148d14d88f93d

/**

let address = '';


const sha256 = crypto.createHash('sha256');
const ripemd160 = crypto.createHash('ripemd160');

let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

	address = bs58.encode( hash );
	
	console.log('\n\n');
	console.log( 'Address (base58 encoded): ' + address );
	console.log( 'Real hash of pubkey: ' + hash.toString('hex') );
	console.log('\n');
**/	
//=======================
/*	
	
Private key: 178194397bd5290a6322c96ea2ff61b65af792397fa9d02ff21dedf13ee9bb33
Public key: 04145da5f0ec89ffd9c8e47758e922d26b472d9e81327e16e649ab78f5ab259977756ceb5338dd0eddcff8633043b53b25b877b79f28f1d70f9b837ffaca315179



Address (base58 encoded): MCPqykgZUJPb72vC9kgPRC6vvZm
Real hash of pubkey: 18fe93bfc9f4dfea3d9f55f941b7d1a060f6c358
	
	
	
*/
//=======================
/**
const ecdh = crypto.createECDH('secp256k1');
let keyPair =  ecdh.generateKeys();

console.log('=======');
console.debug( keyPair.toString('hex') );
console.log('=======');

//console.debug( ecdh );

ecdh.setPrivateKey( privKey );

let pubk = ecdh.getPublicKey('hex');

console.log( pubk );

**/

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