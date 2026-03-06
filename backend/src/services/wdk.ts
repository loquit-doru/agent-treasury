/**
 * WDK Service — Tether Wallet Development Kit integration
 *
 * Single source of truth for wallet + DeFi protocol access.
 * All agent code should use this service, never ethers.Wallet directly.
 */

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import LendingAaveEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import logger from '../utils/logger';

export interface WdkConfig {
  seedPhrase: string;
  rpcUrl: string;
  chainId: number;
  aavePoolAddress?: string;
}

let wdkInstance: WDK | null = null;

/**
 * Initialize WDK with seed phrase and register wallet + protocols.
 * Call once at startup.
 */
export async function initWdk(cfg: WdkConfig): Promise<WDK> {
  if (wdkInstance) return wdkInstance;

  logger.info('Initializing WDK...');

  const wdk = new WDK(cfg.seedPhrase);

  // Register EVM wallet (Sepolia)
  wdk.registerWallet('ethereum', WalletManagerEvm, {
    rpcUrl: cfg.rpcUrl,
    chainId: cfg.chainId,
  });

  // Register Aave lending protocol if pool address provided
  if (cfg.aavePoolAddress) {
    wdk.registerProtocol('ethereum', 'aave', LendingAaveEvm, {
      poolAddress: cfg.aavePoolAddress,
    });
    logger.info('Aave lending protocol registered');
  }

  wdkInstance = wdk;

  // Log wallet address
  const account = await wdk.getAccount('ethereum', 0);
  const address = account.address ?? '(unknown)';
  logger.info(`WDK wallet ready: ${address}`);

  return wdk;
}

/**
 * Get the primary EVM account (index 0).
 */
export async function getAccount(wdk: WDK) {
  return wdk.getAccount('ethereum', 0);
}

/**
 * Get the Aave lending protocol handle from an account.
 * Returns null if Aave was not registered.
 */
export function getAaveLending(account: Awaited<ReturnType<typeof getAccount>>) {
  try {
    return account.getLendingProtocol('aave');
  } catch {
    logger.warn('Aave lending protocol not available');
    return null;
  }
}

/**
 * Tear down WDK (call on shutdown).
 */
export async function disposeWdk(): Promise<void> {
  if (wdkInstance) {
    wdkInstance.dispose();
    wdkInstance = null;
    logger.info('WDK disposed');
  }
}
