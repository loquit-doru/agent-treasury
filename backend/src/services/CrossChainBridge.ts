/**
 * CrossChainBridge — WDK USDt0 bridge integration (LayerZero-based)
 *
 * Enables the Treasury Agent to:
 * 1. Compare yield opportunities across chains (Arbitrum, Ethereum, Polygon)
 * 2. Bridge USDt to the best-yield chain
 * 3. Supply on the remote chain
 * 4. Bridge profits back
 *
 * Uses @tetherto/wdk-protocol-bridge-usdt0-evm over LayerZero.
 */

import type { WdkAccount } from './wdk';
import EventBus from '../orchestrator/EventBus';
import logger from '../utils/logger';

// Supported chains for cross-chain yield (WDK bridge targets)
export type BridgeChain = 'ethereum' | 'arbitrum' | 'polygon';

export interface BridgeQuote {
  targetChain: BridgeChain;
  fee: string;       // bridge fee in wei
  bridgeFee: string;  // LayerZero fee in wei
}

export interface BridgeResult {
  hash: string;
  targetChain: BridgeChain;
  amount: string;   // raw amount
  fee: string;
  bridgeFee: string;
  timestamp: number;
}

export interface CrossChainYield {
  chain: BridgeChain;
  protocol: string;
  apy: number;
  bridgeCostUsd: number;  // estimated cost to bridge
}

export interface BridgeState {
  activeBridges: BridgeResult[];
  totalBridgedOut: string;         // total USDt bridged away from home chain
  totalBridgedBack: string;        // total USDt bridged back
  lastCrossChainScan: number;
  bestRemoteYield: CrossChainYield | null;
}

// Home chain is Arbitrum (where the vault lives)
const HOME_CHAIN: BridgeChain = 'arbitrum';

// Minimum APY advantage to justify bridging (accounts for bridge cost + risk)
const MIN_APY_ADVANTAGE = 1.5; // 1.5% higher APY needed to justify cross-chain

// Maximum amount to bridge in a single operation (safety cap)
const MAX_BRIDGE_AMOUNT = 500_000000n; // 500 USDt (6 decimals)

// Minimum amount worth bridging (below this, fees eat the yield)
const MIN_BRIDGE_AMOUNT = 50_000000n; // 50 USDt

export class CrossChainBridge {
  private wdkAccount: WdkAccount;
  private state: BridgeState;

  constructor(wdkAccount: WdkAccount) {
    this.wdkAccount = wdkAccount;
    this.state = {
      activeBridges: [],
      totalBridgedOut: '0',
      totalBridgedBack: '0',
      lastCrossChainScan: 0,
      bestRemoteYield: null,
    };
  }

  /**
   * Get bridge protocol handle from WDK account.
   * Returns null if not registered.
   */
  private getBridge() {
    try {
      return this.wdkAccount.getBridgeProtocol('usdt0');
    } catch {
      logger.warn('USDt0 bridge protocol not available');
      return null;
    }
  }

  /**
   * Quote a bridge operation — returns estimated fees without executing.
   */
  async quoteBridge(
    targetChain: BridgeChain,
    amount: bigint,
    recipient: string,
    token: string,
  ): Promise<BridgeQuote | null> {
    const bridge = this.getBridge();
    if (!bridge) return null;

    try {
      const quote = await bridge.quoteBridge({
        targetChain,
        recipient,
        token,
        amount,
      });

      return {
        targetChain,
        fee: quote.fee.toString(),
        bridgeFee: quote.bridgeFee.toString(),
      };
    } catch (err) {
      logger.error('Bridge quote failed', {
        targetChain,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Execute a bridge operation — sends USDt to target chain via LayerZero.
   */
  async bridge(
    targetChain: BridgeChain,
    amount: bigint,
    recipient: string,
    token: string,
  ): Promise<BridgeResult | null> {
    const bridgeProto = this.getBridge();
    if (!bridgeProto) return null;

    // Safety checks
    if (amount > MAX_BRIDGE_AMOUNT) {
      logger.warn('Bridge amount exceeds safety cap, reducing', {
        requested: amount.toString(),
        cap: MAX_BRIDGE_AMOUNT.toString(),
      });
      amount = MAX_BRIDGE_AMOUNT;
    }

    if (amount < MIN_BRIDGE_AMOUNT) {
      logger.info('Bridge amount below minimum threshold, skipping', {
        amount: amount.toString(),
        min: MIN_BRIDGE_AMOUNT.toString(),
      });
      return null;
    }

    try {
      // Quote first for logging
      const quote = await this.quoteBridge(targetChain, amount, recipient, token);
      logger.info('Bridge quote received', {
        targetChain,
        amount: amount.toString(),
        fee: quote?.fee,
        bridgeFee: quote?.bridgeFee,
      });

      // Execute bridge
      const result = await bridgeProto.bridge({
        targetChain,
        recipient,
        token,
        amount,
      });

      const bridgeResult: BridgeResult = {
        hash: result.hash,
        targetChain,
        amount: amount.toString(),
        fee: result.fee.toString(),
        bridgeFee: result.bridgeFee.toString(),
        timestamp: Date.now(),
      };

      // Update state
      this.state.activeBridges.push(bridgeResult);
      this.state.totalBridgedOut = (
        BigInt(this.state.totalBridgedOut) + amount
      ).toString();

      // Emit event
      EventBus.emitEvent('treasury:bridge_executed', 'treasury', {
        action: 'cross_chain_bridge',
        reasoning: `Bridged ${Number(amount) / 1e6} USDt to ${targetChain} via LayerZero (tx: ${result.hash}). Fee: ${Number(result.fee) / 1e18} ETH.`,
        data: bridgeResult,
        status: 'executed',
      });

      logger.info('Bridge executed successfully', {
        hash: result.hash,
        targetChain,
        amount: amount.toString(),
      });

      return bridgeResult;
    } catch (err) {
      logger.error('Bridge execution failed', {
        targetChain,
        amount: amount.toString(),
        error: err instanceof Error ? err.message : String(err),
      });

      EventBus.emitEvent('treasury:bridge_failed', 'treasury', {
        action: 'cross_chain_bridge',
        reasoning: `Bridge to ${targetChain} failed: ${err instanceof Error ? err.message : String(err)}`,
        data: { targetChain, amount: amount.toString() },
        status: 'failed',
      });

      return null;
    }
  }

  /**
   * Bridge USDt back to home chain (Arbitrum).
   */
  async bridgeBack(
    sourceChain: BridgeChain,
    amount: bigint,
    recipient: string,
    token: string,
  ): Promise<BridgeResult | null> {
    if (sourceChain === HOME_CHAIN) {
      logger.warn('Already on home chain, no bridge needed');
      return null;
    }

    const result = await this.bridge(HOME_CHAIN, amount, recipient, token);
    if (result) {
      this.state.totalBridgedBack = (
        BigInt(this.state.totalBridgedBack) + amount
      ).toString();

      EventBus.emitEvent('treasury:bridge_back', 'treasury', {
        action: 'cross_chain_bridge_back',
        reasoning: `Bridged ${Number(amount) / 1e6} USDt back from ${sourceChain} to ${HOME_CHAIN} (tx: ${result.hash}).`,
        data: { ...result, sourceChain },
        status: 'executed',
      });
    }
    return result;
  }

  /**
   * Evaluate cross-chain yield opportunities.
   * Compares local (Arbitrum) APY with remote chains.
   *
   * Returns the best remote yield if it beats local by MIN_APY_ADVANTAGE.
   */
  async evaluateCrossChainYield(
    localApy: number,
    walletAddress: string,
    usdtAddress: string,
  ): Promise<CrossChainYield | null> {
    const remoteChains: BridgeChain[] = ['ethereum', 'polygon'];
    const candidates: CrossChainYield[] = [];

    for (const chain of remoteChains) {
      try {
        // Estimate bridge cost by quoting a reference amount (100 USDt)
        const refAmount = 100_000000n; // 100 USDt
        const quote = await this.quoteBridge(chain, refAmount, walletAddress, usdtAddress);

        const bridgeCostUsd = quote ? Number(quote.bridgeFee) / 1e18 * 2500 : 5; // rough ETH→USD

        // Fetch remote chain Aave APY
        // Note: This uses the WDK's registered protocol data when available.
        // In production, you'd query each chain's Aave pool separately.
        // For now, we use heuristic estimates + quote cost analysis.
        const remoteApy = await this.fetchRemoteApy(chain);

        if (remoteApy > 0) {
          candidates.push({
            chain,
            protocol: `Aave V3 (${chain})`,
            apy: remoteApy,
            bridgeCostUsd,
          });
        }
      } catch (err) {
        logger.debug(`Failed to evaluate ${chain} yield`, { err });
      }
    }

    this.state.lastCrossChainScan = Date.now();

    if (candidates.length === 0) {
      this.state.bestRemoteYield = null;
      return null;
    }

    // Find best candidate that beats local APY by enough margin
    const best = candidates.reduce((a, b) => a.apy > b.apy ? a : b);

    if (best.apy - localApy >= MIN_APY_ADVANTAGE) {
      this.state.bestRemoteYield = best;

      EventBus.emitEvent('treasury:cross_chain_opportunity', 'treasury', {
        action: 'cross_chain_yield_scan',
        reasoning: `Cross-chain scan: ${best.chain} offers ${best.apy}% APY (local: ${localApy}%). Advantage: +${(best.apy - localApy).toFixed(2)}% — bridge cost ~$${best.bridgeCostUsd.toFixed(2)}.`,
        data: { localApy, candidates, best },
        status: 'executed',
      });

      return best;
    }

    logger.info('No cross-chain advantage found', {
      localApy,
      bestRemote: best.apy,
      requiredAdvantage: MIN_APY_ADVANTAGE,
    });
    this.state.bestRemoteYield = null;
    return null;
  }

  /**
   * Fetch remote chain Aave APY.
   * Uses real on-chain queries when RPC is available, otherwise logs unavailability.
   */
  private async fetchRemoteApy(chain: BridgeChain): Promise<number> {
    // Known Aave V3 pool addresses per chain
    const aavePools: Record<string, string> = {
      ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    };

    // Known USDt addresses per chain
    const usdtAddresses: Record<string, string> = {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    };

    const pool = aavePools[chain];
    const usdt = usdtAddresses[chain];
    if (!pool || !usdt) return 0;

    // Use WDK's registered chain providers if available,
    // otherwise return 0 (no fake data).
    try {
      // Dynamic import ethers for on-chain query
      const { ethers } = await import('ethers');

      // Try to get RPC from environment
      const rpcEnv = chain === 'ethereum'
        ? process.env.ETHEREUM_RPC_URL
        : process.env.POLYGON_RPC_URL;

      if (!rpcEnv) {
        logger.debug(`No RPC configured for ${chain}, skipping remote APY fetch`);
        return 0;
      }

      const provider = new ethers.JsonRpcProvider(rpcEnv);
      const poolAbi = [
        `function getReserveData(address asset) view returns (
          tuple(
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress,
            uint128 accruedToTreasury,
            uint128 unbacked,
            uint128 isolationModeTotalDebt
          ) data
        )`,
      ];
      const contract = new ethers.Contract(pool, poolAbi, provider);
      const data = await contract.getReserveData(usdt);
      const rawRate = Number(data.currentLiquidityRate);
      const apy = rawRate / 1e25;

      if (apy > 0 && apy < 50) {
        logger.info(`Remote ${chain} Aave USDt APY: ${apy.toFixed(2)}%`);
        return Math.round(apy * 100) / 100;
      }
    } catch (err) {
      logger.debug(`Failed to fetch ${chain} Aave APY on-chain`, { err });
    }

    return 0;
  }

  /**
   * Get current bridge state (for dashboard / API).
   */
  getState(): BridgeState {
    return { ...this.state };
  }

  /**
   * Get summary for dashboard display.
   */
  getSummary(): {
    bridgesExecuted: number;
    totalBridgedOut: string;
    totalBridgedBack: string;
    bestRemoteYield: CrossChainYield | null;
    lastScan: number;
  } {
    return {
      bridgesExecuted: this.state.activeBridges.length,
      totalBridgedOut: this.state.totalBridgedOut,
      totalBridgedBack: this.state.totalBridgedBack,
      bestRemoteYield: this.state.bestRemoteYield,
      lastScan: this.state.lastCrossChainScan,
    };
  }
}
