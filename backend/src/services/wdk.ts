/**
 * WDK Service — Tether Wallet Development Kit integration
 *
 * Single source of truth for wallet + DeFi protocol access.
 * All agent code should use this service, never ethers.Wallet directly.
 */

import WDK from '@tetherto/wdk';
import type { IWalletAccountWithProtocols } from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import LendingAaveEvm from '@tetherto/wdk-protocol-lending-aave-evm';
import logger from '../utils/logger';

export interface WdkConfig {
  seedPhrase: string;
  rpcUrl: string;
  aavePoolAddress?: string;
}

export type WdkAccount = IWalletAccountWithProtocols;

let wdkInstance: WDK | null = null;

/**
 * Initialize WDK with seed phrase and register wallet + protocols.
 * Call once at startup.
 */
export async function initWdk(cfg: WdkConfig): Promise<WDK> {
  if (wdkInstance) return wdkInstance;

  logger.info('Initializing WDK...');

  const wdk = new WDK(cfg.seedPhrase);

  // Register EVM wallet — config key is `provider` (not rpcUrl), per WDK docs.
  // Chain ID is auto-detected from the RPC endpoint.
  wdk.registerWallet('ethereum', WalletManagerEvm, {
    provider: cfg.rpcUrl,
  });

  // Register Aave V3 lending protocol.
  // AaveProtocolEvm resolves the pool address internally from chain ID,
  // so no config is needed (constructor takes only account).
  wdk.registerProtocol('ethereum', 'aave', LendingAaveEvm, undefined as never);

  wdkInstance = wdk;

  // Log wallet address
  const account = await wdk.getAccount('ethereum', 0);
  const address = await account.getAddress();
  logger.info(`WDK wallet ready: ${address}`);

  return wdk;
}

/**
 * Get the primary EVM account (index 0).
 */
export async function getAccount(wdk: WDK): Promise<WdkAccount> {
  return wdk.getAccount('ethereum', 0);
}

/**
 * Get the Aave lending protocol handle from an account.
 * Returns null if Aave was not registered.
 */
export function getAaveLending(account: WdkAccount) {
  try {
    return account.getLendingProtocol('aave');
  } catch {
    logger.warn('Aave lending protocol not available');
    return null;
  }
}

/**
 * Get the WDK-derived address for the primary account.
 */
export async function getWdkAddress(wdk: WDK): Promise<string> {
  const account = await wdk.getAccount('ethereum', 0);
  return account.getAddress();
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
