"""
import json
from src.trading.wallet_manager import WalletManager
from src.utils.config_manager import load_config

config = load_config('config/config.yaml')
wallet = WalletManager(config)
wallet.initialize()
wallet.address = '0x2224d65770ef7731ad4fb5daf781d4E4D4674419'

balances = wallet.get_multi_chain_balances_sync()
print(json.dumps(balances, indent=2))
""" 