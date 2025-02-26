import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';
import * as cbor from 'cbor';

// This endpoint is required by the ic-siwe-js library to check the status of the Internet Computer
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Create an agent to connect to the local Internet Computer replica
    const agent = new HttpAgent({
      host: process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943',
    });

    // Fetch the root key since we're connecting to a local replica
    if (process.env.DFX_NETWORK !== 'ic') {
      await agent.fetchRootKey();
    }

    // Get the status directly from the agent
    const status = await agent.status();

    // Convert the status to CBOR format
    const cborData = cbor.encode(status);
    
    // Set the content type to application/cbor
    res.setHeader('Content-Type', 'application/cbor');
    res.status(200).send(Buffer.from(cborData));
  } catch (error) {
    console.error('Error fetching IC status:', error);
    res.status(500).json({ error: 'Failed to fetch IC status' });
  }
}
