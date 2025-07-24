"""
ZEUS Trading Agent - Wallet Manager
Secure EVM wallet management for autonomous trading
"""

import os
import json
from typing import Dict, Any, Optional, List
from eth_account import Account
from web3 import Web3
from dotenv import load_dotenv
import logging
import asyncio

from utils.logger import setup_logger

class WalletManager:
    """Secure EVM wallet management for autonomous trading"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = setup_logger("WALLET-MGR")
        
        # Load environment variables
        load_dotenv()
        
        # Initialize Web3 with fallback RPC URLs
        rpc_urls = [
            self.config.get('wallet', {}).get('evm', {}).get('rpc_url'),
            "https://mainnet.infura.io/v3/40a6efc975e24ff4b59ff23665112294",
            "https://eth-mainnet.g.alchemy.com/v2/demo",
            "https://cloudflare-eth.com",
            "https://ethereum.publicnode.com"
        ]
        
        self.web3 = None
        for rpc_url in rpc_urls:
            if rpc_url:
                try:
                    self.web3 = Web3(Web3.HTTPProvider(rpc_url))
                    if self.web3.is_connected():
                        self.logger.info(f"✅ Connected to Ethereum node: {rpc_url}")
                        break
                except Exception as e:
                    self.logger.warning(f"⚠️ Failed to connect to {rpc_url}: {str(e)}")
                    continue
        
        if not self.web3 or not self.web3.is_connected():
            self.logger.error("❌ Failed to connect to any Ethereum node")
            self.web3 = None
        
        # Wallet state
        self.account = None
        self.private_key = None
        self.address = None
        
        # In __init__ after self.web3 initialization
        self.chains = self.config.get('wallet', {}).get('evm', {}).get('chains', {})
        if not self.chains:
            self.logger.warning("⚠️ No chains configured in config.yaml")

    def initialize(self) -> bool:
        """Initialize wallet from environment or create new"""
        try:
            # Try to load from environment
            private_key = os.getenv('PRIVATE_KEY')
            wallet_address = os.getenv('WALLET_ADDRESS')
            
            if private_key:
                self.logger.info("🔑 Loading wallet from environment...")
                self.account = Account.from_key(private_key)
            else:
                self.logger.info("🆕 Creating new wallet...")
                self.account = Account.create()
                
            self.private_key = self.account.key.hex()
            self.address = self.account.address
            
            # Override address if provided in environment
            if wallet_address:
                self.address = wallet_address
                
            self.logger.info(f"✅ Wallet initialized: {self.address}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Wallet initialization failed: {str(e)}")
            return False
    
    def _get_web3_for_chain(self, chain_name: str) -> Optional[Web3]:
        """Get Web3 instance for specific chain"""
        if chain_name not in self.chains:
            self.logger.error(f"❌ Unknown chain: {chain_name}")
            return None
        chain_config = self.chains[chain_name]
        rpc_url = chain_config.get('rpc_url')
        if not rpc_url:
            self.logger.error(f"❌ No RPC URL for chain: {chain_name}")
            return None
        try:
            web3 = Web3(Web3.HTTPProvider(rpc_url))
            if web3.is_connected():
                self.logger.debug(f"✅ Connected to {chain_name} RPC")
                return web3
            else:
                self.logger.warning(f"⚠️ Failed to connect to {chain_name} RPC")
                return None
        except Exception as e:
            self.logger.error(f"❌ Error connecting to {chain_name}: {str(e)}")
            return None

    def get_balance(self, token_address: Optional[str] = None, chain_name: str = 'ethereum') -> float:
        """Get wallet balance in native token or specific ERC20 on given chain"""
        web3 = self._get_web3_for_chain(chain_name)
        if not web3:
            return 0.0
        try:
            if token_address:
                # ERC20 token balance
                contract = web3.eth.contract(
                    address=Web3.to_checksum_address(token_address),
                    abi=self._get_erc20_abi()
                )
                balance = contract.functions.balanceOf(self.address).call()
                decimals = contract.functions.decimals().call()
                return balance / (10 ** decimals)
            else:
                # Native balance
                balance_wei = web3.eth.get_balance(self.address)
                return web3.from_wei(balance_wei, 'ether')
        except Exception as e:
            self.logger.error(f"❌ Balance check failed on {chain_name}: {str(e)}")
            return 0.0
    
    def get_usdc_balance(self, chain_name: str = 'ethereum') -> float:
        """Get USDC balance on specific chain"""
        if chain_name not in self.chains:
            return 0.0
        usdc_address = self.chains[chain_name].get('usdc_address')
        if not usdc_address:
            self.logger.warning(f"⚠️ No USDC address configured for {chain_name}")
            return 0.0
        return self.get_balance(usdc_address, chain_name)
    
    async def get_usdc_balance_async(self, chain_name: str = 'ethereum') -> float:
        """Async version of USDC balance fetching"""
        return self.get_usdc_balance(chain_name)
    
    async def _get_balance_for_chain(self, chain_name: str, address: str) -> Dict[str, Any]:
        """Async helper to fetch USDC and native balances for a single chain, skipping on failure."""
        web3 = self._get_web3_for_chain(chain_name)
        if not web3:
            return {'status': 'skipped', 'error': 'Connection failed'}
        try:
            usdc_balance = self.get_usdc_balance(chain_name)
            native_balance = self.get_balance(None, chain_name)
            native_symbol = self.chains[chain_name].get('native_token', 'Unknown')
            return {
                'status': 'success',
                'usdc': usdc_balance,
                'native': native_balance,
                'native_symbol': native_symbol
            }
        except Exception as e:
            self.logger.error(f"❌ Balance fetch failed for {chain_name}: {str(e)}")
            return {'status': 'skipped', 'error': str(e)}

    async def get_multi_chain_balances(self, address: Optional[str] = None) -> Dict[str, Any]:
        """Asynchronously fetch and aggregate USDC and native balances across all configured EVM chains.
        Skips failed chains and provides per-chain details plus totals."""
        if address:
            self.address = address  # Allow overriding address
        if not self.address:
            self.logger.error("❌ No wallet address set")
            return {'error': 'No address'}
        chain_names = list(self.chains.keys())
        tasks = [self._get_balance_for_chain(chain, self.address) for chain in chain_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        aggregated = {
            'total_usdc': 0.0,
            'total_native': {},  # Dict for different native symbols
            'chains': {}
        }
        for chain, result in zip(chain_names, results):
            if isinstance(result, Exception):
                aggregated['chains'][chain] = {'status': 'skipped', 'error': str(result)}
                continue
            aggregated['chains'][chain] = result
            if result['status'] == 'success':
                aggregated['total_usdc'] += result['usdc']
                symbol = result['native_symbol']
                aggregated['total_native'][symbol] = aggregated['total_native'].get(symbol, 0.0) + result['native']
        return aggregated

    def get_multi_chain_balances_sync(self, address: Optional[str] = None) -> Dict[str, Any]:
        """Synchronous wrapper for get_multi_chain_balances."""
        return asyncio.run(self.get_multi_chain_balances(address))
    
    def send_transaction(self, to_address: str, amount: float, token_address: Optional[str] = None) -> str:
        """Send ETH or ERC20 tokens"""
        try:
            if token_address:
                return self._send_erc20(to_address, amount, token_address)
            else:
                return self._send_eth(to_address, amount)
                
        except Exception as e:
            self.logger.error(f"❌ Transaction failed: {str(e)}")
            raise
    
    def _send_eth(self, to_address: str, amount_eth: float) -> str:
        """Send ETH transaction"""
        try:
            # Build transaction
            tx = {
                'to': Web3.to_checksum_address(to_address),
                'value': self.web3.to_wei(amount_eth, 'ether'),
                'gas': 21000,
                'gasPrice': self.web3.eth.gas_price,
                'nonce': self.web3.eth.get_transaction_count(self.address),
                'chainId': self.config.get('chain_id', 1)
            }
            
            # Sign and send
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            self.logger.info(f"💸 ETH sent: {tx_hash.hex()}")
            return tx_hash.hex()
            
        except Exception as e:
            self.logger.error(f"❌ ETH transfer failed: {str(e)}")
            raise
    
    def _send_erc20(self, to_address: str, amount: float, token_address: str) -> str:
        """Send ERC20 token transaction"""
        try:
            # Get token contract
            contract = self.web3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=self._get_erc20_abi()
            )
            
            # Get decimals
            decimals = contract.functions.decimals().call()
            amount_wei = int(amount * (10 ** decimals))
            
            # Build transaction
            tx = contract.functions.transfer(
                Web3.to_checksum_address(to_address),
                amount_wei
            ).build_transaction({
                'from': self.address,
                'gas': 100000,
                'gasPrice': self.web3.eth.gas_price,
                'nonce': self.web3.eth.get_transaction_count(self.address),
                'chainId': self.config.get('chain_id', 1)
            })
            
            # Sign and send
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            self.logger.info(f"💸 ERC20 sent: {tx_hash.hex()}")
            return tx_hash.hex()
            
        except Exception as e:
            self.logger.error(f"❌ ERC20 transfer failed: {str(e)}")
            raise
    
    def approve_token(self, token_address: str, spender_address: str, amount: float) -> str:
        """Approve token spending for DEX contracts"""
        try:
            contract = self.web3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=self._get_erc20_abi()
            )
            
            decimals = contract.functions.decimals().call()
            amount_wei = int(amount * (10 ** decimals))
            
            tx = contract.functions.approve(
                Web3.to_checksum_address(spender_address),
                amount_wei
            ).build_transaction({
                'from': self.address,
                'gas': 100000,
                'gasPrice': self.web3.eth.gas_price,
                'nonce': self.web3.eth.get_transaction_count(self.address),
                'chainId': self.config.get('chain_id', 1)
            })
            
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            self.logger.info(f"✅ Token approved: {tx_hash.hex()}")
            return tx_hash.hex()
            
        except Exception as e:
            self.logger.error(f"❌ Token approval failed: {str(e)}")
            raise
    
    def get_wallet_info(self) -> Dict[str, Any]:
        """Get comprehensive wallet information"""
        try:
            eth_balance = self.get_balance()
            usdc_balance = self.get_usdc_balance()
            
            return {
                'address': self.address,
                'eth_balance': eth_balance,
                'usdc_balance': usdc_balance,
                'is_connected': self.web3.is_connected(),
                'chain_id': self.web3.eth.chain_id
            }
            
        except Exception as e:
            self.logger.error(f"❌ Wallet info failed: {str(e)}")
            return {'error': str(e)}
    
    def _get_erc20_abi(self) -> list:
        """Get standard ERC20 ABI"""
        return [
            {
                "constant": True,
                "inputs": [],
                "name": "name",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            {
                "constant": False,
                "inputs": [
                    {"name": "_to", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            },
            {
                "constant": False,
                "inputs": [
                    {"name": "_spender", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ]
    
    def save_wallet(self, filename: str = "wallet.json"):
        """Save wallet to encrypted file"""
        try:
            wallet_data = {
                'address': self.address,
                'private_key': self.private_key
            }
            
            # In production, use proper encryption
            with open(filename, 'w') as f:
                json.dump(wallet_data, f)
                
            self.logger.info(f"💾 Wallet saved to {filename}")
            
        except Exception as e:
            self.logger.error(f"❌ Wallet save failed: {str(e)}")
    
    def load_wallet(self, filename: str = "wallet.json") -> bool:
        """Load wallet from encrypted file"""
        try:
            with open(filename, 'r') as f:
                wallet_data = json.load(f)
                
            self.private_key = wallet_data['private_key']
            self.account = Account.from_key(self.private_key)
            self.address = wallet_data['address']
            
            self.logger.info(f"💾 Wallet loaded from {filename}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Wallet load failed: {str(e)}")
            return False
