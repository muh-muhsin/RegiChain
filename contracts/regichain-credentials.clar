;; RegiChain Credentials Contract
;; Implements SIP-009 NFT standard for EU business registry credentials
;; Provides verifiable, cross-border business registry credentials as on-chain NFTs

;; Define NFT
(define-non-fungible-token regichain-credential uint)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-not-authorized-issuer (err u102))
(define-constant err-token-not-found (err u103))
(define-constant err-token-already-exists (err u104))
(define-constant err-invalid-euid (err u105))
(define-constant err-credential-revoked (err u106))
(define-constant err-invalid-jurisdiction (err u107))

;; Data Variables
(define-data-var token-id-nonce uint u1)
(define-data-var contract-uri (optional (string-utf8 256)) none)

;; Company Status Enum
(define-constant status-active u1)
(define-constant status-dissolved u2)
(define-constant status-suspended u3)
(define-constant status-liquidation u4)
(define-constant status-merged u5)

;; Revocation Reason Enum
(define-constant revocation-none u0)
(define-constant revocation-registry-update u1)
(define-constant revocation-compliance-issue u2)
(define-constant revocation-data-correction u3)
(define-constant revocation-merger-acquisition u4)
(define-constant revocation-dissolution u5)

;; Data Maps
(define-map tokens uint {
    owner: principal,
    euid: (string-ascii 64),
    jurisdiction: (string-ascii 2),
    registry-source: (string-utf8 128),
    legal-name: (string-utf8 256),
    registration-number: (string-ascii 64),
    status: uint,
    incorporation-date: uint,
    last-update: uint,
    expiry-date: (optional uint),
    document-hash: (buff 32),
    issuer: principal,
    is-revoked: bool,
    revocation-reason: uint,
    revocation-date: (optional uint)
})

(define-map token-by-euid (string-ascii 64) uint)
(define-map token-count principal uint)
(define-map authorized-issuers principal bool)

;; Authorization Functions
(define-public (add-authorized-issuer (issuer principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map-set authorized-issuers issuer true))
    )
)

(define-public (remove-authorized-issuer (issuer principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map-delete authorized-issuers issuer))
    )
)

(define-read-only (is-authorized-issuer (issuer principal))
    (default-to false (map-get? authorized-issuers issuer))
)

;; Core NFT Functions (SIP-009)
(define-read-only (get-last-token-id)
    (ok (- (var-get token-id-nonce) u1))
)

(define-read-only (get-token-uri (token-id uint))
    (ok (var-get contract-uri))
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? regichain-credential token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        (asserts! (is-some (map-get? tokens token-id)) err-token-not-found)
        (try! (nft-transfer? regichain-credential token-id sender recipient))
        (map-set tokens token-id 
            (merge (unwrap! (map-get? tokens token-id) err-token-not-found) 
                   {owner: recipient}))
        (map-set token-count sender 
            (- (get-balance sender) u1))
        (map-set token-count recipient 
            (+ (get-balance recipient) u1))
        (print {type: "transfer", token-id: token-id, sender: sender, recipient: recipient})
        (ok true)
    )
)

;; Credential Issuance
(define-public (mint-credential 
    (recipient principal)
    (euid (string-ascii 64))
    (jurisdiction (string-ascii 2))
    (registry-source (string-utf8 128))
    (legal-name (string-utf8 256))
    (registration-number (string-ascii 64))
    (status uint)
    (incorporation-date uint)
    (expiry-date (optional uint))
    (document-hash (buff 32))
)
    (let 
        (
            (token-id (var-get token-id-nonce))
        )
        (asserts! (is-authorized-issuer tx-sender) err-not-authorized-issuer)
        (asserts! (is-none (map-get? token-by-euid euid)) err-token-already-exists)
        (asserts! (> (len euid) u0) err-invalid-euid)
        (asserts! (is-eq (len jurisdiction) u2) err-invalid-jurisdiction)
        
        (try! (nft-mint? regichain-credential token-id recipient))
        (map-set tokens token-id {
            owner: recipient,
            euid: euid,
            jurisdiction: jurisdiction,
            registry-source: registry-source,
            legal-name: legal-name,
            registration-number: registration-number,
            status: status,
            incorporation-date: incorporation-date,
            last-update: stacks-block-height,
            expiry-date: expiry-date,
            document-hash: document-hash,
            issuer: tx-sender,
            is-revoked: false,
            revocation-reason: revocation-none,
            revocation-date: none
        })
        
        (map-set token-by-euid euid token-id)
        (map-set token-count recipient (+ (get-balance recipient) u1))
        (var-set token-id-nonce (+ token-id u1))
        
        (print {
            type: "mint",
            token-id: token-id,
            recipient: recipient,
            euid: euid,
            jurisdiction: jurisdiction,
            issuer: tx-sender
        })
        
        (ok token-id)
    )
)

;; Credential Revocation
(define-public (revoke-credential (token-id uint) (reason uint))
    (let 
        (
            (token-data (unwrap! (map-get? tokens token-id) err-token-not-found))
        )
        (asserts! (is-authorized-issuer tx-sender) err-not-authorized-issuer)
        (asserts! (not (get is-revoked token-data)) err-credential-revoked)
        
        (map-set tokens token-id 
            (merge token-data {
                is-revoked: true,
                revocation-reason: reason,
                revocation-date: (some stacks-block-height),
                last-update: stacks-block-height
            }))
        
        (print {
            type: "revoke",
            token-id: token-id,
            reason: reason,
            issuer: tx-sender,
            euid: (get euid token-data)
        })
        
        (ok true)
    )
)

;; Update credential status (for registry synchronization)
(define-public (update-credential-status (token-id uint) (new-status uint))
    (let 
        (
            (token-data (unwrap! (map-get? tokens token-id) err-token-not-found))
        )
        (asserts! (is-authorized-issuer tx-sender) err-not-authorized-issuer)
        (asserts! (not (get is-revoked token-data)) err-credential-revoked)
        
        (map-set tokens token-id 
            (merge token-data {
                status: new-status,
                last-update: stacks-block-height
            }))
        
        (print {
            type: "status-update",
            token-id: token-id,
            old-status: (get status token-data),
            new-status: new-status,
            issuer: tx-sender,
            euid: (get euid token-data)
        })
        
        (ok true)
    )
)

;; Verification Functions
(define-read-only (get-credential-by-id (token-id uint))
    (map-get? tokens token-id)
)

(define-read-only (get-credential-by-euid (euid (string-ascii 64)))
    (match (map-get? token-by-euid euid)
        token-id (map-get? tokens token-id)
        none
    )
)

(define-read-only (verify-credential (euid (string-ascii 64)))
    (match (get-credential-by-euid euid)
        credential (ok {
            is-valid: (not (get is-revoked credential)),
            status: (get status credential),
            jurisdiction: (get jurisdiction credential),
            legal-name: (get legal-name credential),
            registration-number: (get registration-number credential),
            issuer: (get issuer credential),
            last-update: (get last-update credential),
            is-revoked: (get is-revoked credential),
            revocation-reason: (get revocation-reason credential)
        })
        err-token-not-found
    )
)

(define-read-only (get-balance (account principal))
    (default-to u0 (map-get? token-count account))
)

;; Utility Functions
(define-public (set-contract-uri (uri (optional (string-utf8 256))))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set contract-uri uri)
        (ok true)
    )
)

(define-read-only (get-contract-uri)
    (var-get contract-uri)
)

;; Batch Operations (for high-volume processing)
(define-public (batch-mint-credentials 
    (credentials (list 50 {
        recipient: principal,
        euid: (string-ascii 64),
        jurisdiction: (string-ascii 2),
        registry-source: (string-utf8 128),
        legal-name: (string-utf8 256),
        registration-number: (string-ascii 64),
        status: uint,
        incorporation-date: uint,
        expiry-date: (optional uint),
        document-hash: (buff 32)
    }))
)
    (begin
        (asserts! (is-authorized-issuer tx-sender) err-not-authorized-issuer)
        (ok (map mint-single-credential credentials))
    )
)

(define-private (mint-single-credential (credential {
    recipient: principal,
    euid: (string-ascii 64),
    jurisdiction: (string-ascii 2),
    registry-source: (string-utf8 128),
    legal-name: (string-utf8 256),
    registration-number: (string-ascii 64),
    status: uint,
    incorporation-date: uint,
    expiry-date: (optional uint),
    document-hash: (buff 32)
}))
    (mint-credential 
        (get recipient credential)
        (get euid credential)
        (get jurisdiction credential)
        (get registry-source credential)
        (get legal-name credential)
        (get registration-number credential)
        (get status credential)
        (get incorporation-date credential)
        (get expiry-date credential)
        (get document-hash credential)
    )
)

;; Initialize contract owner as first authorized issuer
(map-set authorized-issuers contract-owner true)
