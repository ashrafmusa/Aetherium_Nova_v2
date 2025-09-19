
import { sha256 } from 'js-sha256';
import elliptic from 'elliptic';
import type { Transaction, Block } from './types';

const ec = new elliptic.ec('secp256k1');

export const generateKeyPair = (): { publicKey: string; secretKey: string } => {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic('hex');
  const secretKey = keyPair.getPrivate('hex');
  return { publicKey, secretKey };
};

export const getTransactionHash = (tx: Omit<Transaction, 'hash' | 'signature'>): string => {
  const txString = `${tx.from}${tx.to}${tx.amount}${tx.timestamp}${tx.type}`;
  return sha256(txString);
};

export const sign = (hash: string, secretKey: string): string => {
  const key = ec.keyFromPrivate(secretKey, 'hex');
  const signature = key.sign(hash, 'base64');
  return signature.toDER('hex');
};

export const verify = (hash: string, signature: string, publicKey: string): boolean => {
  try {
    const key = ec.keyFromPublic(publicKey, 'hex');
    return key.verify(hash, signature);
  } catch (error) {
    return false;
  }
};

export const getBlockHash = (block: Omit<Block, 'hash' | 'validatorSignature'>): string => {
  const blockString = `${block.index}${block.timestamp}${block.previousHash}${block.merkleRoot}${block.validator}`;
  return sha256(blockString);
};

export const calculateMerkleRoot = (transactions: Transaction[]): string => {
  if (transactions.length === 0) {
    return '0'.repeat(64);
  }
  let tree = transactions.map(tx => tx.hash);
  while (tree.length > 1) {
    let nextLevel: string[] = [];
    for (let i = 0; i < tree.length; i += 2) {
      if (i + 1 === tree.length) {
        nextLevel.push(sha256(tree[i] + tree[i]));
      } else {
        nextLevel.push(sha256(tree[i] + tree[i + 1]));
      }
    }
    tree = nextLevel;
  }
  return tree[0];
};
