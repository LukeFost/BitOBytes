# BitOBytes Development Guidelines

## Build Commands
- `dfx start --clean --background` - Start local ICP replica
- `dfx deploy` - Deploy all canisters locally
- `cd src/bitobytes_frontend && npm run dev` - Start Next.js dev server
- `cd src/bitobytes_frontend && npm run lint` - Run ESLint
- `dfx canister call bitobytes_backend getVideos` - Test canister query
- `dfx deploy --network ic` - Deploy to IC mainnet

## Code Style Guidelines
- **TypeScript**: Use strong typing with interfaces and type annotations
- **React**: Use functional components with hooks, avoid class components
- **Imports**: Group imports by source (React, Next.js, utils, components)
- **Naming**: PascalCase for components, camelCase for variables and functions
- **Error Handling**: Use try/catch for async operations with specific error messages
- **Motoko**: Group related functions, use descriptive variable names
- **Frontend**: Use Tailwind classes for styling
- **Authentication**: Implement auth guards for protected routes

## Project Structure
- Backend in `src/bitobytes_backend` (Motoko)
- Frontend in `src/bitobytes_frontend` (Next.js with TypeScript)
- IPFS node integration in `src/helia_node`