//let secp256k1 		= require('secp256k1');
let crypto			= require('crypto');
let bs58			= require('bs58');
let secp256k1		= require('secp256k1');
let stringify 		= require('fast-json-stable-stringify');
let http			= require('http');

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

let sha256 = crypto.createHash('sha256');
let ripemd160 = crypto.createHash('ripemd160');

let hash = ripemd160.update( sha256.update( pubKey.toString('hex') ).digest() ).digest(); // .digest('hex');

	address = bs58.encode( hash );
	
	console.log('\n');
	console.log( 'Address (base58 encoded): ' + address );
	console.log('\n');
	
	
	
	console.log('Step 1: create account transaction (mnemonic code: CAT)');
	
	var data = {
		exec: 'tbl.accounts.create',	//ns of actions
		addr: address,
		pubk: pubKey.toString('hex'),
		name: 'raiden@indexprotocol.network',
		type: 'user', //index, provider, issuer, exchange, fund... any type
		sign: ''		
	};
	
	//sign in by private key 
		sha256 = crypto.createHash('sha256');
	let dx = Buffer.from( stringify( data ), 'utf8');
	let dxHash = sha256.update( dx ).digest();
	
	
	//console.debug( crypto.getCurves() );
	//console.log('\n');
	//console.debug( crypto.getHashes() );
	
	
	const sigObj = secp256k1.sign(dxHash, privKey);
	let sign = sigObj.signature.toString('hex');
	
	//console.log( sign );
	
	//let sign = crypto.createSign('RSA-SHA256'); //sha256');  ecdsa-with-SHA256
	//	sign.update( dxHash.toString('hex'), 'hex' ); //.end();
		
		
	//console.log( privKey );
		
	//let res = sign.sign( privKey.toString('latin1'), 'latin1');
	let res = secp256k1.verify(dxHash, sigObj.signature, Buffer.from(pubKey, 'hex'));
	
	console.log('  Data: ');
	console.log( data );
	console.log('Hash: ' + dxHash.toString('hex') );
	console.log('Sign: ' + sign);
	console.log(' Verify sign result: ' + res );
	console.log('\n\n');
	
	if (res == true){
		//add tx to chain 
		data.sign = sign;
				
		let tx = 'reg:' + Buffer.from( stringify( data ), 'utf8').toString('base64');
		let url = 'http://localhost:8080/broadcast_tx_commit?tx=' + tx + '&_' + new Date().getTime();
		
		console.log( url );
		
		/*
		http.request(url, function(req){
			if (req){
				req.setEncoding('utf8');
				let  rawData = '';
				
				req.on('data', (chunk) => { rawData += chunk; });
				
				req.on('end', () => {
					try {
					  const parsedData = JSON.parse(rawData);
						
						console.log('\n');
						console.debug(parsedData);
						console.log('\n');
						
					} catch (e) {
					  console.error(e.message);
					}
				  });
				
			}
		});
		*/
		
	}
	
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

