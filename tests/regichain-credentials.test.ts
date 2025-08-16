import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

/*
  RegiChain Credentials Contract Tests
  
  This test suite covers the complete functionality of the RegiChain credentials system:
  - SIP-009 NFT compliance
  - Issuer authorization system
  - Credential issuance and management
  - Revocation mechanisms
  - Verification functions
  - Batch operations
*/

describe("RegiChain Credentials Contract", () => {
  beforeEach(() => {
    // Reset simnet state before each test
  });

  describe("Issuer Authorization", () => {
    it("should initialize deployer as authorized issuer", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "is-authorized-issuer",
        [Cl.principal(deployer)],
        deployer
      );
      expect(result.result).toBeBool(true);
    });

    it("should allow owner to add authorized issuer", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify issuer was added
      const checkResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "is-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(checkResult.result).toBeBool(true);
    });

    it("should prevent non-owner from adding authorized issuer", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should allow owner to remove authorized issuer", () => {
      // First add an issuer
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );

      // Then remove it
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "remove-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify issuer was removed
      const checkResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "is-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(checkResult.result).toBeBool(false);
    });
  });

  describe("Credential Minting", () => {
    beforeEach(() => {
      // Add wallet1 as authorized issuer for tests
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
    });

    it("should mint credential with valid data", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),                    // recipient
          Cl.stringAscii("EU123456789"),            // euid
          Cl.stringAscii("DE"),                     // jurisdiction
          Cl.stringUtf8("German Business Registry"), // registry-source
          Cl.stringUtf8("Example GmbH"),            // legal-name
          Cl.stringAscii("HRB123456"),              // registration-number
          Cl.uint(1),                               // status (active)
          Cl.uint(1640995200),                      // incorporation-date
          Cl.some(Cl.uint(1672531200)),             // expiry-date
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // document-hash
        ],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(1)); // First token ID should be 1

      // Check that token was minted correctly
      const tokenData = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-credential-by-id",
        [Cl.uint(1)],
        deployer
      );
      expect(tokenData.result).toBeSome();
    });

    it("should prevent unauthorized issuer from minting", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet2 // wallet2 is not authorized
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-not-authorized-issuer
    });

    it("should prevent duplicate EUID", () => {
      // Mint first credential
      simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );

      // Try to mint with same EUID
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet3),
          Cl.stringAscii("EU123456789"), // Same EUID
          Cl.stringAscii("FR"),
          Cl.stringUtf8("French Business Registry"),
          Cl.stringUtf8("Example SARL"),
          Cl.stringAscii("FR123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.none(),
          Cl.bufferFromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
        ],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(104)); // err-token-already-exists
    });

    it("should validate jurisdiction format", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU987654321"),
          Cl.stringAscii("DEU"), // Invalid - should be 2 characters
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.none(),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(107)); // err-invalid-jurisdiction
    });

    it("should validate EUID is not empty", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii(""), // Empty EUID
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.none(),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(105)); // err-invalid-euid
    });
  });

  describe("Credential Verification", () => {
    beforeEach(() => {
      // Add wallet1 as authorized issuer and mint test credential
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
    });

    it("should verify valid credential by EUID", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "verify-credential",
        [Cl.stringAscii("EU123456789")],
        deployer
      );
      
      expect(result.result).toBeOk(
        Cl.tuple({
          "is-valid": Cl.bool(true),
          "status": Cl.uint(1),
          "jurisdiction": Cl.stringAscii("DE"),
          "legal-name": Cl.stringUtf8("Example GmbH"),
          "registration-number": Cl.stringAscii("HRB123456"),
          "issuer": Cl.principal(wallet1),
          "last-update": Cl.uint(simnet.blockHeight),
          "is-revoked": Cl.bool(false),
          "revocation-reason": Cl.uint(0)
        })
      );
    });

    it("should return error for non-existent credential", () => {
      const verifyResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "verify-credential",
        [Cl.stringAscii("EU999999999")],
        deployer
      );
      expect(verifyResult.result).toBeErr(Cl.uint(103)); // err-token-not-found
    });

    it("should get credential by token ID", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-credential-by-id",
        [Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeSome();
    });

    it("should get credential by EUID", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-credential-by-euid",
        [Cl.stringAscii("EU123456789")],
        deployer
      );
      expect(result.result).toBeSome();
    });
  });

  describe("Credential Revocation", () => {
    beforeEach(() => {
      // Setup: authorized issuer and test credential
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
    });

    it("should revoke credential with reason", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(1), Cl.uint(2)], // token-id: 1, reason: compliance-issue
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify credential is revoked
      const verifyResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "verify-credential",
        [Cl.stringAscii("EU123456789")],
        deployer
      );
      
      expect(verifyResult.result).toBeOk(
        Cl.tuple({
          "is-valid": Cl.bool(false),
          "status": Cl.uint(1),
          "jurisdiction": Cl.stringAscii("DE"),
          "legal-name": Cl.stringUtf8("Example GmbH"),
          "registration-number": Cl.stringAscii("HRB123456"),
          "issuer": Cl.principal(wallet1),
          "last-update": Cl.uint(simnet.blockHeight),
          "is-revoked": Cl.bool(true),
          "revocation-reason": Cl.uint(2)
        })
      );
    });

    it("should prevent unauthorized revocation", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(1), Cl.uint(1)],
        wallet2 // wallet2 is not authorized
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-not-authorized-issuer
    });

    it("should prevent double revocation", () => {
      // First revocation
      simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(1), Cl.uint(1)],
        wallet1
      );

      // Attempt second revocation
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(1), Cl.uint(2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(106)); // err-credential-revoked
    });

    it("should prevent revoking non-existent credential", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(999), Cl.uint(1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(103)); // err-token-not-found
    });
  });

  describe("Status Updates", () => {
    beforeEach(() => {
      // Setup: authorized issuer and test credential
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1), // status: active
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
    });

    it("should update credential status", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "update-credential-status",
        [Cl.uint(1), Cl.uint(3)], // token-id: 1, new-status: suspended
        wallet1
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify status was updated
      const verifyResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "verify-credential",
        [Cl.stringAscii("EU123456789")],
        deployer
      );
      
      expect(verifyResult.result).toBeOk(
        Cl.tuple({
          "is-valid": Cl.bool(true),
          "status": Cl.uint(3),
          "jurisdiction": Cl.stringAscii("DE"),
          "legal-name": Cl.stringUtf8("Example GmbH"),
          "registration-number": Cl.stringAscii("HRB123456"),
          "issuer": Cl.principal(wallet1),
          "last-update": Cl.uint(simnet.blockHeight),
          "is-revoked": Cl.bool(false),
          "revocation-reason": Cl.uint(0)
        })
      );
    });

    it("should prevent unauthorized status update", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "update-credential-status",
        [Cl.uint(1), Cl.uint(2)],
        wallet2 // wallet2 is not authorized
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-not-authorized-issuer
    });

    it("should prevent updating revoked credential status", () => {
      // First revoke the credential
      simnet.callPublicFn(
        "regichain-credentials",
        "revoke-credential",
        [Cl.uint(1), Cl.uint(1)],
        wallet1
      );

      // Try to update status
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "update-credential-status",
        [Cl.uint(1), Cl.uint(2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(106)); // err-credential-revoked
    });
  });

  describe("SIP-009 Compliance", () => {
    beforeEach(() => {
      // Setup: mint test credential
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "regichain-credentials",
        "mint-credential",
        [
          Cl.principal(wallet2),
          Cl.stringAscii("EU123456789"),
          Cl.stringAscii("DE"),
          Cl.stringUtf8("German Business Registry"),
          Cl.stringUtf8("Example GmbH"),
          Cl.stringAscii("HRB123456"),
          Cl.uint(1),
          Cl.uint(1640995200),
          Cl.some(Cl.uint(1672531200)),
          Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        ],
        wallet1
      );
    });

    it("should get last token ID", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-last-token-id",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(1));
    });

    it("should get token owner", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.some(Cl.principal(wallet2)));
    });

    it("should get token balance", () => {
      const result = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result.result).toBeUint(1);
    });

    it("should transfer token", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "transfer",
        [Cl.uint(1), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify new owner
      const ownerResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(ownerResult.result).toBeOk(Cl.some(Cl.principal(wallet3)));

      // Verify balance changes
      const oldOwnerBalance = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(oldOwnerBalance.result).toBeUint(0);

      const newOwnerBalance = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-balance",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(newOwnerBalance.result).toBeUint(1);
    });

    it("should prevent unauthorized transfer", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "transfer",
        [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet3)],
        wallet1 // wallet1 is not the owner
      );
      expect(result.result).toBeErr(Cl.uint(101)); // err-not-token-owner
    });
  });

  describe("Batch Operations", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "regichain-credentials",
        "add-authorized-issuer",
        [Cl.principal(wallet1)],
        deployer
      );
    });

    it("should batch mint multiple credentials", () => {
      const credentials = [
        Cl.tuple({
          recipient: Cl.principal(wallet2),
          euid: Cl.stringAscii("EU111111111"),
          jurisdiction: Cl.stringAscii("DE"),
          "registry-source": Cl.stringUtf8("German Registry"),
          "legal-name": Cl.stringUtf8("Company One GmbH"),
          "registration-number": Cl.stringAscii("HRB111111"),
          status: Cl.uint(1),
          "incorporation-date": Cl.uint(1640995200),
          "expiry-date": Cl.none(),
          "document-hash": Cl.bufferFromHex("1111111111111111111111111111111111111111111111111111111111111111")
        }),
        Cl.tuple({
          recipient: Cl.principal(wallet3),
          euid: Cl.stringAscii("EU222222222"),
          jurisdiction: Cl.stringAscii("FR"),
          "registry-source": Cl.stringUtf8("French Registry"),
          "legal-name": Cl.stringUtf8("Company Two SARL"),
          "registration-number": Cl.stringAscii("FR222222"),
          status: Cl.uint(1),
          "incorporation-date": Cl.uint(1640995200),
          "expiry-date": Cl.none(),
          "document-hash": Cl.bufferFromHex("2222222222222222222222222222222222222222222222222222222222222222")
        })
      ];

      const result = simnet.callPublicFn(
        "regichain-credentials",
        "batch-mint-credentials",
        [Cl.list(credentials)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.list([Cl.ok(Cl.uint(1)), Cl.ok(Cl.uint(2))]));

      // Verify both credentials were minted
      const cred1 = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-credential-by-euid",
        [Cl.stringAscii("EU111111111")],
        deployer
      );
      expect(cred1.result).toBeSome();

      const cred2 = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-credential-by-euid",
        [Cl.stringAscii("EU222222222")],
        deployer
      );
      expect(cred2.result).toBeSome();
    });
  });

  describe("Contract Management", () => {
    it("should set contract URI", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "set-contract-uri",
        [Cl.some(Cl.stringUtf8("https://api.regichain.eu/metadata"))],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify URI was set
      const uriResult = simnet.callReadOnlyFn(
        "regichain-credentials",
        "get-contract-uri",
        [],
        deployer
      );
      expect(uriResult.result).toBeSome(Cl.stringUtf8("https://api.regichain.eu/metadata"));
    });

    it("should prevent non-owner from setting contract URI", () => {
      const result = simnet.callPublicFn(
        "regichain-credentials",
        "set-contract-uri",
        [Cl.some(Cl.stringUtf8("https://malicious.com"))],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100)); // err-owner-only
    });
  });
});
