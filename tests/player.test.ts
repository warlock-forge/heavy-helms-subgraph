import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { AttributeSwapAwarded } from "../generated/schema"
import { AttributeSwapAwarded as AttributeSwapAwardedEvent } from "../generated/Player/Player"
import { handleAttributeSwapAwarded } from "../src/player"
import { createAttributeSwapAwardedEvent } from "./player-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let to = Address.fromString("0x0000000000000000000000000000000000000001")
    let totalCharges = BigInt.fromI32(234)
    let newAttributeSwapAwardedEvent = createAttributeSwapAwardedEvent(
      to,
      totalCharges
    )
    handleAttributeSwapAwarded(newAttributeSwapAwardedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AttributeSwapAwarded created and stored", () => {
    assert.entityCount("AttributeSwapAwarded", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AttributeSwapAwarded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "to",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "AttributeSwapAwarded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "totalCharges",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
