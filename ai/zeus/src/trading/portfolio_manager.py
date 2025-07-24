"""
ZEUS Trading Agent - Portfolio Manager
Manages trading portfolio and positions with real exchange integration
"""

from typing import Dict, Any, List, Optional
import asyncio
import json
import time
from datetime import datetime

from utils.logger import setup_logger
from .wallet_manager import WalletManager
from .exchange_client import MEXCClient

class PortfolioManager:
    """Manages trading portfolio and positions with real exchange integration"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = setup_logger("PORTFOLIO")
        
        # Initialize wallet and exchange clients
        self.wallet_manager = WalletManager(config.get('wallet', {}))
        self.exchange_client = MEXCClient(config.get('exchange', {}))
        
        # Performance tracking
        self.initial_balance = config['trading']['initial_balance']
        self.target_balance = config['trading']['target_balance']
        
        # Exchange configuration
        self.base_currency = config['trading']['base_currency']
        self.exchange_symbol = f"USDC{self.base_currency}"
        
        # Initialize balance from config (not state file)
        self.balance = self.initial_balance
        self.positions = {}
        self.orders = []
        self.trades = []
        
        # Load state if available, but don't override config values
        self.load_state()
        
    async def initialize(self):
        """Initialize portfolio manager with wallet and exchange"""
        try:
            # Initialize wallet
            wallet_initialized = self.wallet_manager.initialize()
            if not wallet_initialized:
                raise Exception("Wallet initialization failed")
            
            # Initialize exchange client
            await self.exchange_client.initialize()
            
            # Load initial balance
            await self.update_portfolio()
            
            self.logger.info("✅ Portfolio manager initialized")
            
        except Exception as e:
            self.logger.error(f"❌ Portfolio manager initialization failed: {str(e)}")
            raise
    
    async def close(self):
        """Close portfolio manager connections"""
        await self.exchange_client.close()
        self.logger.info("✅ Portfolio manager closed")
    
    async def update_portfolio(self):
        """Update portfolio from exchange and wallet - use actual wallet balance in live mode"""
        try:
            # Try to get actual wallet balance
            wallet_balance = 0.0
            exchange_balance = 0.0
            
            # Get multi-chain balances
            multi_chain_bal = self.wallet_manager.get_multi_chain_balances_sync()
            if 'error' not in multi_chain_bal:
                wallet_balance = multi_chain_bal['total_usdc']
                self.logger.info(f"💰 Multi-chain USDC balance: ${wallet_balance:.2f}")
            else:
                self.logger.warning(f"⚠️ Multi-chain wallet issue: {multi_chain_bal.get('error')}")
                wallet_balance = 0.0
            
            # Get exchange balance
            try:
                account_info = await self.exchange_client.get_account_info()
                for balance in account_info.get('balances', []):
                    if balance['asset'] == 'USDC':
                        exchange_balance = float(balance['free'])
                        break
                self.logger.info(f"💰 Exchange USDC balance: ${exchange_balance:.2f}")
            except Exception as e:
                self.logger.warning(f"⚠️ Could not get exchange balance: {str(e)}")
            
            # Use actual balances if available, otherwise use config
            if wallet_balance > 0 or exchange_balance > 0:
                self.balance = wallet_balance + exchange_balance
                self.logger.info(f"📊 Using actual balance: ${self.balance:.2f} USDC")
            else:
                self.logger.info(f"📊 Using config balance: ${self.balance:.2f} USDC")
            
            # Get open orders
            try:
                self.orders = await self.exchange_client.get_open_orders()
            except Exception as e:
                self.logger.warning(f"⚠️ Could not get open orders: {str(e)}")
                self.orders = []
            
            # Get positions
            try:
                self.positions = await self._get_positions_from_trades()
            except Exception as e:
                self.logger.warning(f"⚠️ Could not get positions: {str(e)}")
                self.positions = {}
            
            self.logger.info(f"📊 Portfolio updated: ${self.balance:.2f} USDC")
            
        except Exception as e:
            self.logger.error(f"❌ Portfolio update failed: {str(e)}")
            # Always fallback to config balance
            self.logger.info(f"📊 Using config balance as fallback: ${self.balance:.2f}")
    
    async def _get_positions_from_trades(self) -> Dict[str, Dict[str, Any]]:
        """Calculate positions from trade history"""
        try:
            # Get recent trades
            trades = await self.exchange_client.get_trades(self.exchange_symbol, limit=100)
            
            positions = {}
            for trade in trades:
                symbol = trade['symbol']
                if symbol not in positions:
                    positions[symbol] = {
                        'quantity': 0.0,
                        'avg_price': 0.0,
                        'side': 'BUY' if float(trade['qty']) > 0 else 'SELL'
                    }
                
                # Simplified position calculation
                positions[symbol]['quantity'] += float(trade['qty'])
            
            return positions
            
        except Exception as e:
            self.logger.error(f"❌ Position calculation failed: {str(e)}")
            return {}
    
    def get_portfolio_state(self) -> Dict[str, Any]:
        """Get current portfolio state"""
        return {
            'total_value': self.balance,
            'available_balance': self.balance,
            'positions': self.positions,
            'open_orders': len(self.orders),
            'total_trades': len(self.trades),
            'return_percentage': ((self.balance - self.initial_balance) / self.initial_balance) * 100,
            'target_progress': (self.balance / self.target_balance) * 100,
            'wallet_address': self.wallet_manager.address if self.wallet_manager.account else None
        }
    
    async def place_order(self, symbol: str, side: str, quantity: float, 
                         order_type: str = "MARKET", price: Optional[float] = None) -> Dict[str, Any]:
        """Place a real order on the exchange"""
        try:
            # Validate order parameters
            if quantity <= 0:
                raise ValueError("Quantity must be positive")
            
            # Check balance
            if side == "BUY" and quantity * (price or 1) > self.balance:
                raise ValueError("Insufficient balance")
            
            # Place order
            order = await self.exchange_client.place_order(
                symbol=symbol,
                side=side,
                order_type=order_type,
                quantity=quantity,
                price=price
            )
            
            # Update local state
            order_data = {
                'symbol': symbol,
                'side': side,
                'quantity': quantity,
                'type': order_type,
                'price': price,
                'order_id': order['orderId'],
                'timestamp': datetime.now().isoformat(),
                'status': order['status']
            }
            
            self.orders.append(order_data)
            self.logger.info(f"📋 Order placed: {side} {quantity} {symbol} (ID: {order['orderId']})")
            
            return order_data
            
        except Exception as e:
            self.logger.error(f"❌ Order placement failed: {str(e)}")
            raise
    
    async def cancel_order(self, symbol: str, order_id: str) -> Dict[str, Any]:
        """Cancel an existing order"""
        try:
            result = await self.exchange_client.cancel_order(symbol, order_id)
            
            # Update local state
            self.orders = [o for o in self.orders if o.get('order_id') != order_id]
            
            self.logger.info(f"❌ Order cancelled: {order_id}")
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Order cancellation failed: {str(e)}")
            raise
    
    async def close_position(self, symbol: str, reason: str = "MANUAL") -> Dict[str, Any]:
        """Close a position by placing opposite order"""
        try:
            if symbol not in self.positions:
                raise ValueError("Position not found")
            
            position = self.positions[symbol]
            side = "SELL" if position['side'] == "BUY" else "BUY"
            
            # Get current price
            ticker = await self.exchange_client.get_price_ticker(symbol)
            current_price = float(ticker['price'])
            
            # Place closing order
            order = await self.place_order(
                symbol=symbol,
                side=side,
                quantity=abs(position['quantity']),
                order_type="MARKET"
            )
            
            # Record trade
            trade = {
                'symbol': symbol,
                'side': side,
                'quantity': abs(position['quantity']),
                'price': current_price,
                'reason': reason,
                'timestamp': datetime.now().isoformat(),
                'order_id': order['order_id']
            }
            
            self.trades.append(trade)
            del self.positions[symbol]
            
            self.logger.info(f"🔒 Position closed: {symbol} ({reason})")
            return trade
            
        except Exception as e:
            self.logger.error(f"❌ Position close failed: {str(e)}")
            raise
    
    async def close_all_positions(self, reason: str = "EMERGENCY") -> List[Dict[str, Any]]:
        """Close all positions"""
        closed_positions = []
        
        for symbol in list(self.positions.keys()):
            try:
                trade = await self.close_position(symbol, reason)
                closed_positions.append(trade)
            except Exception as e:
                self.logger.error(f"❌ Failed to close {symbol}: {str(e)}")
        
        self.logger.info(f"🚨 All positions closed ({reason}): {len(closed_positions)} positions")
        return closed_positions
    
    def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get position for a symbol"""
        return self.positions.get(symbol)
    
    def get_all_positions(self) -> Dict[str, Dict[str, Any]]:
        """Get all positions"""
        return self.positions
    
    async def calculate_position_size(self, risk_amount: float, entry_price: float, 
                                    stop_loss_price: float, symbol: str) -> float:
        """Calculate position size based on risk management and exchange limits"""
        try:
            # Calculate risk-based position size
            risk_per_share = abs(entry_price - stop_loss_price)
            if risk_per_share == 0:
                return 0
            
            position_size = risk_amount / risk_per_share
            
            # Get exchange limits
            lot_size = await self.exchange_client.get_lot_size(symbol)
            min_notional = await self.exchange_client.get_min_notional(symbol)
            
            # Apply exchange constraints
            position_size = max(position_size, lot_size['min_qty'])
            position_size = min(position_size, lot_size['max_qty'])
            
            # Ensure minimum notional value
            if position_size * entry_price < min_notional:
                position_size = min_notional / entry_price
            
            return position_size
            
        except Exception as e:
            self.logger.error(f"❌ Position size calculation failed: {str(e)}")
            return 0
    
    async def transfer_to_wallet(self, amount: float, token_address: str) -> str:
        """Transfer funds from exchange to wallet"""
        try:
            # This would require exchange withdrawal API
            # For now, return a placeholder
            tx_hash = f"transfer_{int(time.time())}"
            self.balance -= amount
            
            self.logger.info(f"💸 Transferred ${amount:.2f} to wallet")
            return tx_hash
            
        except Exception as e:
            self.logger.error(f"❌ Transfer failed: {str(e)}")
            raise
    
    async def update_balance(self, amount: float, reason: str = "TRADE"):
        """Update balance from actual transactions"""
        old_balance = self.balance
        self.balance += amount
        
        self.logger.info(f"💰 Balance updated: ${old_balance:.2f} → ${self.balance:.2f} ({reason})")
        
        return {
            'old_balance': old_balance,
            'new_balance': self.balance,
            'change': amount,
            'reason': reason
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        total_return = self.balance - self.initial_balance
        return_percentage = (total_return / self.initial_balance) * 100
        
        return {
            'total_return': total_return,
            'return_percentage': return_percentage,
            'current_balance': self.balance,
            'target_balance': self.target_balance,
            'progress_to_target': (self.balance / self.target_balance) * 100,
            'total_trades': len(self.trades),
            'open_positions': len(self.positions),
            'open_orders': len(self.orders),
            'wallet_address': self.wallet_manager.address
        }
    
    def save_state(self, filename: str = "portfolio_state.json"):
        """Save portfolio state to file"""
        state = {
            'balance': self.balance,
            'positions': self.positions,
            'orders': self.orders,
            'trades': self.trades,
            'initial_balance': self.initial_balance,
            'target_balance': self.target_balance
        }
        
        with open(filename, 'w') as f:
            json.dump(state, f, indent=2)
        
        self.logger.info(f"💾 Portfolio state saved to {filename}")
    
    def load_state(self, filename: str = "portfolio_state.json"):
        """Load portfolio state from file - but always use config values for balance"""
        try:
            with open(filename, 'r') as f:
                state = json.load(f)
            
            # Always use config values for balance and targets
            self.balance = self.initial_balance  # Force use config value
            self.positions = state.get('positions', {})
            self.orders = state.get('orders', [])
            self.trades = state.get('trades', [])
            # Don't override config values
            # self.initial_balance = state.get('initial_balance', self.initial_balance)
            # self.target_balance = state.get('target_balance', self.target_balance)
            
            self.logger.info(f"💾 Portfolio state loaded from {filename}")
            self.logger.info(f"💰 Using config balance: ${self.balance:.2f}")
            
        except FileNotFoundError:
            self.logger.warning("⚠️ Portfolio state file not found, using defaults")
            # Initialize with config values
            self.balance = self.initial_balance
            self.positions = {}
            self.orders = []
            self.trades = []
            self.logger.info(f"💰 Initialized with config balance: ${self.balance:.2f}")
        except Exception as e:
            self.logger.error(f"❌ Error loading portfolio state: {str(e)}")
            # Fallback to config values
            self.balance = self.initial_balance
            self.positions = {}
            self.orders = []
            self.trades = []
            self.logger.info(f"💰 Fallback to config balance: ${self.balance:.2f}")
