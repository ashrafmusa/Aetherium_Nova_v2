


// =============================================================================
// GENESIS VALIDATORS
// These are the initial nodes that will be part of the network from the start.
// In a real-world scenario, these would be well-known and trusted entities.
// =============================================================================
export const INITIAL_VALIDATORS = [
    {
        name: 'Aetherium Foundation Node 1',
        publicKey: '04a1a5c4f31697a1b73d2029f1a27c4351563e4671f2f3213a7a1a7c81d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
        apr: 12.5, // Annual Percentage Rate for staking rewards
    },
    {
        name: 'Quantum Leap Ventures Node',
        publicKey: '04b1b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
        apr: 11.9,
    },
    {
        name: 'Decentralized Future Alliance',
        publicKey: '04c1c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
        apr: 13.1,
    },
];

// =============================================================================
// GENESIS WALLETS
// Pre-funded wallets for testing and initial distribution.
// In a live network, token distribution would happen via a token sale, airdrop, etc.
// =============================================================================
export const INITIAL_WALLETS = [
    {
        publicKey: '04d1d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
        balance: 1000000, // A large balance for a "treasury" or "foundation" wallet
    },
    {
        publicKey: '04e1e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        balance: 50000, // An early investor or team member wallet
    },
];