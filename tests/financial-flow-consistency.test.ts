import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertTransferPairIntegrity,
  calculateAccountBalance,
  getTransferDestinationAccountId,
} from "../src/domain/accounts";

describe("financial flow consistency", () => {
  it("selects a different default destination for a new transfer", () => {
    assert.equal(
      getTransferDestinationAccountId(["cash", "bank"], "cash"),
      "bank",
    );
  });

  it("keeps a valid destination but replaces one that matches the source", () => {
    assert.equal(
      getTransferDestinationAccountId(["cash", "bank", "wallet"], "cash", "wallet"),
      "wallet",
    );
    assert.equal(
      getTransferDestinationAccountId(["cash", "bank", "wallet"], "bank", "bank"),
      "cash",
    );
  });

  it("returns no destination when fewer than two active accounts exist", () => {
    assert.equal(getTransferDestinationAccountId(["cash"], "cash"), "");
    assert.equal(getTransferDestinationAccountId([], ""), "");
  });

  const validPair = [
    { accountId: "cash", amountMinor: 2_500, transferDirection: "out" as const },
    { accountId: "bank", amountMinor: 2_500, transferDirection: "in" as const },
  ];

  it("accepts a balanced transfer pair across two accounts", () => {
    assert.doesNotThrow(() => assertTransferPairIntegrity(validPair));
  });

  it("preserves the combined balance across a transfer", () => {
    const sourceBefore = calculateAccountBalance(10_000, []);
    const destinationBefore = calculateAccountBalance(5_000, []);
    const sourceAfter = calculateAccountBalance(sourceBefore, [
      { type: "transfer", amountMinor: 2_500, transferDirection: "out" },
    ]);
    const destinationAfter = calculateAccountBalance(destinationBefore, [
      { type: "transfer", amountMinor: 2_500, transferDirection: "in" },
    ]);

    assert.equal(sourceAfter + destinationAfter, sourceBefore + destinationBefore);
  });

  it("rejects a transfer with a missing side", () => {
    assert.throws(
      () => assertTransferPairIntegrity(validPair.slice(0, 1)),
      /exactly one outgoing and one incoming/,
    );
  });

  it("rejects duplicate directions", () => {
    assert.throws(
      () => assertTransferPairIntegrity([
        validPair[0],
        { ...validPair[1], transferDirection: "out" },
      ]),
      /exactly one outgoing and one incoming/,
    );
  });

  it("rejects mismatched amounts", () => {
    assert.throws(
      () => assertTransferPairIntegrity([
        validPair[0],
        { ...validPair[1], amountMinor: 2_499 },
      ]),
      /same positive amount/,
    );
  });

  it("rejects entries assigned to the same account", () => {
    assert.throws(
      () => assertTransferPairIntegrity([
        validPair[0],
        { ...validPair[1], accountId: "cash" },
      ]),
      /different accounts/,
    );
  });
});
