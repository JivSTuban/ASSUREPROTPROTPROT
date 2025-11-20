# GAssure Escrow - Project Analysis & Development Guide

## Project Overview

**GAssure Escrow** is a prototype escrow payment system built as a React + TypeScript web application. It simulates a peer-to-peer transaction system where buyers and sellers can conduct secure transactions with protection windows, similar to a GCash-style mobile wallet application.

### Core Concept

The application implements an **escrow service** where:
- **Buyers** create transactions, send money to an escrow wallet, and confirm receipt of goods/services
- **Sellers** receive transaction invitations, approve transactions, and confirm delivery
- A **protection window** provides a time period for dispute resolution before funds are automatically released
- **Transaction fees** are deducted from buyers
- **Hold amounts** are deducted from sellers as a security deposit

### Key Features

1. **Dual-User System**: Supports both buyer and seller perspectives with separate wallet balances
2. **Transaction Lifecycle**:
   - Buyer creates transaction with amount, description, seller phone number, and protection window expiry date
   - Seller receives pending transaction invitation
   - Seller approves/rejects transaction (₱100 transaction fee deducted from buyer on approval)
   - Seller connects and ₱100 hold amount is deducted from seller's wallet
   - Buyer sends money to escrow wallet (amount + ₱100 transaction fee)
   - Both parties confirm receipt/delivery
   - Funds are transferred to seller after mutual confirmation
   - Protection window expires → funds returned to buyer if not confirmed

3. **Protection Window System**:
   - Configurable expiry date (default: tomorrow)
   - Real-time countdown display
   - Automatic expiration handling
   - Extension request/approval mechanism
   - Auto-refund to buyer if window expires

4. **State Management**:
   - Uses React Context API for wallet and device state
   - localStorage for persistence across sessions
   - Cross-tab synchronization via custom events
   - Polling mechanisms for real-time updates

5. **Transaction Invitations**:
   - Transaction IDs generated and shareable
   - QR code generation for easy sharing
   - URL-based connection for sellers
   - Pending transactions list for sellers

6. **UI/UX Features**:
   - GCash-inspired design with blue (#0066FF) color scheme
   - Mobile-responsive layout
   - Status notifications (success/error)
   - Balance visibility toggle
   - Terms and conditions acceptance
   - Extension request modal

### Technical Stack

- **Frontend**: React 19.2.0, TypeScript
- **Routing**: React Router DOM 7.9.6
- **Styling**: Tailwind CSS 3.4.16
- **Build Tool**: Vite 5.4.10
- **State Management**: React Context API + localStorage
- **No Backend**: Fully client-side prototype using localStorage

### Constants & Business Rules

- **Transaction Fee**: ₱100 (deducted from buyer on seller approval)
- **Seller Hold Amount**: ₱100 (deducted from seller on connection)
- **Minimum Transaction Amount**: ₱5,000
- **Default Balances**: Buyer ₱10,000, Seller ₱5,000

---

## Step-by-Step Development Iteration Plan

### Phase 1: Project Setup & Foundation (Days 1-2)

#### Step 1.1: Initialize Project Structure
- [ ] Create Vite + React + TypeScript project
- [ ] Install dependencies: React Router, Tailwind CSS
- [ ] Set up folder structure:
  ```
  src/
    components/
    context/
    hooks/
    types/
    services/
    mocks/
  ```
- [ ] Configure Tailwind with custom colors matching GCash theme

#### Step 1.2: Create Context Providers
- [ ] Build `DeviceContext.tsx`:
  - Device type state (buyer/seller/null)
  - Phone number state
  - localStorage persistence
  - URL parameter support for device type
- [ ] Build `WalletContext.tsx`:
  - Balance state (device-specific)
  - Add/subtract balance functions
  - localStorage persistence with separate keys for buyer/seller
  - Auto-sync with device type changes

#### Step 1.3: Create Dashboard Component
- [ ] Design GCash-style dashboard UI
- [ ] Implement service grid with icons
- [ ] Add balance display with visibility toggle
- [ ] Create device type selector (Buyer/Seller buttons)
- [ ] Add phone number input/display
- [ ] Implement navigation to escrow page
- [ ] Add bottom navigation bar

### Phase 2: Core Escrow Component (Days 3-5)

#### Step 2.1: Transaction Data Model
- [ ] Define `TransactionInvite` interface with all fields:
  - Basic: buyerId, amount, createdAt, description
  - Phone numbers: sellerPhoneNumber, buyerPhoneNumber
  - Status flags: sellerConnected, sellerApproved, amountHeldInEscrow, etc.
  - Protection window: protectionWindowExpiryDate
  - Extension: extensionRequested, extensionApproved, etc.
  - Completion: completed, completedAt, expired, expiredAt

#### Step 2.2: Buyer Flow - Create Transaction
- [ ] Build transaction creation form:
  - Amount input (with validation: min ₱5,000)
  - Seller phone number input
  - Transaction description textarea
  - Protection window date picker
  - Terms acceptance checkbox
- [ ] Implement `handleCreateTransaction()`:
  - Validate all inputs
  - Generate unique transaction ID
  - Create transaction payload
  - Save to localStorage with key `txn_{transactionId}`
  - Dispatch 'transactionCreated' event
  - Set buyer state (inviteLink, activeTransaction)
  - Show success message

#### Step 2.3: Transaction ID Sharing
- [ ] Display transaction ID after creation
- [ ] Add copy-to-clipboard functionality
- [ ] Generate QR code using QR API
- [ ] Show QR code in modal/component

#### Step 2.4: Seller Flow - Pending Transactions
- [ ] Implement `loadPendingTransactions()`:
  - Scan localStorage for `txn_*` keys
  - Filter by seller phone number
  - Filter by status (not connected, not approved, not completed)
  - Sort by creation date
- [ ] Build pending transactions list UI:
  - Display transaction cards with amount, description, date
  - Show approve/reject buttons
- [ ] Implement `handleSellerApprove()`:
  - Mark sellerApproved = true
  - Deduct ₱100 transaction fee from buyer's wallet
  - Call `connectSellerToTransaction()`
  - Update localStorage
  - Remove from pending list
- [ ] Implement `handleSellerReject()`:
  - Mark sellerApproved = false
  - Update localStorage
  - Remove from pending list

#### Step 2.5: Seller Connection
- [ ] Implement URL parameter handling for transaction ID
- [ ] Build `connectSellerToTransaction()`:
  - Verify seller phone number matches
  - Set device type to 'seller'
  - Hold ₱100 from seller's wallet
  - Update transaction payload (sellerConnected, sellerAmountOnHold)
  - Set seller state (connected, activeTransaction)
- [ ] Handle base64-encoded transaction IDs (fallback)

### Phase 3: Escrow Wallet & Money Flow (Days 6-8)

#### Step 3.1: Buyer - Send Money to Escrow
- [ ] Build UI showing transaction details and "Send to Escrow" button
- [ ] Implement `handleSendMoneyToEscrow()`:
  - Validate sufficient balance (amount + ₱100 fee)
  - Deduct amount and transaction fee from buyer
  - Set amountHeldInEscrow = true
  - Update localStorage
  - Show success message
- [ ] Add real-time polling to detect when seller connects

#### Step 3.2: Confirmation System
- [ ] Build buyer confirmation UI:
  - "I received the item" button
  - Terms acceptance checkbox
- [ ] Build seller confirmation UI:
  - "I delivered the item" button
- [ ] Implement confirmation handlers:
  - Update buyerConfirmed/sellerConfirmed in localStorage
  - Poll for both confirmations
  - Auto-trigger transfer when both confirmed

#### Step 3.3: Transfer to Seller
- [ ] Implement `handleTransferToSeller()`:
  - Mark transaction as completed
  - Add transaction amount + ₱100 hold release to seller's wallet
  - Mark holdReleased = true
  - Update localStorage
  - Dispatch localStorageChange event
  - Show success messages to both parties
  - Clear transaction data after delay

#### Step 3.4: Cross-Device Synchronization
- [ ] Implement useEffect hooks to poll localStorage:
  - Buyer polls for seller connection and confirmations
  - Seller polls for escrow status and confirmations
- [ ] Add custom event listeners for localStorage changes
- [ ] Implement storage event listeners for cross-tab sync
- [ ] Add refs to prevent unnecessary state updates

### Phase 4: Protection Window System (Days 9-11)

#### Step 4.1: Protection Window Calculation
- [ ] Implement `getProtectionWindowExpiry()`:
  - Support new format (protectionWindowExpiryDate)
  - Support legacy format (days/hours from createdAt)
  - Add extension time if approved
- [ ] Implement `getProtectionWindowTimeRemaining()`:
  - Calculate days, hours, minutes remaining
  - Format as "Xd Xh Xm" or "Xh Xm" or "Xm"
  - Return "Expired" if past expiry
- [ ] Implement `isProtectionWindowExpired()`:
  - Check current time against expiry
  - Consider extensions

#### Step 4.2: Protection Window UI
- [ ] Display countdown timer in transaction view
- [ ] Show expiry date/time
- [ ] Add visual indicators (warning colors when close to expiry)
- [ ] Update countdown every second using useEffect

#### Step 4.3: Expiration Handling
- [ ] Implement `handleProtectionWindowExpiry()`:
  - Mark transaction as expired
  - Return amount + transaction fee to buyer (if held in escrow)
  - Keep seller hold amount deducted
  - Update localStorage
  - Clear transaction data
- [ ] Add periodic expiration check (every minute)
- [ ] Show appropriate messages to buyer/seller

#### Step 4.4: Extension System
- [ ] Build extension request modal:
  - Date picker for new expiry date
  - Validation (must be after current expiry)
- [ ] Implement `handleSellerRequestExtension()`:
  - Calculate days/hours difference
  - Set extensionRequested = true
  - Save to localStorage
- [ ] Build buyer extension approval UI
- [ ] Implement `handleBuyerApproveExtension()`:
  - Set extensionApproved = true
  - Save extension days/hours
  - Update protection window calculation

### Phase 5: State Persistence & Restoration (Days 12-13)

#### Step 5.1: Transaction Restoration
- [ ] Implement useEffect to restore ongoing transactions on page load:
  - Scan localStorage for `txn_*` keys
  - Identify user role (buyer/seller) by phone number
  - Restore all state flags (connected, confirmed, etc.)
  - Restore activeTransaction and related state
- [ ] Handle edge cases:
  - Multiple transactions (restore most recent)
  - Completed/expired transactions (don't restore)
  - Phone number mismatches

#### Step 5.2: Wallet Balance Sync
- [ ] Implement wallet balance polling:
  - Separate useEffect for buyer balance
  - Separate useEffect for seller balance
  - Use refs to prevent unnecessary updates
  - Listen to storage events and custom events
- [ ] Ensure balance updates immediately after transactions
- [ ] Handle balance updates from other tabs/windows

#### Step 5.3: Cleanup Functions
- [ ] Implement `clearTransactionData()`:
  - Remove transaction from localStorage
  - Preserve wallet balances
- [ ] Implement `clearAllTransactions()`:
  - Remove all transaction keys
  - Preserve wallet and device settings
  - Reset all state

### Phase 6: UI/UX Polish (Days 14-15)

#### Step 6.1: Status Notifications
- [ ] Build status notification component:
  - Success (green) and error (red) variants
  - Auto-dismiss after 4 seconds
  - Smooth animations
- [ ] Integrate throughout all user actions

#### Step 6.2: Loading States
- [ ] Add loading indicators for async operations
- [ ] Disable buttons during processing
- [ ] Show skeleton loaders where appropriate

#### Step 6.3: Error Handling
- [ ] Add try-catch blocks around localStorage operations
- [ ] Validate all user inputs
- [ ] Show user-friendly error messages
- [ ] Handle edge cases (insufficient balance, invalid IDs, etc.)

#### Step 6.4: Responsive Design
- [ ] Test on mobile viewports
- [ ] Adjust grid layouts for small screens
- [ ] Ensure touch-friendly button sizes
- [ ] Test QR code display on mobile

#### Step 6.5: Developer Tools
- [ ] Add "Skip Protection Window" button (for testing)
- [ ] Add "Clear All Transactions" button (for testing)
- [ ] Position as floating action buttons
- [ ] Style distinctly (not part of main UI)

### Phase 7: Testing & Refinement (Days 16-17)

#### Step 7.1: End-to-End Testing
- [ ] Test complete buyer flow:
  - Create transaction → Share ID → Send to escrow → Confirm → Transfer
- [ ] Test complete seller flow:
  - Receive invitation → Approve → Connect → Confirm → Receive funds
- [ ] Test protection window expiration
- [ ] Test extension request/approval
- [ ] Test transaction rejection

#### Step 7.2: Edge Case Testing
- [ ] Test with insufficient balances
- [ ] Test expired transactions
- [ ] Test multiple transactions
- [ ] Test page refresh during active transaction
- [ ] Test cross-tab synchronization
- [ ] Test invalid transaction IDs

#### Step 7.3: Code Quality
- [ ] Refactor large functions into smaller ones
- [ ] Extract constants to separate file
- [ ] Add TypeScript types for all data structures
- [ ] Remove console.logs
- [ ] Add comments for complex logic
- [ ] Ensure consistent code style

#### Step 7.4: Performance Optimization
- [ ] Optimize localStorage polling intervals
- [ ] Reduce unnecessary re-renders
- [ ] Memoize expensive calculations
- [ ] Lazy load components if needed

### Phase 8: Documentation & Final Polish (Day 18)

#### Step 8.1: Code Documentation
- [ ] Add JSDoc comments to all functions
- [ ] Document complex state management logic
- [ ] Explain localStorage key structure
- [ ] Document event system (custom events)

#### Step 8.2: User Documentation
- [ ] Create README with setup instructions
- [ ] Document how to test buyer/seller flows
- [ ] Explain protection window system
- [ ] Add screenshots/diagrams of user flows

#### Step 8.3: Final Review
- [ ] Review all business rules are implemented
- [ ] Verify all UI states are handled
- [ ] Check for accessibility issues
- [ ] Ensure consistent styling
- [ ] Test on multiple browsers

---

## Key Implementation Patterns

### localStorage Structure
```
wallet_balance_buyer: "10000.00"
wallet_balance_seller: "5000.00"
device_type: "buyer" | "seller"
phone_number: "+63 912 345 6789"
txn_{transactionId}: JSON string of TransactionInvite
credited_{transactionId}: "true" (prevents double-crediting)
expired_{transactionId}: "true" (prevents double-expiration)
```

### Event System
- `transactionCreated`: Fired when buyer creates transaction
- `localStorageChange`: Fired when localStorage is updated (same-tab)
- Browser `storage` event: Fired when localStorage is updated (cross-tab)

### State Synchronization Strategy
1. **Primary Source**: localStorage is the source of truth
2. **Polling**: Components poll localStorage every 1-2 seconds
3. **Events**: Custom events notify same-tab components
4. **Storage Events**: Browser events notify cross-tab components
5. **Refs**: Prevent unnecessary state updates when value hasn't changed

### Transaction Lifecycle States
1. **Created**: Buyer creates transaction
2. **Pending Approval**: Seller sees in pending list
3. **Approved**: Seller approves, fee deducted from buyer
4. **Connected**: Seller connects, hold deducted from seller
5. **Escrow Funded**: Buyer sends money to escrow
6. **Confirmed**: Both parties confirm
7. **Completed**: Funds transferred to seller
8. **Expired**: Protection window expired, funds returned to buyer

---

## Development Tips

1. **Start Simple**: Build buyer flow first, then seller flow
2. **Test Incrementally**: Test each feature as you build it
3. **Use Browser DevTools**: Monitor localStorage changes
4. **Test in Multiple Tabs**: Simulate buyer and seller on different tabs
5. **Mock Phone Numbers**: Use consistent mock numbers for testing
6. **Protection Window Testing**: Use "Skip Protection Window" button for faster testing
7. **Clear State Often**: Use "Clear All Transactions" to reset state during development

---

## Future Enhancements (Not in Prototype)

- Backend API integration
- Real authentication system
- SMS notifications
- Dispute resolution system
- Transaction history
- Multiple currency support
- Escrow fee percentage (instead of fixed)
- Seller rating system
- Transaction templates
- Bulk transactions

