import { 
  SkinMinted as SkinMintedEvent,
  CIDUpdated as CIDUpdatedEvent,
  SkinAttributesUpdated as SkinAttributesUpdatedEvent,
  GameOwnedNFT
} from "../../generated/templates/GameOwnedNFT/GameOwnedNFT";
import { Skin, SkinCollection } from "../../generated/schema";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";
import { getCollectionIdForAddress, processMetadataURI } from "../utils/registry-utils";
import { updateStatsForSkinCreation } from "../utils/stats-utils";

export function handleSkinMinted(event: SkinMintedEvent): void {
  const contractAddress = event.address;
  const collectionIdResult = getCollectionIdForAddress(contractAddress);
  
  if (!collectionIdResult) {
    log.warning("handleSkinMinted: Unknown skin contract address mapping: {}", [contractAddress.toHexString()]);
    return;
  }
  let collectionId: BigInt = collectionIdResult;
  let collectionIdString = collectionId.toString();

  let tokenId_i32 = event.params.tokenId;
  let tokenIdString = tokenId_i32.toString();

  const skinId = collectionIdString + "-" + tokenIdString;
  
  log.info("handleSkinMinted: Processing Skin ID (collectionId-tokenId): {}, Collection: {}, Token: {}", [
    skinId,
    collectionIdString,
    tokenIdString
  ]);

  let skin = Skin.load(skinId);
  let isNew = false;
  
  if (!skin) {
    log.info("handleSkinMinted: Skin {} not found, creating new entity.", [skinId]);
    skin = new Skin(skinId);
    skin.collection = collectionIdString;
    skin.metadataURI = "";
    isNew = true;
  } else {
    log.info("handleSkinMinted: Found existing Skin {}, updating.", [skinId]);
    skin.collection = collectionIdString;
  }
  
  skin.tokenId = tokenId_i32;
  skin.weapon = event.params.weapon;
  skin.armor = event.params.armor;
  
  const nftContract = GameOwnedNFT.bind(contractAddress);
  const tokenURIResult = nftContract.try_tokenURI(BigInt.fromI32(tokenId_i32));
  
  let metadataURIValue = "";
  
  if (!tokenURIResult.reverted) {
    metadataURIValue = processMetadataURI(tokenURIResult.value);
    skin.metadataURI = metadataURIValue;
    log.info("handleSkinMinted: Set metadata URI for skin {}: {}", [skinId, metadataURIValue]);
  } else {
    log.warning("handleSkinMinted: Failed to get tokenURI for skin: {}", [skinId]);
    if (isNew) {
      skin.metadataURI = "";
    }
  }

  log.info("handleSkinMinted: Saving Skin {} with weapon: {}, armor: {}", [
    skinId,
    skin.weapon.toString(),
    skin.armor.toString()
  ]);
  skin.save();
  
  if (isNew) {
    log.info("handleSkinMinted: Skin {} was newly created. Updating stats.", [skinId]);
    updateStatsForSkinCreation(event.block.timestamp);
  }
  
  log.info("Game owned skin {}: id {}, collection {}, token {}, metadata: {}", [
    isNew ? "CREATED" : "UPDATED",
    skinId,
    collectionIdString,
    tokenIdString,
    skin.metadataURI ? skin.metadataURI! : "null"
  ]);
}

export function handleCIDUpdated(event: CIDUpdatedEvent): void {
  const contractAddress = event.address;
  const collectionIdResult = getCollectionIdForAddress(contractAddress);
  
  if (!collectionIdResult) {
    log.warning("handleCIDUpdated: Unknown skin contract address mapping: {}", [contractAddress.toHexString()]);
    return;
  }
  
  let collectionIdString = collectionIdResult.toString();
  
  const tokenId_i32 = event.params.tokenId;
  let tokenIdString = tokenId_i32.toString();
  const skinId = collectionIdString + "-" + tokenIdString;
  
  log.info("handleCIDUpdated: Processing Skin ID (collectionId-tokenId): {}", [skinId]);
  let skin = Skin.load(skinId);
  if (skin) {
    const ipfsURI = "ipfs://" + event.params.newCID;
    const processedURI = processMetadataURI(ipfsURI);
    skin.metadataURI = processedURI;
    skin.save();
    log.info("handleCIDUpdated: Updated CID for skin {}: {}", [skinId, processedURI]);
  } else {
    log.warning("handleCIDUpdated: Skin not found using ID {}. Cannot update CID.", [skinId]);
  }
}

export function handleSkinAttributesUpdated(event: SkinAttributesUpdatedEvent): void {
  const contractAddress = event.address;
  const collectionIdResult = getCollectionIdForAddress(contractAddress);
  
  if (!collectionIdResult) {
     log.warning("handleSkinAttributesUpdated: Unknown skin contract address mapping: {}", [contractAddress.toHexString()]);
     return;
  }
  
  let collectionIdString = collectionIdResult.toString();
  
  const tokenId_i32 = event.params.tokenId;
  let tokenIdString = tokenId_i32.toString();
  const skinId = collectionIdString + "-" + tokenIdString;
  
  log.info("handleSkinAttributesUpdated: Processing Skin ID (collectionId-tokenId): {}", [skinId]);
  let skin = Skin.load(skinId);
  if (skin) {
    skin.weapon = event.params.weapon;
    skin.armor = event.params.armor;
    skin.save();
    
    log.info("handleSkinAttributesUpdated: Updated attributes for skin {}: weapon={}, armor={}", [
      skinId, 
      event.params.weapon.toString(),
      event.params.armor.toString()
    ]);
  } else {
    log.warning("handleSkinAttributesUpdated: Skin not found using ID {}. Cannot update attributes.", [skinId]);
  }
}
