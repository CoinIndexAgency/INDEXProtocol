<?php 
// Load BTC/USD from aggregators

	//prevent double running
	$__outp = Array();	
	exec('ps ax|grep "[a]aggloader.php"', $__outp);
	
	if (count($__outp) > 2){
		echo "WARN: Another process has running...exit\n";
        die();
	}



$_t1 = microtime(true);

include('libExchages.php');

//RPC URL
$rpcURL = 'http://localhost:8080'; //or http://rpc.testnet.indexprotocol.online

//store only trx last 15 min (and 1 min diff delay)
$txFrom = time() - ((15 * 60) + 60);

$resURL = Array();

//base sources
$sourceURL = Array(
	'CoinMarketCap' 	=>	'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&convert=USD&CMC_PRO_API_KEY=c3ce21bb-20b0-41f9-85d0-762a38db9d2b',
	
	'CryptoCompare' => 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD&api_key=1a9487d03903a0852438c742ec8b33e86baf98bbbd4f33846070860c5fd13404',

	'Nomics' => 'https://api.nomics.com/v1/prices?key=891493ad39f33e571878d36cc6a97594',
	
	'CoinLore' => 'https://api.coinlore.com/api/ticker/?id=90',
	
	'ChasingCoins' => 'https://chasing-coins.com/api/v1/convert/BTC/USD',
	
	'CoinGecko'	=> 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', 
	
	'BitcoinAverage' => 'https://apiv2.bitcoinaverage.com/indices/global/ticker/BTCUSD',
	
	'Cryptonator' => 'https://api.cryptonator.com/api/ticker/btc-usd',
	
	'Bitpay'	=> 'https://bitpay.com/rates/BTC/USD'
	
	//'Coinpaprika' => 'https://api.coinpaprika.com/v1/'
	
	
	//'bitdataset' => 'http://api.bitdataset.com/v1/quotes/current/BTC?apikey=4c757578-f110-49a0-8694-1e1abf494fb6'
	
	//Auth by Headers 'BlockMarkets' => ''   lzevk3tgd93WSB1C9L44O2Xy0Y2u0zPN2suvG1vv
	
	//'CoinApi' => 'https://rest.coinapi.io//v1/quotes/SPOT_BTC_USD/current?apikey=592BB7D7-8D99-4DD6-8CC6-8EA38EB5C641
);

//temporary disabled
//	'Bittylicious'	=>	'https://bittylicious.com/api/v1/trades/BTC/USD',
//	'AidosMarket'	=>	'https://aidosmarket.com/api/transactions?market=btc&currency=usd',
//	'Coinfloor'	=>	'https://webapi.coinfloor.co.uk:8090/bist/XBT/USD/transactions/?time=hour',
//	'BTCCUSDExchange'	=>	'https://spotusd-data.btcc.com/data/pro/historydata?symbol=BTCUSD&limit=1000',


//Randomize all 
$_keys = array_keys($sourceURL);

shuffle( $_keys );

$_keys = array_chunk($_keys, $countPerBlock)[0];

echo "At round, we use source: " . implode(', ', $_keys) . "\n";
//echo "Found: " . count($sourceURL) . " sources.\n";

//float to integer
$FIXED_DXDY = 1000000;

foreach($_keys as $ex){
	$url = $sourceURL[ $ex ]; 
	
	echo date('r') . "  Processing: " . $ex . " => " . $url;
	
	$data = @file_get_contents( $url );
	
	if (!empty($data) && $data != '[]'){
		$json = json_decode($data, true, 256);
		
		if (!empty($json) && empty(json_last_error())){
			
			$tdata = parseTrades($ex, $json, Array('asset' => 'BTC', 'currency' => 'USD', 'type' => 'FX'));
			
			if (!empty($tdata)){
				//echo "... Found: " . count( $tdata ) . " trades";
				
				$newTrades = Array();
				
				if (!array_key_exists($ex, $txCache)){
					$txCache[ $ex ] = Array();
				}
				
				echo "\n";	
				$newTx = 0;
				
				foreach($tdata as $t){
					if ($t['ts'] < $txFrom) continue;
					
					
					//var_dump( $t );
					if (!in_array($t['_hash'], $txCache[ $ex ])){
						//новая транзакция 
						$_hash = $t['_hash'];
						
						//unset($t['_hash']);
						unset($t['_org']);
						
						//fix float to Int 
						$t['price'] = intval( $t['price'] * $FIXED_DXDY );
						$t['amount'] = intval( $t['amount'] * $FIXED_DXDY );
						$t['total'] = intval( $t['total'] * $FIXED_DXDY );
						
						$t['excode'] = strtolower($ex);
						
						/**
						echo "\n===============\n";
						$z1 = json_encode($t);
						echo $z1 . "\n";
						
						//echo base64_encode(json_encode($t)) . "\n";
						
						$z2 = pack('H*', base64_encode($z1));
						
						echo $z2 . "\n";
						
						//echo bin2hex( pack('H*', base64_encode(json_encode($t))) ) . "\n\n------------------\n";
						
						//exit();
						*/
						//теперь в HEX-виде представим 
						//$_tx = bin2hex( pack('H*', base64_encode(json_encode($t))) );
						
						if (empty($t['total']) || empty( $t['amount'] ) || empty($t['price']) || $t['price'] < 0 || $t['amount'] < 0)
							continue;
						
						$_tx = 'cet:' . base64_encode(json_encode($t));
						
						$_tx_url = $rpcURL . '/broadcast_tx_async?tx="' . $_tx . '"&_=' . microtime(true);
						
						//отправляем сразу 
						//$resURL[] = $_tx_url;
						$checkTx = file_get_contents($_tx_url);
						
						//add checkig results
						//var_dump($checkTx);
						
						$txCache[ $ex ][] = $_hash;	
						
						echo $_tx_url . "\n";
						
						$newTx++;
						
						//echo ".";
						//sleep(1);
						//exit();
					}
				}
				
				echo date('r') . "  New transactions: " . $newTx . " from " . count($tdata) . "\n";
				
				//echo "\n\n";
				
				//usleep(100000);
			}			
		}
		else
			echo "... ERROR while parse data";
	}
	else 
		"... ERROR: empty responce (no data)";
	
	echo "\n\n";	
}

//сохраняем кеш 
	echo date('r') . "  Store cache...\n";
	
	foreach($txCache as $a => $b){
		$txCache[ $a ] = $a . '::' . implode(';', $b);
	}
	
	$_rawCache = implode("\n", array_values($txCache));
	
	file_put_contents( $txCacheDbFile, $_rawCache );
	
/**	
	if (!empty($resURL)){
	
		shuffle( $resURL );
		
		echo "\nTotal query to send: " . count( $resURL ) . "\n";
		
		foreach($resURL as $txq){
			$checkTx = file_get_contents( $txq );	
			echo ".";
		}
	}
**/	

	


	echo date('r') . "  Finish all at ".(microtime(true) - $_t1)." sec.\n";
