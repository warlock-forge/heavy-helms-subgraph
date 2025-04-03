import { log } from "@graphprotocol/graph-ts";
import { Name } from "../../generated/schema";

/**
 * Loads a fighter's first name based on index
 * @returns The name string or null if not found
 */
export function loadFirstName(firstNameIndex: i32, isMonster: boolean = false): string | null {
  // Determine name type based on entity type and index
  let nameType: i32;
  
  if (isMonster) {
    nameType = 3; // Monster names
  } else {
    nameType = firstNameIndex >= 1000 ? 0 : 1; // Player name sets
  }
  
  const firstNameId = nameType.toString() + "-" + firstNameIndex.toString();
  log.info("Looking for first name - FirstNameId: {}", [firstNameId]);
  
  const firstName = Name.load(firstNameId);
  return firstName ? firstName.value : null;
}

/**
 * Loads a fighter's surname based on index
 * @returns The surname string or null if not found
 */
export function loadSurname(surnameIndex: i32): string | null {
  const surnameId = "2-" + surnameIndex.toString();
  log.info("Looking for surname - SurnameId: {}", [surnameId]);
  
  const surname = Name.load(surnameId);
  return surname ? surname.value : null;
}

/**
 * Creates a full name from first name and surname
 */
export function createFullName(firstName: string | null, surname: string | null): string | null {
  if (firstName == null) return null;
  
  // AssemblyScript requires explicit null checks
  if (surname == null) return firstName;
  
  // Now that we've verified neither is null, we can safely concatenate
  const firstNameStr = firstName as string;
  const surnameStr = surname as string;
  return firstNameStr + " " + surnameStr;
}
