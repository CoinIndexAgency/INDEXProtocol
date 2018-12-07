# INDEXProtocol
INDEX Protocol - Blockchain for programmable financial contracts and platform for decentralized derivatives 


# Testnet DEV-01 

- Configuration: 6 validator + 3 full-node. 
- Datacentre/Hoster: DigitalOcean
- Hostname: testnet.indexprotocol.online
- Software: Tendermint Core 0.27.0 - [https://github.com/tendermint/tendermint/releases/tag/v0.27.0]

## Nodes

- e08d7ca08dc32796f3cc164fd28a6b5457c03516@ca1.testnet.indexprotocol.online    Toronto, Canada. Validator.
- 96be71f2da28b395ebf61351438194237376a3b2@in1.testnet.indexprotocol.online    Bangalore, India. Validator
- f726b4f3ae19de576f4954faa69ce4184ce513c3@ny1.testnet.indexprotocol.online    New York, USA. Validator
- 468f175792f9d1e830fedd630afa7735dabba2b4@sf1.testnet.indexprotocol.online    San Francisco, USA. Validator
- c869e6da9743e8c9af1d93c99c9cc2279f8f8b07@sg1.testnet.indexprotocol.online    Singapore.    Validator
- 73c9086875b07d20278c02ce6593e1a7314535f5@uk1.testnet.indexprotocol.online    London, UK.    Validator
- 3881853a4c9fa07059f38fc45c7628778e62d980@ca2.testnet.indexprotocol.online    Toronto, Canada.     Full-node
- 42f2fdbfa7f7de332e0f9b0f1f935c701405aae7@ny2.testnet.indexprotocol.online    New York, USA.  Full-node 
- bb8aac8c62b6574e85e05a7e210d0899fdfefa51@sf2.testnet.indexprotocol.online    San Francisco, USA.   Full-node 

**Warning**: full-node maybe off-line at any time without guarantees

## RPC

Each node use RPC endpoint - rpc.<host>., e.g. rpc.sf1.testnet.indexprotocol.online. Default port: 80 or 8080, without SSL. Websocket support at /websocket endpoint. 
  
  Also, we used Nginx proxy for provide one, balanced endpoint for all testnet (only validators): rpc.testent.indexprotocol.online or rpc.testent.indexprotocol.online/websocket for WS connection. 



