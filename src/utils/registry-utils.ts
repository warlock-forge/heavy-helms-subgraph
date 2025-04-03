import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { SkinAddressMapping, Skin, SkinCollection } from "../../generated/schema";

// Store a mapping from contract address to collection ID
export function storeCollectionIdForAddress(address: Address, registryId: BigInt): void {
  let id = address.toHexString();
  let mapping = new SkinAddressMapping(id);
  mapping.registryId = registryId;
  mapping.contractAddress = address;
  mapping.save();
}

// Get collection ID for a given contract address
export function getCollectionIdForAddress(address: Address): BigInt | null {
  let id = address.toHexString();
  let mapping = SkinAddressMapping.load(id);
  
  if (mapping) {
    return mapping.registryId;
  }
  
  return null;
}

// Process IPFS URIs to make them more frontend-friendly
export function processMetadataURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    // Convert IPFS URI to HTTP gateway URL
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
}
