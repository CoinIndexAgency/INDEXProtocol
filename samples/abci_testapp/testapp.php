<?php 
//Used libExchange provided by CoinIndex Ltd.
//For test, use only BTC/USD trading pair from some exchanges

include('libExchages.php');

//Extra-simple cache db - store last 1000 hashes of trades for each exchange.
$txCacheDbFile = 'tx.cache.db';
$txCacheMaxItems = 1000;

$txCache = Array();

echo date('r') . "  Starting cache tx loading...\n";

if (file_exists( $txCacheDbFile )){
	$_txc = explode("\n", file_get_contents( $txCacheDbFile ));
	
	foreach($_txc as $x){
		$z = explode('::', $x);
		
		if (!empty($z[0]) && !empty($z[1])){
			$txCache[ $z[0] ] = explode(';', $z[1]);
		}
	}
}

echo date('r') . "  Cache tx loaded OK\n\n";

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
//shuffle( $sourceURL );

echo "Found: " . count($sourceURL) . " sources.\n";

foreach($sourceURL as $ex => $url){
	echo date('r') . "  Processing: " . $ex . " => " . $url;
	
	$data = @file_get_contents( $url );
	
	if (!empty($data) && $data != '[]'){
		$json = json_decode($data, true, 256);
		
		if (!empty($json) && empty(json_last_error())){
			
			$tdata = parseTrades($ex, $json, Array('asset' => 'BTC', 'currency' => 'USD', 'type' => 'FX'));
			
			if (!empty($tdata)){
				echo "... Found: " . count( $tdata ) . " trades";
				
				
			}			
		}
		else
			echo "... ERROR while parse data";
	}
	else 
		"... ERROR: empty responce (no data)";
	
	echo "\n\n";	
}

