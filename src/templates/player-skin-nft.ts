import { SkinMinted as SkinMintedEvent } from "../../generated/templates/PlayerSkinNFT/PlayerSkinNFT";
import { Skin, SkinCollection } from "../../generated/schema";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";
import { getCollectionIdForAddress } from "../utils/registry-utils";
import { updateStatsForSkinCreation } from "../utils/stats-utils";

export function handleSkinMinted(event: SkinMintedEvent): void {
  // Get the skin collection ID for this contract
  const contractAddress = event.address;
  const collectionId = getCollectionIdForAddress(contractAddress);
  
  if (!collectionId) {
    log.warning("Unknown skin contract: {}", [contractAddress.toHexString()]);
    return;
  }
  
  // Create a unique ID for the skin
  const tokenId = event.params.tokenId;
  const skinId = collectionId.toString() + "-" + tokenId.toString();
  
  // Check if the skin already exists (it shouldn't, but just in case)
  let skin = Skin.load(skinId);
  
  // If the skin doesn't exist, create it
  if (!skin) {
    skin = new Skin(skinId);
    skin.tokenId = tokenId;
    skin.collection = collectionId.toString();
    
    // Set attributes from the event
    skin.weapon = event.params.weapon;
    skin.armor = event.params.armor;
    skin.metadataURI = ""; // To be filled later if needed
    
    skin.save();
    
    // Update stats with the current timestamp
    updateStatsForSkinCreation(event.block.timestamp);
    
    log.info("Skin minted: collection {}, token {}", [
      collectionId.toString(),
      tokenId.toString()
    ]);
  }
}
