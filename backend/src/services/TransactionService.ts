/**
 * Shared write-transaction helper used by both TreasuryAgent and CreditAgent.
 * Primary path: ethers Wallet (holds AGENT_ROLE on contracts).
 * Fallback: WDK account (may derive a different address).
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
  // Primary path: ethers Wallet (the address that has AGENT_ROLE on contracts)
  if (privateKey) {
    try {
      const signer = new ethers.Wallet(privateKey, provider as ethers.JsonRpcProvider);
      const tx = await signer.sendTransaction({ to, data });
      const receipt = await tx.wait();
      const hash = receipt!.hash;
      logger.info(`[ethers] ${label} succeeded`, { hash });
      return hash;
    } catch (ethersErr) {
      logger.warn(`[ethers] ${label} failed, falling back to WDK`, {
        error: ethersErr instanceof Error ? ethersErr.message : String(ethersErr),
      });
    }
  }

  // Fallback: WDK
  const result = await wdkAccount.sendTransaction({ to, value: '0', data });
  const hash: string = result.hash ?? result;
  logger.info(`[WDK] ${label} succeeded`, { hash });
  return hash;
}
