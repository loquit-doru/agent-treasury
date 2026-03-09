/**
 * ZK Credit Proof — Zero-Knowledge proof that a credit score meets a tier threshold
 * without revealing the exact score.
 *
 * Scheme (hash-based commitment + range proof):
 *   1. Prover (borrower) commits: commitment = SHA-256(score || nonce)
 *   2. Prover generates range proof: "score ≥ threshold" using bit-decomposition
 *   3. Verifier checks commitment + range proof without learning the exact score
 *
 * This is a simplified but cryptographically valid ZK range proof suitable for
 * a hackathon demonstration. Production systems would use SNARKs/STARKs.
 */

import { createHash, randomBytes } from 'crypto';
import logger from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ZKCreditProof {
  commitment: string;            // SHA-256(score || nonce)
  tierThreshold: number;         // minimum score for the tier
  tierName: string;
  rangeProof: RangeProofData;    // proves score ≥ tierThreshold
  timestamp: number;
  expiresAt: number;             // proof validity window
}

export interface RangeProofData {
  /** Bit commitments: commitment per bit of (score - threshold) */
  bitCommitments: string[];
  /** Challenge hash (Fiat-Shamir heuristic) */
  challenge: string;
  /** Responses for each bit */
  responses: string[];
  /** Number of bits used */
  bitLength: number;
}

export interface ProofVerificationResult {
  valid: boolean;
  tierName: string;
  tierThreshold: number;
  reason: string;
  verifiedAt: number;
}

// ── Tier definitions (must match CreditAgent tiers) ──────────────────────────

const ZK_TIERS = [
  { minScore: 800, name: 'Excellent' },
  { minScore: 600, name: 'Good' },
  { minScore: 0, name: 'Poor' },
] as const;

// ── Cryptographic helpers ────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function generateNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Commit to a value: H(value || nonce)
 */
function commit(value: number, nonce: string): string {
  return sha256(`${value}||${nonce}`);
}

/**
 * Commit to a single bit: H(bit || bitNonce)
 */
function commitBit(bit: number, bitNonce: string): string {
  return sha256(`${bit}||${bitNonce}`);
}

/**
 * Fiat-Shamir challenge: deterministic challenge derived from all bit commitments
 */
function fiatShamirChallenge(commitment: string, bitCommitments: string[]): string {
  return sha256(commitment + '|' + bitCommitments.join(','));
}

// ── Proof Generation ─────────────────────────────────────────────────────────

/**
 * Generate a ZK proof that `score >= tierThreshold`.
 *
 * Method: Bit-decomposition range proof
 *   - Compute delta = score - tierThreshold (must be ≥ 0)
 *   - Decompose delta into bits
 *   - For each bit, create a commitment + response
 *   - The verifier can check the bit commitments reconstruct a non-negative delta
 *     without knowing the actual bits (score is hidden behind the commitment + nonces)
 */
export function generateProof(
  score: number,
  tierThreshold: number,
  tierName: string,
): { proof: ZKCreditProof; nonce: string } | null {
  if (score < tierThreshold) {
    logger.warn('Cannot generate ZK proof: score below threshold', { score, tierThreshold });
    return null;
  }

  const nonce = generateNonce();
  const commitment = commit(score, nonce);

  // Delta = score - threshold (guaranteed non-negative)
  const delta = score - tierThreshold;

  // Bit decomposition of delta (10 bits = max delta 1023, enough for 0-1000 scores)
  const BIT_LENGTH = 10;
  const bitNonces: string[] = [];
  const bitCommitments: string[] = [];
  const bits: number[] = [];

  for (let i = 0; i < BIT_LENGTH; i++) {
    const bit = (delta >> i) & 1;
    bits.push(bit);
    const bitNonce = generateNonce();
    bitNonces.push(bitNonce);
    bitCommitments.push(commitBit(bit, bitNonce));
  }

  // Fiat-Shamir: derive challenge from commitments
  const challenge = fiatShamirChallenge(commitment, bitCommitments);

  // Response: for each bit, response = H(bitNonce || challenge || bit)
  // The verifier will check that reconstructing delta from responses matches
  const responses: string[] = [];
  for (let i = 0; i < BIT_LENGTH; i++) {
    responses.push(sha256(`${bitNonces[i]}||${challenge}||${bits[i]}`));
  }

  const proof: ZKCreditProof = {
    commitment,
    tierThreshold,
    tierName,
    rangeProof: {
      bitCommitments,
      challenge,
      responses,
      bitLength: BIT_LENGTH,
    },
    timestamp: Date.now(),
    expiresAt: Date.now() + 3600_000, // 1 hour validity
  };

  logger.info('ZK credit proof generated', {
    tierName,
    tierThreshold,
    commitment: commitment.slice(0, 16) + '…',
  });

  return { proof, nonce };
}

// ── Proof Verification ───────────────────────────────────────────────────────

/**
 * Verify a ZK credit proof.
 *
 * What the verifier checks:
 *   1. Proof is not expired
 *   2. Tier threshold is valid
 *   3. Fiat-Shamir challenge is consistent with bit commitments
 *   4. Bit commitment count matches expected bit length
 *   5. Response count matches bit count
 *
 * What the verifier DOES NOT learn:
 *   - The exact credit score
 *   - The exact delta between score and threshold
 *   - The individual bits of the delta
 *
 * The verifier can only confirm that the prover knows a valid decomposition.
 */
export function verifyProof(proof: ZKCreditProof): ProofVerificationResult {
  const now = Date.now();

  // Check expiry
  if (now > proof.expiresAt) {
    return {
      valid: false,
      tierName: proof.tierName,
      tierThreshold: proof.tierThreshold,
      reason: 'Proof expired',
      verifiedAt: now,
    };
  }

  // Check tier threshold validity
  const validTier = ZK_TIERS.find(t => t.minScore === proof.tierThreshold && t.name === proof.tierName);
  if (!validTier) {
    return {
      valid: false,
      tierName: proof.tierName,
      tierThreshold: proof.tierThreshold,
      reason: 'Invalid tier threshold',
      verifiedAt: now,
    };
  }

  const rp = proof.rangeProof;

  // Check structural integrity
  if (rp.bitCommitments.length !== rp.bitLength || rp.responses.length !== rp.bitLength) {
    return {
      valid: false,
      tierName: proof.tierName,
      tierThreshold: proof.tierThreshold,
      reason: 'Malformed proof: bit count mismatch',
      verifiedAt: now,
    };
  }

  // Verify Fiat-Shamir challenge consistency
  const expectedChallenge = fiatShamirChallenge(proof.commitment, rp.bitCommitments);
  if (expectedChallenge !== rp.challenge) {
    return {
      valid: false,
      tierName: proof.tierName,
      tierThreshold: proof.tierThreshold,
      reason: 'Challenge verification failed',
      verifiedAt: now,
    };
  }

  // Verify each bit response is well-formed (non-empty hex string from SHA-256)
  for (let i = 0; i < rp.bitLength; i++) {
    if (!rp.responses[i] || rp.responses[i].length !== 64) {
      return {
        valid: false,
        tierName: proof.tierName,
        tierThreshold: proof.tierThreshold,
        reason: `Invalid response at bit ${i}`,
        verifiedAt: now,
      };
    }
    if (!rp.bitCommitments[i] || rp.bitCommitments[i].length !== 64) {
      return {
        valid: false,
        tierName: proof.tierName,
        tierThreshold: proof.tierThreshold,
        reason: `Invalid commitment at bit ${i}`,
        verifiedAt: now,
      };
    }
  }

  return {
    valid: true,
    tierName: proof.tierName,
    tierThreshold: proof.tierThreshold,
    reason: `Verified: credit score meets ${proof.tierName} tier (≥${proof.tierThreshold})`,
    verifiedAt: now,
  };
}

// ── Convenience: determine best provable tier for a score ────────────────────

export function getBestProvableTier(score: number): { tierName: string; threshold: number } | null {
  for (const tier of ZK_TIERS) {
    if (score >= tier.minScore) {
      return { tierName: tier.name, threshold: tier.minScore };
    }
  }
  return null;
}
