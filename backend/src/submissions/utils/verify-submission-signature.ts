import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';

const logger = new Logger('SubmissionSignatureVerifier');

/**
 * Construct the message that should be signed for a submission
 * Format: "Submit to event {eventId} at {timestamp}"
 */
export function constructSubmissionMessage(eventId: string, timestamp: number): string {
  return `Submit to event ${eventId} at ${timestamp}`;
}

/**
 * Verify submission signature
 * The signature should sign a message containing eventId and timestamp
 */
export function verifySubmissionSignature(
  eventId: string,
  signature: string,
  expectedAddress: string,
): { valid: boolean; timestamp?: number } {
  try {
    // Try to recover the message from signature
    // For simplicity, we'll use a flexible window (last 24 hours)
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Try recent timestamps (check every minute in the last hour for performance)
    for (let timestamp = now; timestamp >= oneDayAgo; timestamp -= 60000) {
      const message = constructSubmissionMessage(eventId, timestamp);
      
      try {
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()) {
          logger.log(
            `Submission signature verified for ${expectedAddress} at timestamp ${timestamp}`,
          );
          return { valid: true, timestamp };
        }
      } catch {
        // Continue to next timestamp
        continue;
      }
    }

    logger.warn(`Failed to verify submission signature for ${expectedAddress}`);
    return { valid: false };
  } catch (error) {
    logger.error(`Error verifying submission signature: ${error.message}`);
    return { valid: false };
  }
}

/**
 * Alternative: Simple signature verification without timestamp
 * Uses format: "Submit to event {eventId}"
 */
export function verifySimpleSubmissionSignature(
  eventId: string,
  signature: string,
  expectedAddress: string,
): boolean {
  try {
    const message = `Submit to event ${eventId}`;
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    
    if (isValid) {
      logger.log(`Simple submission signature verified for ${expectedAddress}`);
    }
    
    return isValid;
  } catch (error) {
    logger.error(`Error verifying simple submission signature: ${error.message}`);
    return false;
  }
}

