import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { canisterId } = req.query;
    
    if (!canisterId || typeof canisterId !== 'string') {
      return res.status(400).json({ error: 'Invalid canister ID' });
    }

    // Log the request details for debugging
    console.log(`[API read_state] Processing request for canister: ${canisterId}`);
    
    // Determine the host based on environment
    const host = process.env.NODE_ENV === 'production'
      ? 'https://ic0.app'
      : process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    console.log(`[API read_state] Using host: ${host}`);
    
    const agent = new HttpAgent({ 
      host,
      verifyQuerySignatures: false,
      fetchOptions: {
        credentials: 'omit',
      },
    });

    // Fetch the root key for local development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      try {
        await agent.fetchRootKey();
        console.log('[API read_state] Root key fetched successfully');
      } catch (err) {
        console.error('[API read_state] Failed to fetch root key:', err);
        return res.status(500).json({ 
          error: 'Failed to fetch root key',
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Forward the request to the IC
    const url = `${agent.host}/api/v2/canister/${canisterId}/read_state`;
    console.log(`[API read_state] Forwarding request to: ${url}`);
    
    // Check if the canister ID is the management canister
    const siweCanisterId = process.env.NEXT_PUBLIC_SIWE_CANISTER_ID;
    if (canisterId === 'ryjl3-tyaaa-aaaaa-aaaba-cai') {
      console.log(`[API read_state] Request is for management canister, redirecting to SIWE provider (${siweCanisterId})`);
      if (!siweCanisterId) {
        console.error('[API read_state] NEXT_PUBLIC_SIWE_CANISTER_ID is not set! Cannot redirect management canister request.');
        return res.status(500).json({ 
          error: 'SIWE canister ID not configured',
          message: 'The SIWE canister ID is not set in the environment variables. Please run ./deploy-rust-siwe.sh to deploy the SIWE provider.'
        });
      }
      
      console.log(`[API read_state] Redirecting to SIWE canister: ${siweCanisterId}`);
      try {
        const redirectUrl = `${agent.host}/api/v2/canister/${siweCanisterId}/read_state`;
        console.log(`[API read_state] Redirect URL: ${redirectUrl}`);
        
        const response = await fetch(redirectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/cbor',
          },
          body: req.body,
        });
        
        // Log the response status
        console.log(`[API read_state] Redirected response status: ${response.status}`);
        
        // Get the response data
        const data = await response.arrayBuffer();
        
        // Set the content type to match the response
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
        
        // Send the response
        return res.status(response.status).send(Buffer.from(data));
      } catch (error) {
        console.error('[API read_state] Error redirecting to SIWE canister:', error);
        return res.status(500).json({ 
          error: 'Failed to redirect to SIWE canister',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cbor',
      },
      body: req.body,
    });

    // Log the response status
    console.log(`[API read_state] Response status: ${response.status}`);
    
    // If the response is not successful, try to get more details
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not extract error text';
      }
      console.error(`[API read_state] Error response: ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Error from IC replica', 
        status: response.status,
        details: errorText
      });
    }

    // Get the response data
    const data = await response.arrayBuffer();
    
    // Set the content type to match the response
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
    
    // Send the response
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[API read_state] Error proxying request:', error);
    res.status(500).json({ 
      error: 'Failed to proxy read_state request',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
