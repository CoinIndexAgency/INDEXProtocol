<?php 
//Used libExchange provided by CoinIndex Ltd.
//For test, use only BTC/USD trading pair from some exchanges

	//prevent double running
	$__outp = Array();	
	exec('ps ax|grep "[f]eedloader.php"', $__outp);
	
	if (count($__outp) > 2){
		echo "WARN: Another process has running...exit\n";
        die();
	}



$_t1 = microtime(true);

include('libExchages.php');

//Extra-simple cache db - store last 1000 hashes of trades for each exchange.
$txCacheDbFile = './tx.cache.db';
$txCacheMaxItems = 1000;

//Count of blocks
$countPerBlock = 13; 

//RPC URL
$rpcURL = 'http://localhost:8080'; //or http://rpc.testnet.indexprotocol.online

//store only trx last 15 min (and 1 min diff delay)
$txFrom = time() - ((15 * 60) + 60);

$txCache = Array();
$_txc = Array();

echo date('r') . "  Starting cache tx loading...\n";

if (file_exists( $txCacheDbFile )){
	$_txc = explode("\n", file_get_contents( $txCacheDbFile ));
	
	foreach($_txc as $x){
		$z = explode('::', $x);
		
		if (!empty($z[0]) && !empty($z[1])){
			$txCache[ $z[0] ] = explode(';', $z[1]);
			
			echo $z[0] . " cached " . count( $txCache[ $z[0] ] ) . "\n";
		}
	}
}

echo "\n" . date('r') . "  Cache tx loaded OK (items: ".count($_txc).")\n\n";

$resURL = Array();

//base sources
$sourceURL = Array(
	'CEX.io' 	=>	'https://cex.io/api/trade_history/BTC/USD/',
	'BTC-Alpha' =>	'https://btc-alpha.com/api/v1/exchanges/?format=json&limit=250&pair=BTC_USD',
	'Bitfinex' 	=>	'https://api.bitfinex.com/v1/trades/btcusd?limit_trades=250',
	'Quoine'	=>	'https://api.quoine.com/executions?product_id=1&limit=1000&page=1',
	'GDAX'		=>	'https://api.gdax.com/products/BTC-USD/trades?limit=100',
	'HitBTC'	=>	'https://api.hitbtc.com/api/2/public/trades/BTCUSD?limit=250',
	'Bitstamp'	=>	'https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour',
	'Gemini'	=>	'https://api.gemini.com/v1/trades/btcusd?limit_trades=250&include_breaks=0',
	'LakeBTC'	=>	'https://api.lakebtc.com/api_v2/bctrades?symbol=btcusd',
	'Exmo'		=>	'https://api.exmo.com/v1/trades/?pair=BTC_USD',
	'CoinsBank'	=>	'https://coinsbank.com/api/bitcoincharts/trades/BTCUSD',
	'BitBay'	=>	'https://bitbay.net/API/Public/BTCUSD/trades.json?sort=desc',
	'QuadrigaCX'	=>	'https://api.quadrigacx.com/v2/transactions?book=btc_usd&time=hour',
	'Livecoin'	=>	'https://api.livecoin.net/exchange/last_trades?currencyPair=BTC/USD&minutesOrHour=false',
	'itBit'		=>	'https://api.itbit.com/v1/markets/XBTUSD/trades',
	'OkCoin/Intl'	=>	'https://www.okcoin.com/api/v1/trades.do?symbol=btc_usd',
	'Independent Reserve'	=>	'https://api.independentreserve.com/Public/GetRecentTrades?primaryCurrencyCode=xbt&secondaryCurrencyCode=usd&numberOfRecentTradesToRetrieve=50',
	'DSX'	=>	'https://dsx.uk/mapi/trades/btcusd',
	'Gatecoin'	=>	'https://api.gatecoin.com/Public/Transactions/BTCUSD?Count=250',
	'Waves DEX'	=>	'http://marketdata.wavesplatform.com/api/trades/BTC/USD/100',
	'Abucoins'	=>	'https://api.abucoins.com/products/BTC-USD/trades?limit=200',
	'Bitsane'	=>	'https://bitsane.com/api/public/trades?pair=BTC_USD&limit=250',
	'Bitex.la'	=>	'https://bitex.la/api-v1/rest/btc_usd/market/transactions',
	'Bitlish'	=>	'https://bitlish.com/api/v1/trades_history?pair_id=btcusd',
	'SouthXchange'	=>	'https://www.southxchange.com/api/trades/BTC/USD',
	'Bisq'	=>	'https://markets.bisq.network/api/trades?market=btc_usd&limit=250&format=json&sort=desc',
	'Coingi'	=>	'https://api.coingi.com/current/transactions/btc-usd/250',
	'LEOxChange'	=>	'https://restapi.leoxchange.com/Ticker/TradeHistory?coinPair=BTC/USD&rows=100',
	'Cobinhood'		=>	'https://api.cobinhood.com/v1/market/trades/BTC-USD?limit=50',
	'CoinbasePro'	=>	'https://api.pro.coinbase.com/products/BTC-USD/trades',
	'RightBTC'	=>	'https://www.rightbtc.com/api/public/trades/BTCUSD/100'
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
