<?php 
/** Обработка биржевых данных **/


//процессинг данных для формирования трейд-урлов 
function parseMarkets($exName = null, $json = null, $ex){
	if (empty($exName) || empty($json)) return null;
	
	$marketsList = Array();
	
	
	switch ($exName){
		case 'Bittrex': {
			if ($json['success'] == true){
				foreach($json['result'] as $x){
					if ($x['IsActive'] != true) continue;
					
					$marketsList[] = Array(
						'market' => $x['MarketName'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['MarketCurrency']),
						'currency'	=> strtoupper($x['BaseCurrency'])
					);
				}
			}
			break;
		}
		case 'KUNA': {
			foreach($json as $x => $xx){
				$m = parseTradingPair( $x );
				
				if (!empty($m)){
					$a = explode('/', $m);
					
					$marketsList[] = Array(
						'market' 	=> $x,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);					
				}
			}
			break;
		}
		case 'BTC-trade.com.ua' : {
			foreach($json as $x){
				$ass = explode('_', $x);
					
				$marketsList[] = Array(
					'market' 	=> $x,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($ass[0]),
					'currency'	=> strtoupper($ass[1])
				);
			}
			break;
		}							
		case 'WEX' : {
			if (!empty($json['pairs'])){
				foreach($json['pairs'] as $m => $x){
					if ($x['hidden'] != 0) continue;
					$ass = explode('_', $m);
					$cur = strtoupper($ass[1]);
					
					if ($cur == 'RUR') $cur = 'RUB';
						
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($ass[0]),
						'currency'	=> $cur
					);											
				}
			}
			break;
		}							
		case 'CEX.io' : {
			if ($json['ok'] == 'ok' && !empty($json['data']['pairs'])){
				foreach($json['data']['pairs'] as $x){
					$m = strtoupper($x['symbol1']) . '/' . strtoupper($x['symbol2']);
															
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['symbol1']),
						'currency'	=> strtoupper($x['symbol2'])
					);											
				}
			}
			break;
		}
		case 'BTC-Alpha' : {
			foreach($json as $x){
				$m = $x['name'];
					
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['currency1']),
					'currency'	=> strtoupper($x['currency2'])
				);											
			}
			break;
		}
		case 'Bithumb' : {
			if ($json['status'] == '0000' && !empty($json['data'])){
				foreach($json['data'] as $m => $x){
					if (!is_array($x)) continue;
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($m),
						'currency'	=> 'KRW'
					);
				}
			}	
			break;
		}
		case 'Bitfinex' : {
			foreach($json as $x){
				$m = parseTradingPair( $x );
				
				if (!empty($m)){
					$a = explode('/', $m);
						
					$marketsList[] = Array(
						'market' 	=> $x,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);											
				}
			}
			break;
		}
		case 'Ethfinex' : {
			foreach($json as $x){
				$m = parseTradingPair( $x );
				
				if (!empty($m)){
					$a = explode('/', $m);	
					
					$marketsList[] = Array(
						'market' 	=> $x,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);											
				}
			}
			break;
		}
		case 'BitMEX' : {
			foreach($json as $x){
				if ($x['state'] != 'Open') continue;
				
				$marketsList[] = Array(
					'market' 	=> $x['symbol'],
					'type'		=> 'FUT',
					'asset'		=> strtoupper($x['underlying']),
					'currency'	=> strtoupper($x['quoteCurrency'])
				);
			}			
			break;
		}
		case 'Coincheck' : {
			foreach($json as $x){
				$ass = explode('_', $x);
					
				$marketsList[] = Array(
					'market' 	=> $x,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($ass[0]),
					'currency'	=> strtoupper($ass[1])
				);
			}			
			break;
		}
		case 'BlinkTrade' : {
			foreach($json as $m){
				$t = explode('/', $m);
				
				$marketsList[] = Array(
					'market' 	=> ''.strtoupper($t[1]).'/trades?crypto_currency='.strtoupper($t[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}		
		case 'Poloniex' : {
			foreach($json as $m => $x){
				if ($x['isFrozen'] != 0) continue;
					
				$ass = explode('_', $m);
				// у полоникса торговые пары наоборот - валюта, потом актив 
					
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($ass[1]),
					'currency'	=> strtoupper($ass[0])
				);
			}
			break;
		}
		case 'Coinone' : {
			if ($json['errorCode'] == 0 && $json['result'] == 'success'){
				
				foreach($json as $x){
					if (!is_array($x)) continue;
					
					$marketsList[] = Array(
						'market' 	=> $x['currency'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['currency']),
						'currency'	=> 'KRW'
					);										
				}								
			}
			break;
		}
		case 'NLexch' : {
			foreach($json as $x){
				$m = $x['id'];
				$t = explode('/', $x['name']);							
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);											
			}
			break;	
		}
		case 'SurBTC' : {
			if (!empty($json['markets'])){
				foreach($json['markets'] as $x){
					$marketsList[] = Array(
						'market' 	=> $x['name'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['base_currency']),
						'currency'	=> strtoupper($x['quote_currency'])
					);											
				}
			}
			break;	
		}
		
		case 'Quoine' : {
			foreach($json as $x){
				if ($x['disabled'] == false && $x['product_type'] == 'CurrencyPair'){
					$m = $x['id'];
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'pair'		=> $x['currency_pair_code'],
						'asset'		=> strtoupper($x['base_currency']),
						'currency'	=> strtoupper($x['quoted_currency'])
					);											
				}
			}
			break;
		}
							
		case 'Binance' : {
			if ((!empty($json['symbols']))){
				foreach($json['symbols'] as $x){
					if ($x['status'] == 'TRADING'){
						$m = $x['symbol'];
						
						$marketsList[] = Array(
							'market' 	=> $m,
							'type'		=> 'CUR',
							'asset'		=> strtoupper($x['baseAsset']),
							'currency'	=> strtoupper($x['quoteAsset'])
						);											
					}
				}								
			}
			break;
		}
							
		case 'GDAX' : {
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['id'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base_currency']),
					'currency'	=> strtoupper($x['quote_currency'])
				);											
			}
			break;
		}
							
		case 'HitBTC': {			
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['id'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['baseCurrency']),
					'currency'	=> strtoupper($x['quoteCurrency'])
				);											
			}			
			break;
		}
							
		case 'Bitstamp' : {			
			foreach($json as $x){
				$t = explode('/', $x['name']);
				
				$marketsList[] = Array(
					'market' 	=> $x['url_symbol'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);											
			}
			break;
		}
							
		case 'bitFlyer' : {		
			foreach($json as $x){
				$t = explode('_', $x['product_code']);
				
				if (count($t) == 2){
					$marketsList[] = Array(
						'market' 	=> $x['product_code'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);	
				}
				else
				if (count($t) == 1){	
					if (strpos($t[0], 'BTCJPY') === 0){
						$marketsList[] = Array(
							'market' 	=> $x['product_code'],
							'type'		=> 'FUT',
							'asset'		=> 'BTC',
							'currency'	=> 'JPY'
						);	
					}
				}
			}
			break;
		}
							
		case 'Kraken': {
			if (empty($json['error']) && !empty($json['result'])){
				$xMaps = Array(); // https://api.kraken.com/0/public/Assets
				$tmp = file_get_contents($ex['apiURI']['assets']);
				
				if (!empty($tmp)){
					$tmp = json_decode($tmp, true);
					
					if (!empty($tmp) && empty($tmp['error']) && !empty($tmp['result'])){
						foreach($tmp['result'] as $ix => $iy){
							$xMaps[ $ix ] = $iy['altname'];
						}
					}
				}
				else
					break;
				
				foreach($json['result'] as $m => $x){
					if (strpos($m, '.d') !== false) continue;
					// игнорируем там где левередж
					if (!empty($x['leverage_buy']) || !empty($x['leverage_sell'])) continue;
					
					$cur = $xMaps[$x['quote']];
					$ass = $xMaps[$x['base']];
					
					if ($ass == 'XBT') $ass = 'BTC';
					if ($cur == 'XBT') $cur = 'BTC';
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($ass),
						'currency'	=> strtoupper($cur)
					);										
				}								
			}			
			break;
		}
							
		case 'OKEx/Spot' : {			
			foreach($json as $x){
				$t = explode('_', $x);
				
				$marketsList[] = Array(
					'market' 	=> $x,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);											
			}
			break;
		}							
							
		case 'Huobi' : {
			if ($json['status'] == 'ok' && !empty($json['data'])){
				foreach($json['data'] as $x){
					$marketsList[] = Array(
						'market' 	=> $x['base-currency'] . $x['quote-currency'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['base-currency']),
						'currency'	=> strtoupper($x['quote-currency'])
					);	
				}								
			}								
			break;
		}
							
		case 'Gemini' : {								
			foreach($json as $x){
				$m = parseTradingPair( $x );
				
				if (!empty($m)){
					$a = explode('/', $m);
					
					$marketsList[] = Array(
						'market' 	=> $x,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);
				}
			}
			break;								
		}
							
		case 'BTCCUSDExchange' : {			
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x,
					'type'		=> 'CUR',
					'asset'		=> 'BTC',
					'currency'	=> 'USD'
				);	
			}								
			break;
		}							
							
		case 'LakeBTC' : {
			foreach($json as $m => $x){				
				$t = parseTradingPair( $m );
				
				if (!empty($t)){
					$a = explode('/', $t);
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);
				}
			}	
			break;
		}
							
		case 'Korbit' : {			
			foreach($json as $x){
				$m = explode('_', $x);										
				
				$marketsList[] = Array(
					'market' 	=> $x,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);	
			}			
			break;
		}
							
		case 'ZB' : {			
			foreach($json as $m => $x){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}			
			break;
		}
							
		case 'EXX' : {		
			foreach($json as $m => $x){
				if ($x['isOpen'] != true) continue;
				
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}										
			break;
		}
							
		case 'Zaif' : {			
			foreach($json as $x){
				$t = explode('/', $x['name']);
				$t[0] = str_replace('ERC20.','', $t[0]);
				$t[1] = str_replace('ERC20.','', $t[1]);
				
				$marketsList[] = Array(
					'market' 	=> $x['currency_pair'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}				
			break;
		}
			
		case 'Bit-Z' : {
			if ($json['code'] == 0 && $json['msg'] == 'Success'){
				foreach($json['data'] as $m => $x){
					$t = explode('_', $m);
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);	
				}	
			}		
			break;
		}
							
		case 'Fisco' : {			
			foreach($json as $m){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}										
			break;
		}
							
		case 'Exmo' : {			
			foreach($json as $m => $x){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}											
			break;								
		}							
							
		case 'CoinsBank' : {			
			foreach($json as $m){
				$t = explode('/', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $t[0] . $t[1],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}											
			break;
		}
							
		case 'BTC Markets' : {			
			foreach($json as $m){
				$t = explode('/', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}							
			break;
		}
		
		case 'BTCBOX' : {
			
			foreach($json as $m){
				$t = explode('/', $m);										
				
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}							
			break;
		}
							
		case 'Gate.io' : {			
			foreach($json as $m){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}										
			break;
		}
							
		case 'Lbank' : {			
			foreach($json as $m){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}									
			break;
		}
							
		case 'Bitcoin Indonesia' : {			
			foreach($json as $m){
				$t = explode('/', $m);										
				
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0] . '_' . $t[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}									
			break;
		}
							
		case 'Coinnest' : {		
			foreach($json as $m){
				$t = explode('_', $m);										
				
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}									
			break;
		}
							
		case 'YoBit.Net' : {
			if (!empty($json['pairs'])){
				foreach($json['pairs'] as $m => $x){
					if ($x['hidden'] == 1) continue;
					
					$t = explode('_', $m);	

					$cur = strtoupper($t[1]);
					
					if ($cur == 'RUR') $cur = 'RUB';
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> $cur
					);	
				}	
			}								
			break;
		}
							
		case 'BitBay' : {			
			foreach($json as $m){
				$t = explode('/', $m);										
				
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0] . $t[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'Liqui' : {
			if (!empty($json['pairs'])){
				foreach($json['pairs'] as $m => $x){
					if ($x['hidden'] != 0) continue;
					
					$t = explode('_', $m);										
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);	
				}	
			}								
			break;
		}
							
		case 'ACX' : {			
			foreach($json as $x){
				
				$marketsList[] = Array(
					'market' 	=> $x['id'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base_unit']),
					'currency'	=> strtoupper($x['quote_unit'])
				);	
			}									
			break;
		}
							
		case 'Cryptopia' : {
			if (!empty($json['Data']) && $json['Success'] == true && empty($json['Error'])){
				foreach($json['Data'] as $x){
					$m = str_replace('/','_', $x['Label']);
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['Symbol']),
						'currency'	=> strtoupper($x['BaseSymbol'])
					);	
				}	
			}								
			break;
		}
							
		case 'Luno' : {
			if (!empty($json['tickers'])){
				foreach($json['tickers'] as $x){
					$m = parseTradingPair( $x['pair'] );
					
					if (!empty($m)){
						$a = explode('/', $m);
						
						$marketsList[] = Array(
							'market' 	=> $x['pair'],
							'type'		=> 'CUR',
							'asset'		=> strtoupper($a[0]),
							'currency'	=> strtoupper($a[1])
						);
					}
				}	
			}	
											
			break;
		}
							
		case 'QuadrigaCX' : {	
			foreach($json as $m){
				$t = explode('_', $m);			
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}						
			break;
		}
							
		case 'Mercado Bitcoin' : {			
			foreach($json as $m){
				$t = explode('/', $m);
				
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'Paribu' : {			
			foreach($json as $m){
				$t = explode('_', $m);
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}					
			break;
		}
							
		case 'Livecoin' : {			
			foreach($json as $x){
				$m = $x['symbol']; 
				$t = explode('/', $m); 
				
				$cur = strtoupper($t[1]);
				
				if ($cur == 'RUR') $cur = 'RUB';
				
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> $cur
				);	
			}									
			break;
		}
							
		case 'BX Thailand' : {			
			foreach($json as $x){
				$m = $x['pairing_id']; 
														
				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['secondary_currency']),
					'currency'	=> strtoupper($x['primary_currency'])
				);	
			}								
			break;
		}
							
		case 'Tidex' : {
			if (!empty($json['pairs'])){
				foreach($json['pairs'] as $m => $x){
					if ($x['hidden'] != 0) continue;
					
					$t = explode('_', $m);
					
					$cur = strtoupper($t[1]);
					
					if ($cur == 'WUSD') $cur = 'USD';
					if ($cur == 'WEUR') $cur = 'EUR';
															
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> $cur
					);	
				}	
			}								
			break;
		}
							
		case 'BTCTurk' : {
			foreach($json as $x){
				$m = parseTradingPair( $x['pair'] );
					
				if (!empty($m)){
					$a = explode('/', $m);
				
					$marketsList[] = Array(
						'market' 	=> $x['pair'],
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);	
				}	
			}						
			break;
		}
							
		case 'itBit' : {
			foreach($json as $x){
				$m = str_replace('/','', $x);
				$t = explode('/', $x);

				$marketsList[] = Array(
					'market' 	=> $m,
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}	
									
			break;
		}
							
		case 'CoinEgg' : {
			foreach($json as $m){
				$t = explode('_', $m);
				
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
				
			}
			break;
		}
							
		case 'AEX' : {
			foreach($json as $m){
				$t = explode('/', $m);
				
				$mk_type = $t[1];
				
				if ($mk_type == 'CNY')
					$mk_type = 'BitCNY';
				
				if ($mk_type == 'USD')
					$mk_type = 'BitUSD';
				
				$marketsList[] = Array(
					'market' 	=> 'c='.strtolower($t[0]).'&mk_type=' . strtolower($mk_type),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);									
			}
			break;
		}
							
		case 'Bitso' : {
			if ($json['success'] == true && !empty($json['payload'])){
				foreach($json['payload'] as $x){
					$m = $x['book'];
					$t = explode('_', $m);
					
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);	
				}
			}
			break;
		}
							
		case 'GetBTC' : {
			foreach($json as $m){
				$t = explode('/', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[1]),	//на этой бирже вот так ) 
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}
			
			break;
		}
							
		case 'OkCoin/Intl' : {
			foreach($json as $m){
				$t = explode('_', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'Coinfloor' : {
			foreach($json as $m){
				$t = explode('/', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtoupper($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'Bitbank' : {
			foreach($json as $m){
				$t = explode('_', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
		
		case 'Independent Reserve' : {
			foreach($json as $m){
				$t = explode('/', $m);
				$z = $t;
				
				if ($z[0] == 'XBT') $z[0] = 'BTC';
				if ($z[1] == 'XBT') $z[1] = 'BTC';
					
				$marketsList[] = Array(
					'market' 	=> 'primaryCurrencyCode='.strtolower($t[0]).'&secondaryCurrencyCode='.strtolower($t[1]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($z[0]),
					'currency'	=> strtoupper($z[1])
				);	
			}								
			break;
		}
							
		case 'Kucoin' : {
			if ($json['success'] == true && $json['code'] == 'OK' && !empty($json['data'])){
				foreach($json['data'] as $x){
					if ($x['trading'] == true){
						$m = $x['symbol'];
						
						$marketsList[] = Array(
							'market' 	=> $m,	
							'type'		=> 'CUR',
							'asset'		=> strtoupper($x['coinType']),
							'currency'	=> strtoupper($x['coinTypePair'])
						);
					}
				}
			}
			break;
		}
				
		case 'BitMarket' : {
			foreach($json as $m){
				$t = explode('/', $m);
				
				$marketsList[] = Array(
						'market' 	=> $t[0] . $t[1],	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'Gatecoin' : {
			if (!empty($json['responseStatus']) && $json['responseStatus']['message'] == "OK" && !empty($json['tickers'])){
				
				foreach($json['tickers'] as $x){
					$z = $x['currencyPair'];
					$m = parseTradingPair( $z );

					if (!empty($m)){
						$a = explode('/', $m);
						
						$marketsList[] = Array(
							'market' 	=> $z,
							'type'		=> 'CUR',
							'asset'		=> strtoupper($a[0]),
							'currency'	=> strtoupper($a[1])
						);					
					}
				}								
			}
			break;
		}
							
		case 'BL3P' : {
			foreach($json as $m){
				$t = explode('/', $m);
			
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0] . $t[1]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'AidosMarket' : {
			foreach($json as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> 'market='.strtolower($m[0]).'&currency='.strtolower($m[1]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}									
			break;
		}							
							
		case 'CoinFalcon' : {
			foreach($json as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> $m[0] . '-'.$m[1],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}									
			break;
		}					
							
		case 'Negocie Coins' : {
			foreach($json as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0] . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}								
			break;
		}
							
		case 'Coinroom' : {
			$xz = Array();
			
			foreach($json['crypto'] as $m){
				foreach($json['real'] as $r){
					$xz[] = $m . '/' . $r;
				}
			}
											
			foreach($xz as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> 'realCurrency='.strtoupper($m[1]).'&cryptoCurrency='.strtoupper($m[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}								
			break;
		}
							
		case 'The Rock Trading' : {
			if (!empty($json['funds'])){
				foreach($json['funds'] as $x){
					$marketsList[] = Array(
						'market' 	=> strtoupper($x['id']),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['trade_currency']),
						'currency'	=> strtoupper($x['base_currency'])
					);
				}
			}								
			break;
		}					
							
		case 'BitGrail' : {
			if ($json['success'] == 1 && !empty($json['response'])){
				$xz = Array();
				
				foreach($json['response'] as $y => $x){
					foreach($x as $r){
						$xz[] = $r['market'];
					}
				}
				
				foreach($xz as $x){
					$m = explode('/', $x);
					//маркет в запросе указываеться наоборот 
					$marketsList[] = Array(
						'market' 	=> strtoupper($m[1] . '-' . $m[0]),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($m[0]),
						'currency'	=> strtoupper($m[1])
					);
				}									
			}
			break;
		}
							
		case 'Allcoin' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0] .'_'. $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'CoolCoin' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'Coinrail' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0].'-'.$m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
									
		case 'Hypex' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0].'_'.$m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'BitcoinToYou' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0].'_'.$m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'BitcoinTrade' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtoupper($m[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'Waves DEX' : {
			foreach($json as $x){
				if (empty($x['symbol'])) continue;
				
				$m = explode('/', $x['symbol']);
						
				$marketsList[] = Array(
					'market' 	=> strtoupper($x['symbol']),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}	
			break;
		}
							
		case 'GOPAX' : {
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['name'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['baseAsset']),
					'currency'	=> strtoupper($x['quoteAsset'])
				);
			}	
			break;
		}
							
		case 'Abucoins' : {
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['id'],
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base_currency']),
					'currency'	=> strtoupper($x['quote_currency'])
				);
			}	
			break;
		}
							
		case 'C-CEX' : {
			if ($json['success'] == true && !empty($json['result'])){
				foreach($json['result'] as $x){
					if ($x['IsActive'] != true) continue;
					
					$marketsList[] = Array(
						'market' 	=> strtolower($x['MarketName']),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['MarketCurrency']),
						'currency'	=> strtoupper($x['BaseCurrency'])
					);
				}
			}
			break;
		}
							
		case 'Bit2C' : {
			foreach($json as $x){
				$m = explode('/', $x);	
				
				$marketsList[] = Array(
					'market' 	=> strtoupper($m[0] . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}
			break;
		}					
							
		case 'Qryptos' : {
			foreach($json as $x){
				if ($x['disabled'] == false && $x['product_type'] == 'CurrencyPair'){
					$m = $x['id'];
						
					$marketsList[] = Array(
						'market' 	=> $m,
						'type'		=> 'CUR',
						'pair'		=> $x['currency_pair_code'],
						'asset'		=> strtoupper($x['base_currency']),
						'currency'	=> strtoupper($x['quoted_currency'])
					);											
				}
			}
			break;
		}
							
		case 'CoinMate' : {
			foreach($json as $x){
				$m = explode('/', $x);
						
				$marketsList[] = Array(
					'market' 	=> strtoupper($m[0] . '_' . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);											
			}
			break;
		}
							
		case 'Bitsane' : {
			foreach($json as $m => $x){
				$marketsList[] = Array(
					'market' 	=> strtoupper($m),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base']),
					'currency'	=> strtoupper($x['quote'])
				);											
			}
			break;
		}
							
		case 'Braziliex' : {
			foreach($json as $x){
				if ($x['active'] != 1) continue;
				
				$m = explode('_', $x['market']);
				
				$marketsList[] = Array(
					'market' 	=> strtolower($x['market']),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);											
			}
			break;
		}
							
		case 'Bittylicious' : {
			foreach($json as $x){
				$m = explode('/', $x);
				//торговые пары указываються наоброт
				$marketsList[] = Array(
					'market' 	=> strtoupper($m[1] . '/'. $m[0]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[1]),
					'currency'	=> strtoupper($m[0])
				);											
			}
			break;
		}
							
		case 'Bleutrade' : {
			if ($json['success'] == 'true' && !empty($json['result'])){
				foreach($json['result'] as $x){
					if ($x['IsActive'] != 'true') continue;
					
					$m = $x['MarketName'];
					
					$marketsList[] = Array(
						'market' 	=> strtoupper($m),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['MarketCurrency']),
						'currency'	=> strtoupper($x['BaseCurrency'])
					);											
				}
			}
			break;
		}
							
		case 'Bitex.la' : {
			foreach($json as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0] . '_' . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);											
			}
			break;
		}
							
		case 'Nevbit' : {
			foreach($json as $x){
				$m = explode('/', $x);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m[0] . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);											
			}
			break;
		}
							
		case 'Bitlish' : {
			foreach($json as $x){
				$m = $x['id'];
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['item_id']),
					'currency'	=> strtoupper($x['currency_id'])
				);											
			}
			break;
		}
							
		case 'Stocks.Exchange' : {
			break;
		}
		
		case 'Stellar Decentralized Exchange': {
			break;
		}
							
		case 'ETHEXIndia' : {
			foreach($json as $x){
				$m = explode('/', $x);
				
				$marketsList[] = Array(
					'market' 	=> strtoupper($x),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);											
			}
			break;
		}
							
		case 'Nocks' : {
			if ($json['status'] == 200 && !empty($json['data'])){
				foreach($json['data'] as $x){
					if ($x['is_active'] != true) continue;
					
					$m = $x['code'];
					$t = explode('-', $m);
					
					$marketsList[] = Array(
						'market' 	=> strtoupper($m),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);
				}
			}
			break;
		}
							
		case 'CryptoMarket' : {
			if ($json['status'] == 'success' && !empty($json['data'])){
				foreach($json['data'] as $t){
					
					$m = parseTradingPair( $t );

					if (!empty($m)){
						$a = explode('/', $m);
						
						$marketsList[] = Array(
							'market' 	=> $t,
							'type'		=> 'CUR',
							'asset'		=> strtoupper($a[0]),
							'currency'	=> strtoupper($a[1])
						);					
					}
				}
			}
			break;
		}
							
		case 'ezBtc' : {
			foreach($json as $x){
				$m = explode('/', $x);
				$t = $m[0] . $m[1];
				
				if ($m[0] == 'XBT')	$m[0] = 'BTC';
				if ($m[1] == 'XBT')	$m[1] = 'BTC';
					
				$marketsList[] = Array(
					'market' 	=> strtolower($t),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}
			break;
		}
							
		case 'Tux Exchange' : {
			foreach($json as $m => $x){
				if ($x['isFrozen'] != 0) continue;
				
				$t = explode('_', $m);
														
				$marketsList[] = Array(
					'market' 	=> strtoupper($m),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'BitFlip' : {
			//с ними сложно, надо поддержка POST
			foreach($json[1] as $x){
				if (empty($x)) continue;
				if ($x['enabled'] != true) continue;
				
				$t = explode(':', $x['pair']);
														
				$marketsList[] = Array(
					'market' 	=> strtolower($x['pair']),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'Cryptox': {
			foreach($json as $x){
				$t = explode('/', $x);
														
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0] . $t[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'Bitmaszyna' : {
			foreach($json as $x){
				$t = explode('/', $x);
														
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0] . $t[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'SouthXchange' : {
			foreach($json as $t){
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0] . '/' . $t[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);
			}
			break;
		}
							
		case 'Trade Satoshi' : {
			if ($json['success'] == true && $json['message'] == null){
				foreach($json['result'] as $x){
					$m = $x['market'];
					$t = explode('_', $m);
					
					$marketsList[] = Array(
						'market' 	=> strtoupper($m),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);
				}
			}
			break;
		}
							
		case 'Novaexchange' : {
			if ($json['status'] == 'success' && !empty($json['markets'])){
				foreach($json['markets'] as $x){
					if ($x['disabled'] == 0) continue; //странное обозначение 
					
					$m = $x['marketname'];
															
					$marketsList[] = Array(
						'market' 	=> strtoupper($m),
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['currency']),
						'currency'	=> strtoupper($x['basecurrency'])
					);
				}
			}
			break;
		}
							
		case 'Bisq': {
			foreach($json as $x){
				$m = $x['pair'];
				
				$marketsList[] = Array(
					'market' 	=> strtolower($m),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['lsymbol']),
					'currency'	=> strtoupper($x['rsymbol'])
				);
			}
			break;
		}
							
		case 'Dgtmarket' : {
			foreach($json as $x){
				$m = explode('/', $x);
				
				$marketsList[] = Array(
					'market' 	=> strtoupper($m[0] . $m[1]),
					'type'		=> 'CUR',
					'asset'		=> strtoupper($m[0]),
					'currency'	=> strtoupper($m[1])
				);
			}
			break;
		}						
							
		case 'OKCoin/CNY' : {
			foreach($json as $m){
				$t = explode('_', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'Coingi' : {
			foreach($json as $m){
				$t = explode('/', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($t[0] . '-' . $t[1]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'ISX' : {
			foreach($json as $m){
				$t = explode('/', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtolower('market='.$t[0].'&currency='.$t[1]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}							
							
		case 'FreiExchange' : {
			foreach($json as $m => $x){
				$t = explode('_', $m);
					
				$marketsList[] = Array(
					'market' 	=> strtoupper($t[0]),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}
							
		case 'CryptoDerivatives' : {
			if (!empty($json['records'])){
				foreach($json['records'] as $x){
					$t = explode('/', $x['pair']);
						
					$marketsList[] = Array(
						'market' 	=> strtoupper($t[0]),	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($t[0]),
						'currency'	=> strtoupper($t[1])
					);	
				}
			}								
			break;
		}							
							
		case 'Ore.Bz' : {
			foreach($json as $x){
				$m = $x['id'];
				$t = explode('/', $x['name']);
					
				$marketsList[] = Array(
					'market' 	=> strtolower($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($t[0]),
					'currency'	=> strtoupper($t[1])
				);	
			}								
			break;
		}							
							
		case 'LEOxChange' : {
			if ($json['Success'] == true && !empty($json['Data'])){
				foreach($json['Data'] as $x){
					if ($x['IsEnabled'] != true) continue;
																
					$marketsList[] = Array(
						'market' 	=> strtoupper($x['Symbol']),	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['PCoinName']),
						'currency'	=> strtoupper($x['SCoinName'])
					);	
				}
			}								
			break;
		}
							
		case 'DSX' : {
			foreach($json['pairs'] as $t => $x){
				$m = parseTradingPair( $t );

				if (!empty($m)){
					$a = explode('/', $m);
					
					$marketsList[] = Array(
						'market' 	=> strtolower($t),	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);				
				}	
			}	
			break;
		}
		
		case 'Cobinhood' : {
			if ($json['success'] == true && !empty($json['result']) && !empty($json['result']['trading_pairs'])){
				foreach($json['result']['trading_pairs'] as $x){
					$a = explode('-', $x['id']);
					
					$marketsList[] = Array(
						'market' 	=> $x['id'],	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['base_currency_id']),
						'currency'	=> strtoupper($x['quote_currency_id'])
					);
				}			
			}
			break;
		}
		
		case 'Anybits' : {
			foreach($json as $m => $x){
				$marketsList[] = Array(
					'market' 	=> strtoupper($m),	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base']),
					'currency'	=> strtoupper($x['quote'])
				);
			}
			break;
		}
		
		//==============
		case 'FCoin' : {
			if ($json['status'] == 0 && !empty($json['data'])){
				foreach($json['data'] as $x){
					$marketsList[] = Array(
						'market' 	=> $x['name'],	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['base_currency']),
						'currency'	=> strtoupper($x['quote_currency'])
					);
				}
			}
			break;
		}
		case 'CoinEx' : {
			if ($json['status'] == 1 && !empty($json['combinations'])){
				foreach($json['combinations'] as $x){
					$a = explode('_', $x);
					
					$marketsList[] = Array(
						'market' 	=> $x,	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($a[0]),
						'currency'	=> strtoupper($a[1])
					);
				}
			}
			break;
		}
		case 'BigONE' : {
			foreach($json['data'] as $x){
				$a = explode('-', $x['market_id']);
					
				$marketsList[] = Array(
					'market' 	=> $x['market_id'],	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($a[0]),
					'currency'	=> strtoupper($a[1])
				);
			}
			break;
		}
		case 'CoinbasePro' : {
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['id'],	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['base_currency']),
					'currency'	=> strtoupper($x['quote_currency'])
				);
			}
			break;
		}
		case 'RightBTC' : {
			if (!empty($json['status']) && $json['status']['success'] == 1){
				foreach($json['status']['message'] as $x){
					$marketsList[] = Array(
						'market' 	=> $x['name'],	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['bid_asset_symbol']),
						'currency'	=> strtoupper($x['ask_asset_symbol'])
					);
				}
			}
			break;
		}
		case 'BitMart' : {
			foreach($json as $x){
				$marketsList[] = Array(
					'market' 	=> $x['symbolId'],	
					'type'		=> 'CUR',
					'asset'		=> strtoupper($x['coinName']),
					'currency'	=> strtoupper($x['anchorName'])
				);
			}
			break;
		}
		case 'ChaoEX' : {
			if ($json['status'] == 200 && !empty($json['attachment'])){
				foreach($json['attachment'] as $x){
					$marketsList[] = Array(
						'market' 	=> 'baseCurrencyId='.$x['baseCurrencyId'].'&tradeCurrencyId='.$x['tradeCurrencyId'],	
						'type'		=> 'CUR',
						'asset'		=> strtoupper($x['baseCurrencyNameEn']),
						'currency'	=> strtoupper($x['tradeCurrencyNameEn'])
					);
				}
			}
			break;
		}
		
		
		
		
		
		
		//==============
		case 'CoinBene';
		case 'CoinTiger';					
		case 'Heat Wallet';
		case 'DC-Ex';
		case 'Coinrate';
		case 'Tripe Dice Exchange';
		case 'InfinityCoin';
		case 'CryptoMate';
		case 'TCC Exchange';
		case 'GuldenTrader';
		case 'OKEx/Futures';
		case 'BTCChina';
		case 'Neraex'; 	//таймаут соединения
		case 'Koinim';
		case 'Exrates';
		case 'CoinExchange';
		case 'BigONE';
		case 'Koineks';
		case 'Mercatox';
		case 'AltCoinTrader';
		case 'Gatehub';
		case 'LiteBit';
		case 'The Rock Trading';
		case 'TOPBTC';
		case 'Lykke Exchange';
		case 'Coinut';
		case 'TDAX';
		case 'LocalTrade';
		case 'OEX';
		case 'Mr. Exchange';
		case 'COSS';
		case 'Counterparty DEX';
		case 'Burst Asset Exchange';							
		case 'NIX-E';							
		case 'CoinCorner';							
		case 'Omni DEX';							
		case 'ExcambrioRex';							
		case 'VirtacoinWorld';							
		case 'BITHOLIC';							
		case 'BitKonan';
		case 'OasisDEX';
		case 'Rippex';
		case 'BCEX';
		case 'Token Store';
		case 'InfinityCoin Exchange';
		case 'CryptoBridge';
		case 'Coinsecure';
		case 'BtcTrade.im';
		case 'Altcoin Trader';
		case 'ChaoEX';
		case 'BarterDEX';
		
		default: 
			break;
	}
	
	return $marketsList;
}

//запись в SSDB log
function logOriginalData($exName = null, $pair = null, $body = null, $ssdb = null){
	return true;
	
	if (empty($exName) || empty($body) || empty($ssdb)) return null;
	
	try{
		$result = $ssdb->qpush_front('DTP:GlobalCache:' . $exName . ':' . $pair, $body);
	}catch(Exception $e){
		die('Exception: ' . $e->getMessage());
	}
	
	if ($result === false)
		die('SSDB error');
	else
		return true;
}

function getTradeTpl($market = Array()){
	return Array(
		'id' 		=> null,
		'ts'		=> 0,
		'symbol'	=> $market['asset'] . '/' . $market['currency'],
		'asset'		=> $market['asset'],
		'cur'		=> $market['currency'],
		'type'		=> $market['type'],
		'side'		=> '',
		'price'		=> 0,
		'amount'	=> 0,
		'total'		=> 0,
		'_org'		=> '' //временное хранение оригинального кода 
	);
}

//расчет хеша 
function calcHash($t = Array()){
	return md5( json_encode($t) );
	//return md5( implode(';', array_values($t)) );
}

function tradeSort($tA, $tB){
	if ($tA['ts'] == $tB['ts']){
		//todo: учесть если возможно, сортировку по трейд-ид
		if (is_numeric($tA['id']) && is_numeric($tB['id'])){
			return floatval($tA['id']) > floatval($tB['id']) ? 1 : -1;
		}
		
		return 0;
	} 
	return $tA['ts'] > $tB['ts'] ? 1 : -1;
}

function postProcessTrades($tradesList = Array()){
	//фильтр на пустые элементы 
	$_t = array_filter($tradesList, function($element) {
		return !empty($element);
	});
		
	usort($_t, 'tradeSort');
	
	return $_t;
}

//фильтрация перед добавлением 
function postFilterTrade( $t = Array() ){
	if (empty($t)) return null;
	if (empty($t['amount'])) return null;
	if (empty($t['ts'])) return null;
	if (empty($t['price'])) return null;
	if (empty($t['total'])) return null;
	if (empty($t['_hash'])) return null;
	
	return $t;
}

//парсинг даты для BTC-trade.ua 
function parseDateFormat($dtstr = null){
	// 15 января 2018 г. 16:49:53
	$t = explode(' ', $dtstr);
	
	$mm = Array('января' => '01', 'февраля' => '02', 'марта' => '03', 'апреля' => '04', 'мая' => '05', 
		'июня' => '06', 'июля' => '07', 'августа' => '08', 'сентября' => '09', 'октября' => '10', 'ноября' => '11', 'декабря' => '12');
		
	$d = $t[0];
		$t[1] = trim($t[1]);
	$m = $mm[ $t[1] ];
	$y = $t[2];
	$hhmmss = $t[ count($t)-1 ];
	
	return strtotime($d.'.'.$m.'.'.$y.' ' . $hhmmss.'+00:00');
}

//нормализация валютных пар, которые нельзя распарсить 
// Need: Bitfinex, (r)Ethfinex, (r)Gemini, (r)LakeBTC, (r)Luno, (r)BTCTurk, 
// Realisid: KUNA, Gatecoin, CryptoMarket, DSX
// Важно! здесь можно делать подстановки тикеров (XBT => BTC)
function parseTradingPair($originalPair = null){
	$originalPair = strtolower( $originalPair );
	$_pairs = Array(
		'btcuah'	=> 'BTC/UAH',
		'ethuah'	=> 'ETH/UAH',	
		'wavesuah'	=> 'WAVES/UAH',
		'kunbtc'	=> 'KUN/BTC',	
		'bchbtc'	=> 'BCH/BTC',	
		'gbguah'	=> 'GBG/UAH',
		'golgbg'	=> 'GOL/GBG',	
		'rmcbtc'	=> 'RMC/BTC',
		'rbtc'		=> 'R/BTC',
		'arnbtc'	=> 'ARN/BTC',
		'evrbtc'	=> 'EVR/BTC',
		'b2bbtc'	=> 'B2B/BTC',
		'bchuah'	=> 'BCH/UAH',
		'xrpuah'	=> 'XRP/UAH',
		'eosbtc'	=> 'EOS/BTC',
		'foodbtc'	=> 'FOOD/BTC',
		'otxbtc'	=> 'OTX/BTC',
		'hknbtc'	=> 'HKN/BTC',
		'xlmuah'	=> 'XLM/UAH',
		'tusduah'	=> 'TUSD/UAH',
		'ltcuah'	=> 'LTC/UAH',
		'eosuah'	=> 'EOS/UAH',
		'lrcusd'	=> 'LRC/USD',
		'lrcbtc'	=> 'LRC/BTC',
		'lrceth'	=> 'LRC/ETH',
		'ltcuah'	=> 'LTC/UAH',
		'dashuah'   => 'DASH/UAH',
		
		'rteeth' 	=> 'RTE/ETH',
		'rteusd'	=> 'RTE/USD',
		'mgousd'	=> 'MGO/USD',
		
		'rbtusd' 	=> 'RBT/USD',
		'rbtbtc'	=> 'RBT/BTC',
		'rbteth'	=> 'RBT/ETH',
		
		'gsdusd'	=> 'GSD/USD',
		'udcusd'	=> 'UDC/USD',
		'tsdusd'	=> 'TSD/USD',
		'paxusd'	=> 'PAX/USD',
		'ustusd'	=> 'UST/USD',
		
		'boxeth'	=> 'BOX/ETH',
		'boxusd'	=> 'BOX/USD',
		'cnneth'	=> 'CNN/ETH',
		'cnnusd'	=> 'CNN/USD',
		
		'omnusd' 	=> 'OMN/USD',
		'omnbtc'	=> 'OMN/BTC',
		
		'bsvusd' 	=> 'BSV/USD',
		'bsvbtc'	=> 'BSV/BTC',
		'babusd'	=> 'BAB/USD',
		'babbtc'	=> 'BAB/BTC',
		
		'wlousd'	=> 'WLO/USD',
		'wloxlm'	=> 'WLO/XLM',
		'vldusd'	=> 'VLD/USD',
		'vldeth'	=> 'VLD/ETH',
		'enjusd'	=> 'ENJ/USD',
		'enjeth'	=> 'ENJ/ETH',
		'onlusd'	=> 'ONL/USD',
		'onleth'	=> 'ONL/ETH',		
		
		'trxjpy'	=> 'TRX/JPY',
		'trxgbp'	=> 'TRX/GBP',
		'trxeur'	=> 'TRX/EUR',
		
		'intusd'	=> 'INT/USD',
		'inteth'	=> 'INT/ETH',
		'drnusd'	=> 'DRN/USD',
		'drneth'	=> 'DRN/ETH',
		'pnkusd'	=> 'PNK/USD',
		'pnketh'	=> 'PNK/ETH',
		
		
		
		'ethbtc' 	=> 'ETH/BTC',
		'eosbtc'	=> 'EOS/BTC',
		
		'antusd'	=> 'ANT/USD',
		'antbtc'	=> 'ANT/BTC',
		'anteth'	=> 'ANT/ETH',
		
		'mitusd'	=> 'MITH/USD',
		'mitbtc'	=> 'MITH/BTC',
		'miteth'	=> 'MITH/ETH',
		
		'mlnusd'	=> 'MLN/USD',
		'mlneth'	=> 'MLN/ETH',
		'wtcusd'	=> 'WTC/USD',
		'wtceth'	=> 'WTC/ETH',
		'csxusd'	=> 'CSX/USD',
		'csxeth'	=> 'CSX/ETH',
		
		'manusd'	=> 'MAN/USD',
		'manbtc'	=> 'MAN/BTC',
		'maneth'	=> 'MAN/ETH',
		
		'xrausd'	=> 'XRA/USD',
		'xrabtc'	=> 'XRA/BTC',
		'xraeth'	=> 'XRA/ETH',
		
		'absusd'	=> 'ABS/USD',
		'absbtc'	=> 'ABS/BTC',
		'abseth'	=> 'ABS/ETH',
		
		
		'dthusd'	=> 'DTH/USD',
		'dthbtc'	=> 'DTH/BTC',
		'dtheth'	=> 'DTH/ETH',
		
		'venusd'	=> 'VEN/USD',
		'venbtc'	=> 'VEN/BTC',
		'veneth'	=> 'VEN/ETH',
		
		'iqxusd'	=> 'IQX/USD',
		'iqxbtc'	=> 'IQX/BTC',
		'iqxeos'	=> 'IQX/EOS', 
		
		'stjusd'	=> 'STORJ/USD',
		'stjbtc'	=> 'STORJ/BTC',
		'stjeth'	=> 'STORJ/ETH',
		
		'xlmusd' 	=> 'XLM/USD',
		'xlmeur'	=> 'XLM/EUR',
		'xlmjpy'	=> 'XLM/JPY',
		'xlmgbp'	=> 'XLM/GBP',
		'xlmbtc'	=> 'XLM/BTC',
		'xlmeth'	=> 'XLM/ETH',
		
		'xvgusd'	=> 'XVG/USD',
		'xvgeur'	=> 'XVG/EUR',
		'xvgjpy'	=> 'XVG/JPY',
		'xvggbp'	=> 'XVG/GBP',
		'xvgbtc'	=> 'XVG/BTC',
		'xvgeth'	=> 'XVG/ETH',
		
		
		'waxusd'	=> 'WAX/USD',
		'waxbtc'	=> 'WAX/BTC',
		'waxeth'	=> 'WAX/ETH',
		'daibtc'	=> 'DAI/BTC',
		'daieth'	=> 'DAI/ETH',
		'cfiusd'	=> 'CFI/USD',
		'cfibtc'	=> 'CFI/BTC',
		'cfieth'	=> 'CFI/ETH',
		'agiusd'	=> 'AGI/USD',
		'agibtc'	=> 'AGI/BTC',
		'agieth'	=> 'AGI/ETH',
		'bftusd'	=> 'BFT/USD',
		'bftbtc'	=> 'BFT/BTC',
		'bfteth'	=> 'BFT/ETH',
		'mtnusd'	=> 'MTN/USD',
		'mtnbtc'	=> 'MTN/BTC',
		'mtneth'	=> 'MTN/ETH',
		'odeusd'	=> 'ODEM/USD',
		'odebtc'	=> 'ODEM/BTC',
		'odeeth'	=> 'ODEM/ETH',
		
		'iotgbp'	=> 'IOT/GBP',
		'iotjpy'	=> 'IOT/JPY',
		'eosgbp'	=> 'EOS/GBP',
		'eosjpy'	=> 'EOS/JPY',
		'eoseur'	=> 'EOS/EUR',
		'neogbp'	=> 'NEO/GBP',
		'neojpy'	=> 'NEO/JPY',
		'neoeur'	=> 'NEO/EUR',
		'ethjpy'	=> 'ETH/JPY',
		


		'iosusd'	=> 'IOST/USD',
		'iosbtc'	=> 'IOST/BTC',
		'ioseth'	=> 'IOST/ETH',
		'aiousd'	=> 'AION/USD',
		'aiobtc'	=> 'AION/BTC',
		'aioeth'	=> 'AION/ETH',
		'requsd'	=> 'REQ/USD',
		'reqbtc'	=> 'REQ/BTC',
		'reqeth'	=> 'REQ/ETH',
		'rdnusd'	=> 'RDN/USD',
		'rdnbtc'	=> 'RDN/BTC',
		'rdneth'	=> 'RDN/ETH',
		
		
		'ethusd'	=> 'ETH/USD',
		'btgeur'	=> 'BTG/EUR',
		'btcrub'	=> 'BTC/RUB',
		'etheur'	=> 'ETH/EUR',
		'ltcgbp'	=> 'LTC/GBP',
		'btcgbp'	=> 'BTC/GBP',
		'ltcbtc'	=> 'LTC/BTC',
		'btggbp'	=> 'BTG/GBP',
		'bccgbp'	=> 'BCC/GBP',
		'ethgbp'	=> 'ETH/GBP',
		'btgbtc'	=> 'BTG/BTC',
		'bccbtc'	=> 'BCC/BTC',
		'ethbtc'	=> 'ETH/BTC',
		'ltcusd'	=> 'LTC/USD',
		'bccusd'	=> 'BCC/USD',
		'btcusd'	=> 'BTC/USD',
		'ltceur'	=> 'LTC/EUR',
		'bcceur'	=> 'BCC/EUR',
		'btceur'	=> 'BTC/EUR',
		'btgusd'	=> 'BTG/USD',
		
		'ethclp'	=> 'ETH/CLP',
		'ethars' 	=> 'ETH/ARS',
		
		'btchkd'  	=> 'BTC/HKD',
		'repbtc'  	=> 'REP/BTC',
		'1stbtc' 	=> '1ST/BTC',
		'sngbtc'  	=> 'SNG/BTC',
		'gupbtc'  	=> 'GUP/BTC',
		'rlcbtc'  	=> 'RLC/BTC',
		'ethhkd'  	=> 'ETH/HKD',
		'sntbtc'  	=> 'SNT/BTC',
		'wgsbtc'  	=> 'WGS/BTC',
		'sngeth'  	=> 'SNG/ETH',
		'wgseth'  	=> 'WGS/ETH',
		'snteth'  	=> 'SNT/ETH',
		'adxbtc'  	=> 'ADX/BTC',
		'adxeth'  	=> 'ADX/ETH',
		'sltbtc'  	=> 'SLT/BTC',
		'slteth'  	=> 'SLT/ETH',
		'manbtc'  	=> 'MAN/BTC',
		'maneth'  	=> 'MAN/ETH',
		'mgobtc'  	=> 'MGO/BTC',
		'mgoeth'  	=> 'MGO/ETH',
		'zrxbtc'  	=> 'ZRX/BTC',
		'zrxeth'  	=> 'ZRX/ETH',
		'iftbtc'  	=> 'IFT/BTC',
		'ifteth'  	=> 'IFT/ETH',
		'avtbtc'  	=> 'AVT/BTC',
		'avteth'  	=> 'AVT/ETH',
		'indbtc'  	=> 'IND/BTC',
		'indeth'  	=> 'IND/ETH',
		'btcxjp'  	=> 'BTC/XJP',
		'pixeth'  	=> 'PIX/ETH',
		'pixbtc'  	=> 'PIX/BTC',
		'reabtc'  	=> 'REA/BTC',
		'reaeth'  	=> 'REA/ETH',
		'cdtbtc'  	=> 'CDT/BTC',
		'trxbtc'  	=> 'TRX/BTC',
		'trxeth'  	=> 'TRX/ETH',
		'cdteth'  	=> 'CDT/ETH',
		'ltcbtc'  	=> 'LTC/BTC',
		'asteth'  	=> 'AST/ETH',
		'ltceth'  	=> 'LTC/ETH',
		'astbtc'  	=> 'AST/BTC',
		'ltchkd'  	=> 'LTC/HKD',
		'flibtc'  	=> 'FLI/BTC',
		'flieth'  	=> 'FLI/ETH',
		'levbtc'  	=> 'LEV/BTC',
		'leveth'  	=> 'LEV/ETH',
		'bcpbtc'  	=> 'BCP/BTC',
		'bcpeth'  	=> 'BCP/ETH',
		'daiusd'  	=> 'DAI/USD',
		'ethdai'  	=> 'ETH/DAI',
		
		'vetusd'	=> 'VET/USD',
		'vetbtc'	=> 'VET/BTC',
		'veteth'	=> 'VET/ETH',
		
		'btctry'	=> 'BTC/TRY',
		'ethtry'	=> 'ETH/TRY',
		
		'xbtngn'    => 'BTC/NGN',
		'xbtzar'	=> 'BTC/ZAR',
		'xbtidr'	=> 'BTC/IDR',
		'xbtmyr'	=> 'BTC/MYR',
		
		'btcjpy'	=> 'BTC/JPY',
		'btcaud'	=> 'BTC/AUD',
		'btccad'	=> 'BTC/CAD',
		'btcsgd'	=> 'BTC/SGD',
		'btcchf'	=> 'BTC/CHF',
		'btcngn'	=> 'BTC/NGN',
		'baceth'	=> 'BAC/ETH',
		
		'btc_usdt' => 'BTC/USDT',
		'usdt_uah'	=> 'USDT/UAH',

		'eosusd'	=> 'EOS/USD',
		'eoseth'	=> 'EOS/ETH',
		'sanusd'	=> 'SAN/USD',
		'saneth'	=> 'SAN/ETH',
		'omgusd'	=> 'OMG/USD',
		'omgeth'	=> 'OMG/ETH',
		'avtusd'	=> 'AVT/USD',
		'avteth'	=> 'AVT/ETH',
		'edousd'	=> 'EDO/USD',
		'edoeth'	=> 'EDO/ETH',
		'datusd'	=> 'DAT/USD',
		'dateth'	=> 'DAT/ETH',
		'qshusd'	=> 'QSH/USD',
		'qsheth'	=> 'QSH/ETH',
		'yywusd'	=> 'YYW/USD',
		'yyweth'	=> 'YYW/ETH',
		'gntusd'	=> 'GNT/USD',
		'gnteth'	=> 'GNT/ETH',
		'sntusd'	=> 'SNT/USD',
		'snteth'	=> 'SNT/ETH',
		'batusd'	=> 'BAT/USD',
		'bateth'	=> 'BAT/ETH',
		'mnausd'	=> 'MNA/USD',
		'mnaeth'	=> 'MNA/ETH',
		'funusd'	=> 'FUN/USD',
		'funeth'	=> 'FUN/ETH',
		'zrxusd'	=> 'ZRX/USD',
		'zrxeth'	=> 'ZRX/ETH',
		'tnbusd'	=> 'TNB/USD',
		'tnbeth'	=> 'TNB/ETH',
		'spkusd'	=> 'SPK/USD',
		'spketh'	=> 'SPK/ETH',

		'etcbtc'	=> 'ETC/BTC',
		'etcusd'	=> 'ETC/USD',
		'rrtusd'	=> 'RRT/USD',
		'rrtbtc'	=> 'RRT/BTC',
		'zecusd'	=> 'ZEC/USD',
		'zecbtc'	=> 'ZEC/BTC',
		'xmrusd'	=> 'XMR/USD',
		'xmrbtc'	=> 'XMR/BTC',
		'dshusd'	=> 'DASH/USD',
		'dshbtc'	=> 'DASH/BTC',

		'xrpusd'	=> 'XRP/USD',
		'xrpbtc'	=> 'XRP/BTC',
		'iotusd'	=> 'IOTA/USD',
		'iotbtc'	=> 'IOTA/BTC',
		'ioteth'	=> 'IOTA/ETH',

		'eosbtc'	=> 'EOS/BTC',
		'sanbtc'	=> 'SAN/BTC',
		'omgbtc'	=> 'OMG/BTC',
		'bchusd'	=> 'BCH/USD',
		'bcheth'	=> 'BCH/ETH',
		'neousd'	=> 'NEO/USD',
		'neobtc'	=> 'NEO/BTC',
		'neoeth'	=> 'NEO/ETH',
		'etpusd'	=> 'ETP/USD',
		'etpbtc'	=> 'ETP/BTC',
		'etpeth'	=> 'ETP/ETH',
		'qtmusd'	=> 'QTUM/USD',
		'qtmbtc'	=> 'QTUM/BTC',
		'qtmeth'	=> 'QTUM/ETH',
		'avtbtc'	=> 'AVT/BTC',
		'edobtc'	=> 'EDO/BTC',
		'datbtc'	=> 'DAT/BTC',
		'qshbtc'	=> 'QSH/BTC',
		'yywbtc'	=> 'YYW/BTC',
		'gntbtc'	=> 'GNT/BTC',
		'sntbtc'	=> 'SNT/BTC',
		'ioteur'	=> 'IOT/EUR',
		'batbtc'	=> 'BAT/BTC',
		'mnabtc'	=> 'MNA/BTC',
		'funbtc'	=> 'FUN/BTC',
		'tnbbtc'	=> 'TNB/BTC',
		'spkbtc'	=> 'SPK/BTC',
		
		'elfeth'    => 'ELF/ETH',
		"elfusd"	=> 'ELF/USD',
		"elfbtc"	=> 'ELF/BTC',
		
		"essusd"	=> 'ESS/USD',
		"essbtc"	=> 'ESS/BTC',
		"esseth"	=> 'ESS/ETH',
		
		"repusd"	=> 'REP/USD',
		"repbtc"	=> 'REP/BTC',
		"repeth"	=> 'REP/ETH',
		"sngusd"    => 'SNG/USD',
		
		"aidusd"	=> 'AID/USD',
		"aidbtc"	=> 'AID/BTC',
		"aideth"	=> 'AID/ETH',
		
		'venusbtc' => 'VENUS/BTC',
		'zecuah'	=> 'ZEC/UAH',
		
		
		'venusd' 	=> 'VEN/USD',
		'veneur'	=> 'VEN/EUR',
		'venjpy'	=> 'VEN/JPY',
		'vengbp'	=> 'VEN/GBP',
		'venbtc'	=> 'VEN/BTC',
		'veneth'	=> 'VEN/ETH',
		
		'mkrusd' 	=> 'MKR/USD',
		'mkreur'	=> 'MKR/EUR',
		'mkrjpy'	=> 'MKR/JPY',
		'mkrgbp'	=> 'MKR/GBP',
		'mkrbtc'	=> 'MKR/BTC',
		'mkreth'	=> 'MKR/ETH',
		
		'kncusd' 	=> 'KNC/USD',
		'knceur'	=> 'KNC/EUR',
		'kncjpy'	=> 'KNC/JPY',
		'kncgbp'	=> 'KNC/GBP',
		'kncbtc'	=> 'KNC/BTC',
		'knceth'	=> 'KNC/ETH',
		
		'poausd' 	=> 'POA/USD',
		'poaeur'	=> 'POA/EUR',
		'poajpy'	=> 'POA/JPY',
		'poagbp'	=> 'POA/GBP',
		'poabtc'	=> 'POA/BTC',
		'poaeth'	=> 'POA/ETH',
		
		'dgxusd'	=> 'DGX/USD',
		'dgxeth'	=> 'DGX/ETH',
		'niousd'	=> 'NIO/USD',
		'nioeth'	=> 'NIO/ETH',
		'bbnusd'	=> 'BBN/USD',
		'bbneth'	=> 'BBN/ETH',
		
		'krbuah'	=> 'KRB/UAH',
		'remeth'	=> 'REM/ETH',
		'remuah'	=> 'REM/UAH',
		'xemuah'	=> 'XEM/UAH',
		'erc20btc'	=> 'ERC20/BTC',
		'eursuah' 	=> 'EURS/UAH',
		'btceurs'	=> 'BTC/EURS',
		
		'utnusd' 	=> 'UTN/USD',
		'utneth' 	=> 'UTN/ETH',
		'tknusd' 	=> 'TKN/USD',
		'tkneth' 	=> 'TKN/ETH',
		'gotusd' 	=> 'GOT/USD',
		'goteur' 	=> 'GOT/EUR',
		'goteth' 	=> 'GOT/ETH',
		
		
		"rlcusd"	=> 'RLC/USD',
		"rlceth"	=> 'RLC/ETH',
		"rcnusd"	=> 'RCN/USD',
		"rcnbtc"	=> 'RCN/BTC',
		"rcneth"	=> 'RCN/ETH',
		"trxusd"	=> 'TRX/USD'	
	);
	
	if (!array_key_exists($originalPair, $_pairs))
		return null;
	else
		return $_pairs[ $originalPair ];	
}


//процессинг трейд истории 
function parseTrades($exName = null, $json = null, $market = null){
	if (empty($exName) || empty($json)) return null;
	//Парсед и приведенный к формату уже список трейдов  
	$tradesList = Array();
	$tx = time();
	
	/**
		id = уникальный идентификатор на бирже
		ts = время сделки в виде Unix timestamp с миллисекундами (000 если не указано)
		symbol = XXX/ZZZ в виде кодов или тикер (например для фьючерсов)
		asset = ХХХ
		cur	= ZZZ
		type - CUR/FUT/OPT
		side - ''/sell/buy - сторона сделки если есть 
		price - цена сделки (в валюте пары)
		amount - обьем сделки (в активе)
		total - обьем сделки (в валюте)
		
	**/
	
	switch ($exName){
		case 'KUNA' : {
			// 
			foreach($json as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = date_timestamp_get( date_create( $x['created_at'] ) );
				$t['amount'] = floatval($x['volume']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval($x['funds']);

				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
			//потом будем процессить 			
			break;
		}
	
	case 'Bittrex' : {
		if ($json['success'] == true && !empty($json['result'])){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['Id']);
				$t['ts'] = date_timestamp_get( date_create( $x['TimeStamp'] ) );
				$t['type'] = $market['type'];
				$t['amount'] = floatval($x['Quantity']);
				$t['price'] = floatval($x['Price']);
				$t['total'] = floatval($x['Total']);
				$t['side'] = strtoupper(strval($x['OrderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		
		break;
	}
	
	case 'WEX' : {
		//присутствует символ маркета 
		$x = array_keys($json);
		$data = $json[ $x[0] ];
		
		foreach($data as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval($x['timestamp']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		
		break;
	}

	case 'CEX.io' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval($x['date']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		
		break;
	}
	
	case 'BTC-Alpha' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = $x['timestamp'];
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Bithumb' : {
		if ($json['status'] == "0000" && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['ts'] = intval(strtotime($x['transaction_date']));
				$t['id'] = strval($t['ts']);
				$t['amount'] = floatval($x['units_traded']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( $x['total'] );
				$t['side'] = strtoupper(strval($x['type']));			
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;
	}
	
	case 'Bitfinex' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = $x['timestamp'];
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'Ethfinex' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = $x['timestamp'];
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
		
			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'BitMEX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['ts'] = strtotime($x['timestamp']);
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['side']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			//биржа не отдает ид сделок уникальные
			$t['id'] = $t['_hash'];

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'Coincheck' : {
		if ($json['success'] == true && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = strtotime($x['created_at']);
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['rate']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				$t['side'] = strtoupper(strval($x['order_type']));			
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;
	}
	
	case 'Poloniex' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['globalTradeID']);
			$t['ts'] = strtotime($x['date']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['rate']);
			$t['total'] = floatval( $x['total'] );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		
		break;
	}
	
	case 'Coinone' : {
		if ($json['errorCode'] == 0 && !empty($json['completeOrders'])){
			foreach($json['completeOrders'] as $x){
				$t = getTradeTpl($market);
				
				$t['ts'] = intval($x['timestamp']);
				$t['amount'] = floatval($x['qty']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
							
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];
				
				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}		
		
		break;
	}
	
	case 'Quoine' : {
		if (!empty($json['models'])){
			foreach($json['models'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = $x['id'];				
				$t['ts'] = intval($x['created_at']);
				$t['amount'] = floatval($x['quantity']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				$t['side'] = strtoupper(strval($x['taker_side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}			
		}
		
		break;
	}
	
	case 'Binance' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['a']);
			$t['ts'] = intval($x['T'] / 1000);
			$t['amount'] = floatval($x['q']);
			$t['price'] = floatval($x['p']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			
			if ($x['m'] == true)
				$t['side'] = 'BUY';
			else
				$t['side'] = 'SELL';
		
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		
		break;
	}
	
	case 'GDAX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = strtotime($x['time']);
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['side']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'HitBTC' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = strtotime($x['timestamp']);
			$t['amount'] = floatval($x['quantity']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['side']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Bitstamp' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval($x['date']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			
			if ($x['type'] == 1)
				$t['side'] = 'SELL';
			else
				$t['side'] = 'BUY';
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'bitFlyer' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = strtotime($x['exec_date']);
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['side']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Kraken' : {
		if (empty($json['error']) && !empty($json['result'])){
			$z = array_keys($json['result']);
			
			foreach($json['result'][ $z[0] ] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = str_replace('.', '', strval($x[2]));
				$t['ts'] = intval($x[2]);
				$t['amount'] = floatval($x[1]);
				$t['price'] = floatval($x[0]);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				
				if ($x[3] == 's')
					$t['side'] = 'SELL';
				else
				if ($x[3] == 'b')
					$t['side'] = 'BUY';
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
   
				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}			
		}
		
		break;
	}
	
	case 'OKEx/Spot' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval($x['date']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}		
		break;
	}
	
	case 'Huobi' : {
		if ($json['status'] == "ok" && !empty($json['data'])){
			foreach($json['data'] as $z){
				if (empty($z['data'])) continue;
				
				foreach($z['data'] as $x){
					$t = getTradeTpl($market);
			
					$t['id'] = strval($x['id']);
					$t['ts'] = intval($x['ts'] / 1000);
					$t['amount'] = floatval($x['amount']);
					$t['price'] = floatval($x['price']);
					$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
					$t['side'] = strtoupper(strval($x['direction']));			
					
					//уникальный наш ид 
					$t['_hash'] = calcHash($t);

					$t['_org'] = json_encode( $x );
					$tradesList[] = postFilterTrade($t);
				}			
			}
		}		
		break;
	}
	
	case 'Gemini' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval($x['timestamp']);
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}		
		break;
	}
	
	case 'BTCCUSDExchange' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['Id']);
			$t['ts'] = intval( $x['Timestamp'] / 1000);
			$t['amount'] = floatval($x['Quantity']);
			$t['price'] = floatval($x['Price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['Side']));			
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}		
		break;
	}
	
	case 'LakeBTC' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'Korbit' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'ZB' : {
		foreach($json as $x){
			if (empty($x['tid'])) continue; 
			
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'EXX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}	
		break;
	}
	
	case 'Zaif' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['trade_type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'Bit-Z' :{
		if ($json['code'] == 0 && $json['msg'] == 'Success' && !empty($json['data']) && !empty($json['data']['d'])){
			/**
			foreach($json['data']['d'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['date'] );
				$t['_dts'] = date('r', $t['ts']);
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				$t['side'] = strtoupper(strval($x['trade_type']));	
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
					
				$t['_pts'] = $tx;
				$tradesList[] = postFilterTrade($t);				
			}	
			**/
		}
		break;
	}
	
	case 'Fisco' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['trade_type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'Exmo' : {
		$z = array_keys($json);
		
		foreach($json[ $z[0] ] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['quantity']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( $x['amount'] );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}			
		
		break;
	}
	
	case 'CoinsBank' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['direction']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'BTC Markets' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Gate.io' :{ 
		if ($json['result'] == "true" && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tradeID']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['rate']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
				$t['side'] = strtoupper(strval($x['type']));	
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;
	}
	
	case 'Lbank' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date_ms'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'Bitcoin Indonesia' :{
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'Coinnest' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			//фильтруем если инструмент отключат
			if (array_key_exists('msg', $x) && !empty($x['msg'])) continue; 
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'YoBit.Net': {
		$z = array_keys($json);
		foreach($json[ $z[0] ] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}			
		
		break;
	}
	
	case 'BitBay' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Liqui' : {
		$z = array_keys($json);
	
		foreach($json[ $z[0] ] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			$t['side'] = strtoupper(strval($x['type']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}	
		break;
	}
	
	case 'ACX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime($x['created_at']) );
			$t['amount'] = floatval($x['volume']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( $x['funds'] );
			//$t['side'] = strtoupper(strval($x['side']));	
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;
	}
	
	case 'Cryptopia' : {
		if ($json['Success'] == true && $json['Message'] == null){
			foreach($json['Data'] as $x){
				$t = getTradeTpl($market);
				
				$t['ts'] = intval( $x['Timestamp'] );
				$t['amount'] = floatval($x['Amount']);
				$t['price'] = floatval($x['Price']);
				$t['total'] = floatval( $x['Total'] );
				$t['side'] = strtoupper(strval($x['Type']));	
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		
		break;
	}
	
	case 'Luno' : {
		foreach($json['trades'] as $x){
			$t = getTradeTpl($market);
			
			//$t['id'] = strval($x['id']);
			$t['ts'] = intval( $x['timestamp'] / 1000 );
			$t['amount'] = floatval($x['volume']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );
			
			if ($x['is_buy'] == true)
				$t['side'] = 'BUY';
			else
				$t['side'] = 'SELL';
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			//биржа не отдает ид сделок уникальные
			$t['id'] = $t['_hash'];

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'QuadrigaCX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['side']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'Mercado Bitcoin' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;		
	}
	
	case 'Paribu' : {
		foreach($json['publicState']['orders']['recent'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime($x['tm']) );
			$t['amount'] = floatval($x['ma']);
			$t['price'] = floatval($x['mp']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['tr']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;		
	}
	
	case 'Livecoin' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( $x['time'] );
			$t['amount'] = floatval($x['quantity']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'BX Thailand' : {
		foreach($json['trades'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( strtotime($x['trade_date']) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['rate']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['trade_type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;		
	}
	
	case 'Tidex' : {
		$z = array_keys($json);

		foreach($json[ $z[0] ] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;
	}
	
	case 'BTCTurk' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['trade_type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'itBit' : {
		foreach($json['recentTrades'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['matchNumber']);
			$t['ts'] = intval( strtotime($x['timestamp']) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['trade_type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'CoinEgg' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'AEX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Bitso' : {
		if ($json['success'] == true && !empty($json['payload'])){
			foreach($json['payload'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( strtotime($x['created_at']) );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['maker_side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
			break;	
		}
	}
	
	case 'CoolCoin' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'OkCoin/Intl' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Coinfloor' : {
		if (!array_key_exists('error_code', $json)){
			foreach($json as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['date'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['type']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'Bitbank' : {
		if ($json['success'] == 1 && !empty($json['data']['transactions'])){
			foreach($json['data']['transactions'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['transaction_id']);
				$t['ts'] = intval( $x['executed_at'] / 1000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Independent Reserve' : {
		if (!empty($json['Trades'])){
			foreach($json['Trades'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['transaction_id']);
				$t['ts'] = intval( strtotime($x['TradeTimestampUtc']) );
				$t['amount'] = floatval($x['PrimaryCurrencyAmount']);
				$t['price'] = floatval($x['SecondaryCurrencyTradePrice']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Kucoin' : {
		if ($json['code'] == 'OK' && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['transaction_id']);
				$t['ts'] = intval( $x[0] / 1000 );
				$t['amount'] = floatval($x[3]);
				$t['price'] = floatval($x[2]);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x[1]));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'DSX' : {
		$z = array_keys($json);

		foreach($json[ $z[0] ] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'BitMarket' : {
		if (count($json) > 1000){
			$json = array_slice($json, 0, 1000); 
		}
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Gatecoin' : {
		if ($json['responseStatus']['message'] == 'OK' && !empty($json['transactions'])){
			foreach($json['transactions'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['transactionId']);
				$t['ts'] = intval( $x['transactionTime'] );
				$t['amount'] = floatval($x['quantity']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				
				
				if (array_key_exists('way', $x)){
					$t['side'] = strtoupper(strval($x['way']));
				}
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'BL3P' : {
		if ($json['result'] == 'success' && !empty($json['data']['trades'])){
			foreach($json['data']['trades'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['trade_id']);
				$t['ts'] = intval( $x['date'] / 1000 );
				$t['amount'] = floatval( round($x['amount_int'] / 100000000, 9));
				$t['price'] = floatval( round($x['price_int'] / 100000 , 9) );
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['way']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'AidosMarket' : {
		foreach($json['transactions']['data'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['maker_type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'CoinFalcon' : {
		foreach($json['data'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime($x['created_at']) );
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['maker_type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Negocie Coins' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Coinroom' : {
		if ($json['result'] == true && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['transactionTime'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['rate']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = ''; //strtoupper(strval($x['type']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				if (empty($t['id'])) $t['id'] = $t['_hash'];	

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'The Rock Trading' : {
		foreach($json['trades'] as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime($x['date']) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['side']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'BitGrail' : {
		if ($json['success'] == 1 && !empty($json['response'])){
			foreach($json['response'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['date'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Allcoin' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Coinrail' : {
		if ($json['error_code'] == 0){
			foreach($json['transaction_list'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( strtotime($x['time']) );
				$t['amount'] = floatval($x['qty']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'BitcoinToYou' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'BitcoinTrade' : {
		if ($json['message'] == null && !empty($json['data']['trades'])){
			foreach($json['data']['trades'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['tid']);
				$t['ts'] = intval( strtotime($x['date']) );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['unit_price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['type']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Waves DEX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( $x['timestamp'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'GOPAX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			//Провайдер иногда отдает NULL как дату (и в поле time)
			if (empty($x['time'])) continue;
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime($x['time']) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['side']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Abucoins' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( strtotime($x['time']) );
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['side']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'C-CEX' : {
		if ($json['success'] == true && !empty($json['result'])){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['Id']);
				$t['ts'] = intval( strtotime($x['TimeStamp']) );
				$t['amount'] = floatval($x['Quantity']);
				$t['price'] = floatval($x['Price']);
				$t['total'] = floatval( $x['Total'] );			
				$t['side'] = strtoupper(strval($x['OrderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Bit2C' : {
		if (count($json) > 1000){
			$json = array_reverse($json);
			$json = array_slice($json, 0, 1000);
		}
		
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['side']));
			
			if ((empty($t['amount'])) || (empty($t['price']))) continue;
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Qryptos' : {
		if (!empty($json['models'])){
			foreach($json['models'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['created_at'] );
				$t['amount'] = floatval($x['quantity']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['taker_side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'CoinMate' : {
		if ($json['error'] == false && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['transactionId']);
				$t['ts'] = intval( $x['timestamp'] / 1000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['OrderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Bitsane' : {
		if ($json['statusCode'] == 0 && !empty($json['result'])){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['OrderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Braziliex' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['_id']);
			$t['ts'] = intval( $x['timestamp'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( $x['total'] );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Bittylicious' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['fiat']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Bleutrade' : {
		if ($json['success'] == true && !empty($json['result'])){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['tid']);
				$t['ts'] = intval( strtotime($x['TimeStamp']) );
				$t['amount'] = floatval($x['Quantity']);
				$t['price'] = floatval($x['Price']);
				$t['total'] = floatval( $x['Total'] );			
				$t['side'] = strtoupper(strval($x['OrderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Bitex.la' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x[1]);
			$t['ts'] = intval( $x[0] );
			$t['amount'] = floatval($x[3]);
			$t['price'] = floatval($x[2]);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Nevbit' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Nevbit' : {
		foreach($json['list'] as $x){
			$t = getTradeTpl($market);
			
			//$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['created'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['dir']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			//биржа не отдает ид сделок уникальные
			$t['id'] = $t['_hash'];

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'ETHEXIndia' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( strtotime($x['time']) );
			$t['amount'] = floatval($x['volume']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['dir']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Nocks' : {
		if ($json['status'] == 200 && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['uuid']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['rate']);
				$t['total'] = floatval( $x['cost'] );			
				$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'CryptoMarket' : {
		if ($json['status'] == 'success' && !empty($json['data'])){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['uuid']);
				$t['ts'] = intval( strtotime($x['timestamp']) );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['market_taker']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'ezBtc' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( $x['timestamp'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['rate']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Cryptox' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Bitmaszyna' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'SouthXchange' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			//$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['At'] );
			$t['amount'] = floatval($x['Amount']);
			$t['price'] = floatval($x['Price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['Type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			//биржа не отдает ид сделок уникальные
			$t['id'] = $t['_hash'];

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Trade Satoshi' : {
		if ($json['success'] == true && !empty($json['result'])){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = intval( strtotime($x['timeStamp']) );
				$t['amount'] = floatval($x['quantity']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( $x['total'] );			
				$t['side'] = strtoupper(strval($x['orderType']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'Novaexchange' : {
		if ($json['status'] == 'success' && !empty($json['items'])){
			foreach($json['items'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['unix_t_datestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['tradetype']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'Bisq' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( ceil ($x['trade_date'] / 1000) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['direction']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'Dgtmarket' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['direction']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'OKCoin/CNY' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Coingi' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( $x['timestamp'] / 1000 );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);				
		}
		break;	
	}
	
	case 'ISX' : {
		if (!empty($json['transactions']['data'])){
			foreach($json['transactions']['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				//$t['side'] = strtoupper(strval($x['maker_type']));
				if (strval($x['maker_type']) == 'sala')
					$t['side'] = 'SELL';
				else
				if (strval($x['maker_type']) == 'kaup')
					$t['side'] = 'BUY';
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);				
			}
		}
		break;	
	}
	
	case 'FreiExchange' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			//$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime( $x['time'] ) );
			$t['amount'] = floatval($x['total_coin']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);
			
			//биржа не отдает ид сделок уникальные
			$t['id'] = $t['_hash'];

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'CryptoDerivatives' : {
		if (!empty($json['trades'])){
			foreach($json['trades'] as $x){
				if (empty($x['ethers']) || empty($x['tokens'])) continue;			
				
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['txHash']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['tokens']);
				$t['price'] = floatval( round( floatval($x['ethers']) / floatval($x['tokens']), 9)  );
				$t['total'] = floatval( $x['ethers'] );			
				$t['side'] = strtoupper(strval($x['usedRate']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				// есть txHash, но по идее может быть больше одной транзакции в блоке 
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'LEOxChange' : {
		if ($json['Success'] == true && !empty($json['Data'])){
			foreach($json['Data'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( strtotime($x['Date']) );
				$t['amount'] = floatval($x['Amount']);
				$t['price'] = floatval($x['Rate']);
				$t['total'] = floatval( $x['Total'] );			
				$t['side'] = strtoupper(strval($x['Type']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'NLexch' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime( $x['created_at'] ) );
			$t['amount'] = floatval($x['volume']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( $x['funds'] );			
			//$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);			
		}
		break;	
	}
	
	case 'Bitlish' : {
		if (!empty($json['list'])){
			foreach($json['list'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['created'] / 1000000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['dir']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'SurBTC' : {
		if (!empty($json['trades']) && !empty($json['trades']['entries'])){
			foreach($json['trades']['entries'] as $x){
				$t = getTradeTpl($market);
				
				//$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x[0] / 1000 );
				$t['amount'] = floatval($x[1]);
				$t['price'] = floatval($x[2]);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x[3]));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);
				
				//биржа не отдает ид сделок уникальные
				$t['id'] = $t['_hash'];

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);			
			}
		}
		break;	
	}
	
	case 'BTC-trade.com.ua' : {
		foreach($json as $x){
			if (!is_array($x)) break;
			
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( parseDateFormat( $x['pub_date'] ) );
			$t['amount'] = floatval($x['amnt_trade']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( $x['amnt_base'] );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);
		}
		break;
	}
	
	case 'Cobinhood' : {
		if ($json['success'] == true && !empty($json['result']) && !empty($json['result']['trades'])){
			foreach($json['result']['trades'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['timestamp'] / 1000 );
				$t['amount'] = floatval($x['size']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['maker_side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);	
			}			
		}
		break;		
	}
	
	case 'Anybits' : {
		if ($json['statusCode'] == 0 && $json['statusText'] == "Success"){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['timestamp'] );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);
			}
		}		
		break;
	}
	
	case 'BTCBOX' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
			
			$t['id'] = strval($x['tid']);
			$t['ts'] = intval( $x['date'] );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['type']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);
		}
		break;
	}
	
	
	
	
	case 'FCoin' : {
		if ($json['status'] == 0){
			foreach($json['data'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['id']);
				$t['ts'] = intval( $x['ts'] / 1000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);
			}
		}
		break;
	}
	
	case 'BigONE' : {
		foreach($json['data']['edges'] as $_x){
			$x = $_x['node'];
			$t = getTradeTpl($market);
				
			$t['id'] = strval($x['id']);
			$t['ts'] = intval( strtotime( $x['inserted_at'] ) );
			$t['amount'] = floatval($x['amount']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			
			if ($x['taker_side'] == 'BID')
				$t['side'] = 'BUY';
			else
				$t['side'] = 'SELL';
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);
		}
	
		break;
	}
	
	case 'CoinbasePro' : {
		foreach($json as $x){
			$t = getTradeTpl($market);
				
			$t['id'] = strval($x['trade_id']);
			$t['ts'] = intval( strtotime( $x['time'] ) );
			$t['amount'] = floatval($x['size']);
			$t['price'] = floatval($x['price']);
			$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
			$t['side'] = strtoupper(strval($x['side']));
			
			//уникальный наш ид 
			$t['_hash'] = calcHash($t);

			$t['_org'] = json_encode( $x );
			$tradesList[] = postFilterTrade($t);
		}
	
		break;
	}
	
	case 'RightBTC' : {
		if ($json['status']['success'] == 1){
			foreach($json['result'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['date'] / 1000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['side']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);
			}
		}
		break;
	}
	
	case 'ChaoEX' : {
		if ($json['status'] == 200){
			foreach($json['attachment'] as $x){
				$t = getTradeTpl($market);
				
				$t['id'] = strval($x['tid']);
				$t['ts'] = intval( $x['date'] / 1000 );
				$t['amount'] = floatval($x['amount']);
				$t['price'] = floatval($x['price']);
				$t['total'] = floatval( round( $t['price'] * $t['amount'], 9) );			
				$t['side'] = strtoupper(strval($x['type']));
				
				//уникальный наш ид 
				$t['_hash'] = calcHash($t);

				$t['_org'] = json_encode( $x );
				$tradesList[] = postFilterTrade($t);
			}
		}
		break;
	}
	
	
	
	
		
	default: 
		break;
	}
	
	return postProcessTrades( $tradesList );
}


