/**
 * Shared write-transaction helper used by both TreasuryAgent and CreditAgent.
 * Primary path: WDK account (Tether WDK — both addresses now have AGENT_ROLE).
 * Fallback: ethers Wallet (deployer key).
 */

import { ethers } from 'ethers';
import logger from '../utils/logger';

export async function sendWriteTx(
  provider: ethers.Provider,
  privateKey: string | undefined,
  wdkAccount: any,
  to: string,
  data: string,
  label: string,
): Promise<string> {
  // Primary path: WDK (Tether Wallet Development Kit — the hackathon SDK)
  try {
    const result = await wdkAccount.sendTransaction({ to, value: '0', data });
    const hash: string = result.hash ?? result;
    logger.info(`[WDK] ${label} succeeded`, { hash });
    return hash;
  } catch (wdkErr) {
    logger.warn(`[WDK] ${label} failed, falling back to ethers`, {
      error: wdkErr instanceof Error ? wdkErr.message : String(wdkErr),
    });
  }

  // Fallback: ethers Wallet (deployer key)
  if (privateKey) {
    const signer = new ethers.Wallet(privateKey, provider as ethers.JsonRpcProvider);
    const tx = await signer.sendTransaction({ to, data });
    const receipt = await tx.wait();
    const hash = receipt!.hash;
    logger.info(`[ethers-fallback] ${label} succeeded`, { hash });
    return hash;
  }

  throw new Error(`${label}: both WDK and ethers failed`);
}
