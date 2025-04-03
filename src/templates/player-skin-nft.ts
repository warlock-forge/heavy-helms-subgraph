import { SkinMinted as SkinMintedEvent, PlayerSkinNFT } from "../../generated/templates/PlayerSkinNFT/PlayerSkinNFT";
import { Skin } from "../../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";
import { getCollectionIdForAddress, processMetadataURI } from "../utils/registry-utils";
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
    
    // Always set metadataURI to an empty string first
    skin.metadataURI = "";
    
    // Get the tokenURI directly from the contract
    const nftContract = PlayerSkinNFT.bind(contractAddress);
    const tokenURIResult = nftContract.try_tokenURI(BigInt.fromI32(tokenId));
    
    // Store the result in a local variable to avoid nullability issues
    let metadataURIValue = "";
    
    if (!tokenURIResult.reverted) {
      metadataURIValue = processMetadataURI(tokenURIResult.value);
      skin.metadataURI = metadataURIValue;
      log.info("Set metadata URI for skin {}: {}", [skinId, metadataURIValue]);
    } else {
      log.warning("Failed to get tokenURI for skin: {}", [skinId]);
    }
    
    skin.save();
    
    // Update stats with the current timestamp
    updateStatsForSkinCreation(event.block.timestamp);
    
    // Use the local variable (which is guaranteed to be a string)
    log.info("Skin minted: collection {}, token {}, metadata: {}", [
      collectionId.toString(),
      tokenId.toString(),
      metadataURIValue
    ]);
  }
}
