/**
 * Event Factory Contract Interface
 * Minimal ABI definitions for contract interactions
 */

export interface EventFactoryABI {
  createEvent: string;
  fundEvent: string;
  payout: string;
}

// Minimal ABI for EventFactory contract
export const EVENT_FACTORY_ABI = [
  'function createEvent(string metadataURI, address host, address[] judges) returns (address)',
  'function fundEvent(address eventAddress, uint256 amount) payable',
  'function payout(address eventAddress, address[] winners, uint256[] amounts)',
];

// Minimal ABI for Event Instance contract
export const EVENT_INSTANCE_ABI = [
  'function distribute(address[] recipients, uint256[] amounts) payable',
  'function getBalance() view returns (uint256)',
  'event PayoutExecuted(address[] recipients, uint256[] amounts)',
];

export interface CreateEventParams {
  metadataURI: string;
  host: string;
  judges: string[];
}

export interface PayoutParams {
  eventAddress: string;
  winners: string[];
  amounts: string[];
}

export interface ContractResponse {
  success: boolean;
  txHash?: string;
  eventAddress?: string;
  error?: string;
}

